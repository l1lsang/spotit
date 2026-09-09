import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import ts from 'typescript'
import { initializeApp, deleteApp } from 'firebase/app'
import * as firestore from 'firebase/firestore'
import * as authSdk from 'firebase/auth'
import { SIGNUP_POLICY_VERSION, koreaToday } from '../src/lib/signupRequirements.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apps = []
const requirements = { birthDate: '2000-01-01', termsAccepted: true, privacyAccepted: true, locationAccepted: false }
const details = () => ({ username: crypto.randomUUID().replaceAll('-', '' ).slice(0, 25), nickname: '가입 테스트', bio: '' })
const denied = error => error.code === 'permission-denied'
after(async () => { await Promise.all(apps.map(deleteApp)) })

async function client() {
  const app = initializeApp({ projectId: 'demo-spotit-signup', apiKey: 'demo-key' }, crypto.randomUUID())
  apps.push(app)
  const auth = authSdk.getAuth(app)
  const db = firestore.getFirestore(app)
  authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9393', { disableWarnings: true })
  firestore.connectFirestoreEmulator(db, '127.0.0.1', 8383)
  const { user } = await authSdk.createUserWithEmailAndPassword(auth, `${crypto.randomUUID()}@example.test`, 'TestPassword123!')
  const modules = new Map()
  async function load(id) {
    if (modules.has(id)) return modules.get(id)
    let module
    const values = id === 'firebase/firestore' ? firestore : id === 'firebase/auth' ? authSdk
      : id === resolve(root, 'src/lib/firebase.ts') ? { requireDb: () => db, requireAuth: () => auth } : null
    if (values) module = new SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value)
    }, { identifier: id })
    else module = new SourceTextModule(ts.transpileModule(await readFile(id, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    }).outputText, { identifier: id })
    modules.set(id, module)
    return module
  }
  const linker = (specifier, parent) => load(specifier.startsWith('.') ? resolve(dirname(parent.identifier), specifier + '.ts') : specifier)
  const module = await load(resolve(root, 'src/services/userService.ts'))
  await module.link(linker)
  await module.evaluate()
  const consentModule = await load(resolve(root, 'src/services/consentService.ts'))
  await consentModule.link(linker)
  await consentModule.evaluate()
  const service = module.namespace
  await service.upsertUserProfile(user)
  return { db, user, service, consent: consentModule.namespace,
    profile: firestore.doc(db, 'users', user.uid),
    registration: firestore.doc(db, 'users', user.uid, 'private', 'registration') }
}

function registration(overrides = {}) {
  return { birthYear: 2000, birthMonth: 1, birthDay: 1, termsAccepted: true, privacyAccepted: true,
    version: SIGNUP_POLICY_VERSION, acceptedAt: firestore.serverTimestamp(), ...overrides }
}

test('email/social onboarding cannot be completed or used for posting without age and required consents', async () => {
  const c = await client()
  await assert.rejects(c.service.updateUserProfileDetails(c.user.uid, details()), /생년월일/)
  await assert.rejects(c.service.updateUserProfileDetails(c.user.uid, details(), { ...requirements, birthDate: '2020-01-01' }), /14세/)
  await assert.rejects(firestore.setDoc(c.registration, registration({ privacyAccepted: false })), denied)
  await assert.rejects(firestore.setDoc(c.registration, registration({ termsAccepted: false })), denied)
  await assert.rejects(firestore.setDoc(c.registration, registration({ birthYear: 2020 })), denied)
  await assert.rejects(firestore.setDoc(c.registration, registration({ birthMonth: 2, birthDay: 30 })), denied)
  await assert.rejects(firestore.setDoc(c.registration, registration({ version: 'old' })), denied)
  await assert.rejects(firestore.updateDoc(c.profile, { registrationRequired: false }), denied)
  await assert.rejects(firestore.setDoc(firestore.doc(c.db, 'posts', crypto.randomUUID()), { uid: c.user.uid, visibility: 'public' }), denied)
  const profile = details()
  const batch = firestore.writeBatch(c.db)
  batch.set(firestore.doc(c.db, 'usernames', '@' + profile.username), { uid: c.user.uid })
  batch.update(c.profile, { ...profile, onboardingComplete: true })
  await assert.rejects(batch.commit(), denied)
  assert.equal((await firestore.getDoc(c.profile)).data().onboardingComplete, false)
})

