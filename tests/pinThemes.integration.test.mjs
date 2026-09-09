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
import * as storageSdk from 'firebase/storage'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apps = []

// Compile the actual service modules and substitute only their Firebase initialization.
// Authentication, transactions, and security rules run in isolated emulators.
async function client(suffix) {
  const app = initializeApp({ projectId: 'demo-spotit-pins', apiKey: 'demo-key' }, suffix + '-' + crypto.randomUUID())
  apps.push(app)
  const auth = authSdk.getAuth(app)
  const db = firestore.getFirestore(app)
  authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9191', { disableWarnings: true })
  firestore.connectFirestoreEmulator(db, '127.0.0.1', 8181)
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
      module = synthetic(id, { requireDb: () => db, requireAuth: () => auth, requireStorage: () => { throw new Error('These tests do not upload files') } })
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
  async function loadPostService() {
    const module = await load(resolve(root, 'src/services/postService.ts'))
    await module.link(linker)
    await module.evaluate()
    return module.namespace
  }
  return { auth, db, service: service.namespace, loadPostService }
}
async function account(name) {
  const result = await client(name)
  const { user } = await authSdk.createUserWithEmailAndPassword(result.auth, name + '-' + crypto.randomUUID() + '@example.test', 'TestPassword123!')
  await result.service.upsertUserProfile(user)
  await result.service.updateUserProfileDetails(user.uid, {
    username: crypto.randomUUID().replaceAll('-', '').slice(0, 25), nickname: '핀 테스트', bio: '',
  }, { birthDate: '2000-01-01', termsAccepted: true, privacyAccepted: true, locationAccepted: true })
  return { ...result, user }
}
after(async () => { await Promise.all(apps.map(deleteApp)) })

test('pin themes persist, merge concurrent additions, and update by ID', async () => {
  const c = await account('pin-themes')
  await c.service.upsertUserProfile(c.user)
  assert.deepEqual((await c.service.getUserProfile(c.user.uid)).pinThemes || [], [])
  const first = { id: 'travel', name: ' 여행 ', color: '#12ABEF' }
  const second = { id: 'favorites', name: '다시 갈 곳', color: '#667788' }
  await Promise.all([c.service.saveUserPinTheme(c.user.uid, first), c.service.saveUserPinTheme(c.user.uid, second)])
  const saved = (await c.service.getUserProfile(c.user.uid)).pinThemes
  assert.equal(saved.length, 2)
  assert.deepEqual(saved.find(theme => theme.id === first.id), { ...first, name: '여행', color: '#12abef' })
  await c.service.saveUserPinTheme(c.user.uid, { ...first, name: '해외 여행', color: '#224466' })
  const updated = (await c.service.getUserProfile(c.user.uid)).pinThemes
  assert.equal(updated.length, 2)
  assert.deepEqual(updated.find(theme => theme.id === first.id), { ...first, name: '해외 여행', color: '#224466' })
  assert.deepEqual(updated.find(theme => theme.id === second.id), second)
  await assert.rejects(c.service.saveUserPinTheme(c.user.uid, { ...second, id: 'duplicate' }), /이미 사용 중/)
})

test('pin themes cannot be modified by another account', async () => {
  const owner = await account('pin-owner')
  const other = await account('pin-other')
  await owner.service.upsertUserProfile(owner.user)
  const theme = { id: 'mine', name: '내 테마', color: '#123456' }
  await owner.service.saveUserPinTheme(owner.user.uid, theme)
  await assert.rejects(other.service.saveUserPinTheme(owner.user.uid, { ...theme, color: '#654321' }))
  assert.deepEqual((await owner.service.getUserProfile(owner.user.uid)).pinThemes, [theme])
})

test('pin themes and arbitrary colors survive post creation, reload, and editing', async () => {
  const c = await account('pin-post')
  const profile = await c.service.upsertUserProfile(c.user)
  const posts = await c.loadPostService()
  const input = { title: '테마 핀', content: '테마 색상 저장 확인', placeName: '서울숲', address: '서울', lat: 37.54, lng: 127.04, dateKey: '2026-09-08', visibility: 'private', pinColor: '#12ABEF', pinThemeId: 'travel' }
  const postId = await posts.createPost(input, [], { uid: c.user.uid, nickname: profile.nickname })
  const created = await posts.getPostById(postId, c.user.uid)
  assert.equal(created.pinColor, '#12abef')
  assert.equal(created.pinThemeId, 'travel')
  await posts.updatePost(postId, { ...input, pinColor: '#556677', pinThemeId: '' }, [], [], c.user.uid)
  const edited = await posts.getPostById(postId, c.user.uid)
  assert.equal(edited.pinColor, '#556677')
  assert.equal(edited.pinThemeId, '')
  const raw = (await firestore.getDoc(firestore.doc(c.db, 'posts', postId))).data()
  assert.equal(raw.pinColor, '#556677')
  assert.equal(raw.pinThemeId, '')
})
