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
after(async () => { await Promise.all(apps.map(deleteApp)) })
const denied = error => error.code === 'permission-denied'

async function account() {
  const app = initializeApp({ projectId: 'demo-spotit-pins', apiKey: 'demo-key' }, crypto.randomUUID())
  apps.push(app)
  const auth = authSdk.getAuth(app)
  const db = firestore.getFirestore(app)
  authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9191', { disableWarnings: true })
  firestore.connectFirestoreEmulator(db, '127.0.0.1', 8181)
  const modules = new Map()
  async function load(id) {
    if (modules.has(id)) return modules.get(id)
    const exports = id === 'firebase/firestore' ? firestore : id === 'firebase/auth' ? authSdk : id === 'firebase/storage' ? storageSdk
      : id === resolve(root, 'src/lib/firebase.ts') ? { requireDb: () => db, requireStorage: () => { throw new Error('No uploads in this test') } } : null
    const module = exports ? new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { identifier: id }) : new SourceTextModule(ts.transpileModule(await readFile(id, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    }).outputText, { identifier: id })
    modules.set(id, module)
    return module
  }
  async function service(name) {
    const module = await load(resolve(root, `src/services/${name}.ts`))
    if (module.status === 'unlinked') await module.link((specifier, parent) => load(specifier.startsWith('.') ? resolve(dirname(parent.identifier), specifier + '.ts') : specifier))
    if (module.status !== 'evaluated') await module.evaluate()
    return module.namespace
  }
  const users = await service('userService')
  const { user } = await authSdk.signInAnonymously(auth)
  await users.upsertUserProfile(user)
  await users.updateUserProfileDetails(user.uid, { username: crypto.randomUUID().replaceAll('-', '').slice(0, 25), nickname: '그룹 참여자', bio: '' },
    { birthDate: '2000-01-01', termsAccepted: true, privacyAccepted: true, locationAccepted: true })
  return { db, auth, uid: user.uid, users, groups: await service('groupService'), posts: await service('postService') }
}

const input = groupId => ({ groupId, title: '함께 모은 장소', content: '그룹 핀 테스트', placeName: '서울숲', address: '서울', lat: 37.54, lng: 127.04, dateKey: '2026-09-10', visibility: 'public', pinColor: '#123456' })
const author = client => ({ uid: client.uid, nickname: '그룹 참여자' })
const groupDoc = (client, id) => firestore.doc(client.db, 'groups', id)
const count = async (client, id) => (await firestore.getDoc(groupDoc(client, id))).data().memberCount

function observe(subscribe, predicate) {
  return new Promise((resolve, reject) => {
    let stop = () => {}
    const timer = setTimeout(() => { stop(); reject(new Error('Subscription timed out')) }, 10000)
    stop = subscribe(value => { if (predicate(value)) { clearTimeout(timer); stop(); resolve(value) } }, error => { clearTimeout(timer); stop(); reject(error) })
  })
}

test('any active account can create groups; creator membership and count are atomic', async () => {
  for (const c of [await account(), await account()]) {
    const id = await c.groups.createGroup({ name: ' 우리 동네 ', description: ' 좋아하는 장소 ' }, c.uid)
    const data = (await firestore.getDoc(groupDoc(c, id))).data()
    assert.equal(data.name, '우리 동네')
    assert.equal(data.description, '좋아하는 장소')
    assert.equal(data.ownerUid, c.uid)
    assert.equal(data.memberCount, 1)
    assert.ok((await firestore.getDoc(firestore.doc(c.db, 'groups', id, 'members', c.uid))).exists())
    assert.ok((await firestore.getDoc(firestore.doc(c.db, 'users', c.uid, 'groupMemberships', id))).exists())
    await assert.rejects(c.groups.createGroup({ name: ' ', description: '' }, c.uid), /2~40/)
    await assert.rejects(firestore.setDoc(firestore.doc(c.db, 'groups', 'invalid-' + c.uid), { ...data, createdAt: firestore.serverTimestamp() }), denied)
  }
})

test('one-click joins are idempotent under concurrency, and leave/rejoin preserve counts and live indexes', async () => {
  const [owner, member, other] = await Promise.all([account(), account(), account()])
  const id = await owner.groups.createGroup({ name: '열린 그룹', description: '' }, owner.uid)
  const joined = observe((next, error) => member.groups.subscribeMyGroupIds(member.uid, next, error), ids => ids.includes(id))
  void joined.catch(() => {})
  await Promise.all([member.groups.setGroupMembership(id, member.uid, true), member.groups.setGroupMembership(id, member.uid, true), other.groups.setGroupMembership(id, other.uid, true)])
  await joined
  assert.equal(await count(owner, id), 3)
  await member.groups.setGroupMembership(id, member.uid, false)
  await member.groups.setGroupMembership(id, member.uid, false)
  assert.equal(await count(owner, id), 2)
  assert.equal((await firestore.getDoc(firestore.doc(member.db, 'users', member.uid, 'groupMemberships', id))).exists(), false)
  await member.groups.setGroupMembership(id, member.uid, true)
  assert.equal(await count(owner, id), 3)
  await owner.groups.setGroupMembership(id, owner.uid, false)
  assert.equal(await count(member, id), 2)
})