test('successful signup stores private age and consent records atomically; optional location remains off', async () => {
  const c = await client()
  const profile = details()
  await c.service.updateUserProfileDetails(c.user.uid, profile, requirements)
  const saved = (await firestore.getDoc(c.registration)).data()
  assert.equal(saved.birthYear, 2000)
  assert.equal(saved.termsAccepted, true)
  assert.equal(saved.privacyAccepted, true)
  assert.equal(saved.version, SIGNUP_POLICY_VERSION)
  assert.ok(saved.acceptedAt.toMillis() > 0)
  const publicProfile = (await firestore.getDoc(c.profile)).data()
  assert.equal(publicProfile.onboardingComplete, true)
  for (const key of ['birthDate', 'birthYear', 'birthMonth', 'birthDay', 'termsAccepted', 'privacyAccepted']) assert.equal(key in publicProfile, false)
  assert.equal(await c.consent.hasLocationConsent(c.user.uid), false)
  const postRef = firestore.doc(c.db, 'posts', crypto.randomUUID())
  await assert.rejects(firestore.setDoc(postRef, { uid: c.user.uid, visibility: 'private', lat: 37.5, lng: 127 }), denied)
  await c.consent.saveLocationConsent(c.user.uid, true)
  assert.equal(await c.consent.hasLocationConsent(c.user.uid), true)
  await firestore.setDoc(postRef, { uid: c.user.uid, visibility: 'private', lat: 37.5, lng: 127 })
  await c.consent.saveLocationConsent(c.user.uid, false)
  assert.equal(await c.consent.hasLocationConsent(c.user.uid), false)
  await assert.rejects(firestore.updateDoc(postRef, { lat: 38 }), denied)
  await firestore.deleteDoc(postRef)
  await c.service.updateUserProfileDetails(c.user.uid, { ...profile, nickname: '수정한 이름' })
  assert.equal((await firestore.getDoc(c.registration)).data().acceptedAt.toMillis(), saved.acceptedAt.toMillis())
  await assert.rejects(firestore.updateDoc(c.registration, { birthYear: 2001 }), denied)
  await assert.rejects(firestore.deleteDoc(c.registration), denied)
  const other = await client()
  await other.service.updateUserProfileDetails(other.user.uid, details(), requirements)
  await assert.rejects(firestore.getDoc(firestore.doc(other.db, c.registration.path)), denied)
  await assert.rejects(firestore.setDoc(firestore.doc(other.db, 'users', c.user.uid, 'private', 'locationConsent'), {
    accepted: true, version: SIGNUP_POLICY_VERSION, updatedAt: firestore.serverTimestamp(),
  }), denied)
})

test('server rejects tomorrow’s fourteenth birthday and accepts today’s', async () => {
  const c = await client()
  const today = koreaToday()
  const tomorrow = new Date(`${today}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  await assert.rejects(firestore.setDoc(c.registration, registration({ birthYear: tomorrow.getUTCFullYear() - 14,
    birthMonth: tomorrow.getUTCMonth() + 1, birthDay: tomorrow.getUTCDate() })), denied)
  const [year, month, day] = today.split('-').map(Number)
  await c.service.updateUserProfileDetails(c.user.uid, details(), { ...requirements, birthDate: `${year - 14}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, locationAccepted: true })
  assert.equal(await c.consent.hasLocationConsent(c.user.uid), true)
})

test('account deletion removes private birth date and both consent records', async () => {
  const c = await client()
  await c.service.updateUserProfileDetails(c.user.uid, details(), requirements)
  await c.service.deleteUserAccountData(c.user.uid)
  assert.equal((await firestore.getDoc(c.registration)).exists(), false)
  assert.equal((await firestore.getDoc(firestore.doc(c.db, 'users', c.user.uid, 'private', 'locationConsent'))).exists(), false)
  assert.equal((await firestore.getDoc(c.profile)).exists(), false)
})

test('username collisions do not leave partial consent records and can be retried', async () => {
  const [a, b] = await Promise.all([client(), client()])
  const profile = details()
  const results = await Promise.allSettled([a.service.updateUserProfileDetails(a.user.uid, profile, requirements),
    b.service.updateUserProfileDetails(b.user.uid, profile, requirements)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  const loser = results[0].status === 'rejected' ? a : b
  assert.equal((await firestore.getDoc(loser.registration)).exists(), false)
  await loser.service.updateUserProfileDetails(loser.user.uid, details(), requirements)
  assert.equal((await firestore.getDoc(loser.profile)).data().onboardingComplete, true)
})

test('legacy completed accounts can log in and migrate a handle without being forced to sign up again', async () => {
  const c = await client()
  // Seed a historical record through the local emulator admin interface.
  const response = await fetch(`http://127.0.0.1:8383/v1/projects/demo-spotit-signup/databases/(default)/documents/users/${c.user.uid}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { uid: { stringValue: c.user.uid }, email: { stringValue: c.user.email },
      nickname: { stringValue: '기존 회원' }, photoURL: { stringValue: '' } } }),
  })
  assert.equal(response.ok, true)
  const profile = await c.service.upsertUserProfile(c.user)
  assert.equal(profile.onboardingComplete, true)
  assert.ok(profile.username)
  assert.equal((await firestore.getDoc(c.registration)).exists(), false)
  await c.service.updateUserProfileDetails(c.user.uid, { username: profile.username, nickname: '기존 회원 수정', bio: '' })
})
