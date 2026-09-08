import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import ts from 'typescript'
import { initializeApp, deleteApp } from 'firebase/app'
import * as firestore from 'firebase/firestore'
import * as authSdk from 'firebase/auth'
import * as storageSdk from 'firebase/storage'
import { getUsernameError, createRandomUsername, normalizeUsername, getProfilePhotoError } from '../src/lib/userProfile.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')
const { migrateUsernames } = require('../functions/scripts/migrate-usernames.js')
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
const adminApp = admin.initializeApp({ projectId: 'demo-spotit' }, 'profile-tests')
const adminDb = adminApp.firestore()
const apps = []

// Compile the actual service modules and substitute only their Firebase initialization.
// All authentication, transactions, storage, and security rules run in the real emulators.
async function client(suffix) {
  const app = initializeApp({ projectId: 'demo-spotit', apiKey: 'demo-key', storageBucket: 'demo-spotit.appspot.com' }, suffix + '-' + crypto.randomUUID())
  apps.push(app)
  const auth = authSdk.getAuth(app)
  const db = firestore.getFirestore(app)
  const storage = storageSdk.getStorage(app)
  authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  firestore.connectFirestoreEmulator(db, '127.0.0.1', 8080)
  storageSdk.connectStorageEmulator(storage, '127.0.0.1', 9199)
  const modules = new Map()
  const synthetic = (id, values) => new SyntheticModule(Object.keys(values), function () {
    for (const [name, value] of Object.entries(values)) this.setExport(name, value)
  }, { identifier: id })
  async function load(id) {
    if (modules.has(id)) return modules.get(id)
    let module
    if (id === 'firebase/firestore') module = synthetic(id, firestore)
    else if (id === 'firebase/auth') module = synthetic(id, authSdk)
    else if (id === 'firebase/storage') module = synthetic(id, storageSdk)
    else if (id === resolve(root, 'src/lib/firebase.ts')) {
      module = synthetic(id, { requireDb: () => db, requireAuth: () => auth, requireStorage: () => storage })
    } else {
      const code = ts.transpileModule(await readFile(id, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
      module = new SourceTextModule(code, { identifier: id })
    }
    modules.set(id, module)
    return module
  }
  const service = await load(resolve(root, 'src/services/userService.ts'))
  const linker = (specifier, referencing) => load(specifier.startsWith('.') ? resolve(dirname(referencing.identifier), specifier + '.ts') : specifier)
  await service.link(linker)
  await service.evaluate()
  const storageService = await load(resolve(root, 'src/services/storageService.ts'))
  await storageService.link(linker)
  await storageService.evaluate()
  return { auth, db, storage, service: service.namespace, uploadProfilePhoto: storageService.namespace.uploadProfilePhoto }
}
async function account(name) {
  const result = await client(name)
  const { user } = await authSdk.createUserWithEmailAndPassword(result.auth, name + '-' + crypto.randomUUID() + '@example.test', 'TestPassword123!')
  return { ...result, user }
}
const details = username => ({ username, nickname: '한글 닉네임', bio: '산책과 여행을 좋아해요.\n두 번째 줄' })
after(async () => {
  await Promise.all(apps.map(deleteApp))
  await adminApp.delete()
})

test('username and image validation accepts requested characters and rejects malformed input', () => {
  for (const value of ['a', 'A.Z_09', '.', '..', '__name__', 'a'.repeat(30)]) assert.equal(getUsernameError(value), '')
  for (const value of ['', ' ', '한글', 'a/b', 'a-b', 'a b', '@name', 'a'.repeat(31)]) assert.notEqual(getUsernameError(value), '')
  assert.equal(normalizeUsername(' Ab.C_1 '), 'ab.c_1')
  const names = new Set(Array.from({ length: 200 }, createRandomUsername))
  assert.equal(names.size, 200)
  for (const name of names) assert.equal(getUsernameError(name), '')
  assert.equal(getProfilePhotoError({ type: 'image/png', size: 5 * 1024 * 1024 }), '')
  assert.notEqual(getProfilePhotoError({ type: 'image/svg+xml', size: 10 }), '')
  assert.notEqual(getProfilePhotoError({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }), '')
})

test('new accounts stay incomplete until profile save; photo and profile persist', async () => {
  const c = await account('new')
  const initial = await c.service.upsertUserProfile(c.user)
  assert.equal(initial.onboardingComplete, false)
  assert.equal(initial.username, undefined)
  const photoURL = await c.uploadProfilePhoto(c.user.uid, new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=', 'base64')], 'profile.png', { type: 'image/png' }))
  assert.match(photoURL, /127.0.0.1:9199/)
  await c.service.updateUserProfileDetails(c.user.uid, { ...details('New.Name_' + Date.now()), photoURL })
  const saved = await c.service.getUserProfile(c.user.uid)
  assert.equal(saved.onboardingComplete, true)
  assert.equal(saved.nickname, '한글 닉네임')
  assert.equal(saved.bio, details('').bio)
  assert.equal(saved.photoURL, photoURL)
  assert.equal(saved.username, saved.username.toLowerCase())
  const repeated = await c.service.upsertUserProfile(c.user)
  assert.equal(repeated.username, saved.username)
  assert.equal(repeated.photoURL, photoURL)
})

test('concurrent signup cannot claim the same case-insensitive name; rejected profile remains incomplete', async () => {
  const [a, b] = await Promise.all([account('race-a'), account('race-b')])
  await Promise.all([a.service.upsertUserProfile(a.user), b.service.upsertUserProfile(b.user)])
  const name = 'race_' + Date.now()
  const results = await Promise.allSettled([
    a.service.updateUserProfileDetails(a.user.uid, details(name.toUpperCase())),
    b.service.updateUserProfileDetails(b.user.uid, details(name)),
  ])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  const loser = results[0].status === 'rejected' ? a : b
  assert.equal((await loser.service.getUserProfile(loser.user.uid)).onboardingComplete, false)
  assert.equal(await loser.service.isUsernameAvailable(name), false)
  await loser.service.updateUserProfileDetails(loser.user.uid, details(name + '_retry'))
})

test('anonymous lookup works; forged reservations, invalid names, and another owner are rejected by rules', async () => {
  const owner = await account('rules')
  await owner.service.upsertUserProfile(owner.user)
  const name = 'owned_' + Date.now()
  await owner.service.updateUserProfileDetails(owner.user.uid, details(name))
  const visitor = await client('visitor')
  assert.equal(await visitor.service.isUsernameAvailable(name), false)
  assert.equal(await visitor.service.isUsernameAvailable('free_' + Date.now()), true)
  await assert.rejects(firestore.getDocs(firestore.collection(visitor.db, 'usernames')), { code: 'permission-denied' })
  const attacker = await account('attacker')
  await attacker.service.upsertUserProfile(attacker.user)
  await assert.rejects(firestore.setDoc(firestore.doc(attacker.db, 'usernames', '@' + name), { uid: attacker.user.uid }), { code: 'permission-denied' })
  await assert.rejects(firestore.setDoc(firestore.doc(attacker.db, 'usernames', '@fake_' + Date.now()), { uid: attacker.user.uid }), { code: 'permission-denied' })
  await assert.rejects(firestore.updateDoc(firestore.doc(owner.db, 'users', owner.user.uid), { username: '한글' }), { code: 'permission-denied' })
  await assert.rejects(firestore.deleteDoc(firestore.doc(owner.db, 'usernames', '@' + name)), { code: 'permission-denied' })
})

test('rename releases previous reservation and supports names reserved as bare Firestore document IDs', async () => {
  const c = await account('rename')
  await c.service.upsertUserProfile(c.user)
  const original = 'rename_' + Date.now()
  await c.service.updateUserProfileDetails(c.user.uid, details(original))
  for (const username of ['.', '..', '__name__', original + '_done']) {
    await c.service.updateUserProfileDetails(c.user.uid, details(username))
    assert.equal((await c.service.getUserProfile(c.user.uid)).username, username)
  }
  assert.equal(await c.service.isUsernameAvailable(original), true)
  await firestore.runTransaction(c.db, async tx => {
    const userRef = firestore.doc(c.db, 'users', c.user.uid)
    const snapshot = await tx.get(userRef)
    tx.delete(firestore.doc(c.db, 'usernames', '@' + snapshot.data().username))
    tx.delete(userRef)
  })
  assert.equal(await c.service.isUsernameAvailable(original + '_done'), true)
})

test('legacy migration is idempotent, preserves existing data, and bulk migration skips unfinished signups', async () => {
  const c = await account('legacy')
  const seed = { uid: c.user.uid, email: c.user.email, nickname: '기존 닉네임', photoURL: 'https://example.test/photo.jpg', bio: '기존 소개', isPrivate: true, followerCount: 7 }
  await adminDb.doc('users/' + c.user.uid).set(seed)
  const migrated = await c.service.upsertUserProfile(c.user)
  assert.match(migrated.username, /^user_[a-f0-9]{20}$/)
  for (const [key, value] of Object.entries(seed)) assert.equal(migrated[key], value)
  assert.equal((await c.service.upsertUserProfile(c.user)).username, migrated.username)
  const legacyId = 'bulk-' + crypto.randomUUID()
  const pendingId = 'pending-' + crypto.randomUUID()
  await adminDb.doc('users/' + legacyId).set({ ...seed, uid: legacyId })
  await adminDb.doc('users/' + pendingId).set({ ...seed, uid: pendingId, onboardingComplete: false })
  const preview = await migrateUsernames(adminDb)
  assert.equal(preview.migrated, 0)
  assert.equal((await adminDb.doc('users/' + legacyId).get()).data().username, undefined)
  assert.equal((await migrateUsernames(adminDb, { apply: true })).migrated, 1)
  const bulkProfile = (await adminDb.doc('users/' + legacyId).get()).data()
  assert.match(bulkProfile.username, /^user_[a-f0-9]{20}$/)
  assert.equal(bulkProfile.nickname, seed.nickname)
  assert.equal((await adminDb.doc('users/' + pendingId).get()).data().username, undefined)
  assert.equal((await migrateUsernames(adminDb, { apply: true })).migrated, 0)
})