test('members contribute public pins; outsiders browse only the selected group and receive new pins live', async () => {
  const [owner, visitor] = await Promise.all([account(), account()])
  const first = await owner.groups.createGroup({ name: '첫 번째 그룹', description: '' }, owner.uid)
  const second = await owner.groups.createGroup({ name: '두 번째 그룹', description: '' }, owner.uid)
  await owner.posts.createPost(input(second), [], author(owner))
  await owner.posts.createPost({ ...input(''), visibility: 'private' }, [], author(owner))
  const livePins = observe((next, error) => visitor.posts.subscribeGroupPosts(first, next, error), posts => posts.length === 1)
  void livePins.catch(() => {})
  const id = await owner.posts.createPost(input(first), [], author(owner))
  assert.deepEqual((await livePins).map(post => post.id), [id])
  assert.equal((await visitor.posts.getPostById(id, visitor.uid)).groupId, first)
  await assert.rejects(visitor.posts.createPost(input(first), [], author(visitor)), /가입/)
  await visitor.groups.setGroupMembership(first, visitor.uid, true)
  const ownPin = await visitor.posts.createPost(input(first), [], author(visitor))
  await visitor.groups.setGroupMembership(second, visitor.uid, true)
  await visitor.posts.updatePost(ownPin, input(second), [], [], visitor.uid)
  assert.equal((await visitor.posts.getPostById(ownPin, visitor.uid)).groupId, second)
  await visitor.posts.updatePost(ownPin, input(first), [], [], visitor.uid)
  await visitor.groups.setGroupMembership(first, visitor.uid, false)
  await assert.rejects(visitor.posts.createPost(input(first), [], author(visitor)), /가입/)
  await visitor.posts.updatePost(ownPin, { ...input(first), title: '내 핀 수정' }, [], [], visitor.uid)
  assert.equal((await visitor.posts.getPostById(ownPin, visitor.uid)).title, '내 핀 수정')
  await visitor.posts.deletePost(ownPin, visitor.uid)
  assert.equal(await visitor.posts.getPostById(ownPin, visitor.uid), null)
})

test('last member can leave and rejoin; deleting an account cleans its membership and pins', async () => {
  const [owner, viewer] = await Promise.all([account(), account()])
  const id = await owner.groups.createGroup({ name: '계속 열려 있는 그룹', description: '' }, owner.uid)
  await owner.groups.setGroupMembership(id, owner.uid, false)
  assert.equal(await count(viewer, id), 0)
  await owner.groups.setGroupMembership(id, owner.uid, true)
  const postId = await owner.posts.createPost(input(id), [], author(owner))
  await owner.users.deleteUserAccountData(owner.uid)
  assert.equal(await count(viewer, id), 0)
  assert.equal(await viewer.posts.getPostById(postId, viewer.uid), null)
  await viewer.groups.setGroupMembership(id, viewer.uid, true)
  assert.equal(await count(viewer, id), 1)
})

test('raw writes cannot forge membership, counts, ownership, or group posting permission', async () => {
  const [owner, outsider] = await Promise.all([account(), account()])
  const id = await owner.groups.createGroup({ name: '권한 확인 그룹', description: '' }, owner.uid)
  const data = { uid: outsider.uid, groupId: id, joinedAt: firestore.serverTimestamp() }
  await assert.rejects(firestore.setDoc(firestore.doc(outsider.db, 'groups', id, 'members', outsider.uid), data), denied)
  await assert.rejects(firestore.setDoc(firestore.doc(outsider.db, 'users', outsider.uid, 'groupMemberships', id), data), denied)
  await assert.rejects(firestore.updateDoc(groupDoc(outsider, id), { memberCount: 999 }), denied)
  await assert.rejects(firestore.updateDoc(groupDoc(outsider, id), { ownerUid: outsider.uid }), denied)
  await assert.rejects(outsider.groups.setGroupMembership(id, owner.uid, false), denied)
  await assert.rejects(firestore.setDoc(firestore.doc(outsider.db, 'posts', crypto.randomUUID()), { ...input(id), uid: outsider.uid }), denied)
  await outsider.groups.setGroupMembership(id, outsider.uid, true)
  for (const visibility of ['private', 'followers']) await assert.rejects(firestore.setDoc(firestore.doc(outsider.db, 'posts', crypto.randomUUID()), { ...input(id), uid: outsider.uid, visibility }), denied)
  const personal = await outsider.posts.createPost({ ...input(''), visibility: 'private' }, [], author(outsider))
  await outsider.groups.setGroupMembership(id, outsider.uid, false)
  await assert.rejects(firestore.updateDoc(firestore.doc(outsider.db, 'posts', personal), { groupId: id, visibility: 'public' }), denied)
  await authSdk.signOut(outsider.auth)
  await assert.rejects(firestore.getDoc(groupDoc(outsider, id)), denied)
  await assert.rejects(outsider.groups.createGroup({ name: '비로그인 그룹', description: '' }, outsider.uid), denied)
})
