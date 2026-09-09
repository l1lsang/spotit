import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { initializeApp, deleteApp } from 'firebase/app'
import * as firestore from 'firebase/firestore'
import * as authSdk from 'firebase/auth'
import * as storageSdk from 'firebase/storage'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8181'
const backend = admin.initializeApp({ projectId: 'demo-spotit-pins' })
const { migrateGroups } = require('../functions/scripts/migrate-groups.js')
const { submitModerationCase } = require('../functions/moderation.js')
const apps = []
after(async () => { await Promise.all(apps.map(deleteApp)); await backend.delete() })
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
const inviteCodes = new Map()
async function createGroup(client, input) {
  const id = await client.groups.createGroup(input, client.uid)
  inviteCodes.set(id, await client.groups.getGroupInviteCode(id))
  return id
}
const join = (client, id) => client.groups.joinGroupWithCode(inviteCodes.get(id), client.uid, id)

function observe(subscribe, predicate) {
  return new Promise((resolve, reject) => {
    let stop = () => {}
    const timer = setTimeout(() => { stop(); reject(new Error('Subscription timed out')) }, 10000)
    stop = subscribe(value => { if (predicate(value)) { clearTimeout(timer); stop(); resolve(value) } }, error => { clearTimeout(timer); stop(); reject(error) })
  })
}

test('any active account can create groups; creator membership and count are atomic', async () => {
  for (const c of [await account(), await account()]) {
    const id = await createGroup(c, { name: ' 우리 동네 ', description: ' 좋아하는 장소 ' })
    const data = (await firestore.getDoc(groupDoc(c, id))).data()
    assert.equal(data.name, '우리 동네')
    assert.equal(data.description, '좋아하는 장소')
    assert.equal(data.ownerUid, c.uid)
    assert.equal(data.memberCount, 1)
    assert.equal(data.visibility, 'public')
    assert.match(inviteCodes.get(id), /^[A-HJ-NP-Z2-9]{12}$/)
    assert.equal('inviteCode' in data, false)
    assert.ok((await firestore.getDoc(firestore.doc(c.db, 'groups', id, 'members', c.uid))).exists())
    assert.ok((await firestore.getDoc(firestore.doc(c.db, 'users', c.uid, 'groupMemberships', id))).exists())
    await assert.rejects(c.groups.createGroup({ name: ' ', description: '' }, c.uid), /2~40/)
    await assert.rejects(firestore.setDoc(firestore.doc(c.db, 'groups', 'invalid-' + c.uid), { ...data, createdAt: firestore.serverTimestamp() }), denied)
  }
})

test('code joins are idempotent under concurrency, and leave/rejoin preserve counts and live indexes', async () => {
  const [owner, member, other] = await Promise.all([account(), account(), account()])
  const id = await createGroup(owner, { name: '열린 그룹', description: '' })
  const joined = observe((next, error) => member.groups.subscribeMyGroupIds(member.uid, next, error), ids => ids.includes(id))
  void joined.catch(() => {})
  await Promise.all([join(member, id), join(member, id), join(other, id)])
  await joined
  assert.equal(await count(owner, id), 3)
  await member.groups.setGroupMembership(id, member.uid, false)
  await member.groups.setGroupMembership(id, member.uid, false)
  assert.equal(await count(owner, id), 2)
  assert.equal((await firestore.getDoc(firestore.doc(member.db, 'users', member.uid, 'groupMemberships', id))).exists(), false)
  await join(member, id)
  assert.equal(await count(owner, id), 3)
  await owner.groups.setGroupMembership(id, owner.uid, false)
  assert.equal(await count(member, id), 2)
})

test('members contribute public pins; outsiders browse only the selected group and receive new pins live', async () => {
  const [owner, visitor] = await Promise.all([account(), account()])
  const first = await createGroup(owner, { name: '첫 번째 그룹', description: '' })
  const second = await createGroup(owner, { name: '두 번째 그룹', description: '' })
  await owner.posts.createPost(input(second), [], author(owner))
  await owner.posts.createPost({ ...input(''), visibility: 'private' }, [], author(owner))
  const livePins = observe((next, error) => visitor.posts.subscribeGroupPosts(first, next, error), posts => posts.length === 1)
  void livePins.catch(() => {})
  const id = await owner.posts.createPost(input(first), [], author(owner))
  assert.deepEqual((await livePins).map(post => post.id), [id])
  assert.equal((await visitor.posts.getPostById(id, visitor.uid)).groupId, first)
  await assert.rejects(visitor.posts.createPost(input(first), [], author(visitor)), /가입/)
  await join(visitor, first)
  const ownPin = await visitor.posts.createPost(input(first), [], author(visitor))
  await join(visitor, second)
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
  const id = await createGroup(owner, { name: '계속 열려 있는 그룹', description: '' })
  await owner.groups.setGroupMembership(id, owner.uid, false)
  assert.equal(await count(viewer, id), 0)
  await join(owner, id)
  const postId = await owner.posts.createPost(input(id), [], author(owner))
  await owner.users.deleteUserAccountData(owner.uid)
  assert.equal(await count(viewer, id), 0)
  assert.equal(await viewer.posts.getPostById(postId, viewer.uid), null)
  await join(viewer, id)
  assert.equal(await count(viewer, id), 1)
})

test('raw writes cannot forge membership, counts, ownership, or group posting permission', async () => {
  const [owner, outsider] = await Promise.all([account(), account()])
  const id = await createGroup(owner, { name: '권한 확인 그룹', description: '' })
  const data = { uid: outsider.uid, groupId: id, joinedAt: firestore.serverTimestamp() }
  await assert.rejects(firestore.setDoc(firestore.doc(outsider.db, 'groups', id, 'members', outsider.uid), data), denied)
  await assert.rejects(firestore.setDoc(firestore.doc(outsider.db, 'users', outsider.uid, 'groupMemberships', id), data), denied)
  await assert.rejects(firestore.updateDoc(groupDoc(outsider, id), { memberCount: 999 }), denied)
  await assert.rejects(firestore.updateDoc(groupDoc(outsider, id), { ownerUid: outsider.uid }), denied)
  await assert.rejects(outsider.groups.setGroupMembership(id, owner.uid, false), denied)
  await assert.rejects(firestore.setDoc(firestore.doc(outsider.db, 'posts', crypto.randomUUID()), { ...input(id), uid: outsider.uid }), denied)
  await join(outsider, id)
  for (const visibility of ['private', 'followers']) await assert.rejects(firestore.setDoc(firestore.doc(outsider.db, 'posts', crypto.randomUUID()), { ...input(id), uid: outsider.uid, visibility }), denied)
  const personal = await outsider.posts.createPost({ ...input(''), visibility: 'private' }, [], author(outsider))
  await outsider.groups.setGroupMembership(id, outsider.uid, false)
  await assert.rejects(firestore.updateDoc(firestore.doc(outsider.db, 'posts', personal), { groupId: id, visibility: 'public' }), denied)
  await authSdk.signOut(outsider.auth)
  await assert.rejects(firestore.getDoc(groupDoc(outsider, id)), denied)
  await assert.rejects(outsider.groups.createGroup({ name: '비로그인 그룹', description: '' }, outsider.uid), denied)
})

test('public and private groups both require valid codes; invitations cannot be listed, read from groups, or forged', async () => {
  const [owner, outsider] = await Promise.all([account(), account()])
  const publicId = await createGroup(owner, { name: '코드가 필요한 공개 그룹', description: '' })
  const privateId = await createGroup(owner, { name: '초대 전용 그룹', description: '비밀 소개', visibility: 'private' })
  const listed = await observe((next, error) => outsider.groups.subscribeGroups(next, error), groups => groups.some(group => group.id === publicId))
  assert.ok(!listed.some(group => group.id === privateId))
  await assert.rejects(firestore.getDocs(firestore.collection(outsider.db, 'groups')), denied)
  await assert.rejects(firestore.getDocs(firestore.collection(outsider.db, 'groupInvites')), denied)
  await assert.rejects(firestore.getDoc(groupDoc(outsider, privateId)), denied)

  for (const id of [publicId, privateId]) {
    await assert.rejects(outsider.groups.getGroupInviteCode(id), denied)
    await assert.rejects(outsider.groups.setGroupMembership(id, outsider.uid, true), /초대코드/)
    await assert.rejects(outsider.groups.joinGroupWithCode('wrong', outsider.uid, id), /12자리/)
    await assert.rejects(outsider.groups.joinGroupWithCode('AAAAAAAAAAAA', outsider.uid, id), /올바르지/)
    await assert.rejects(outsider.groups.joinGroupWithCode(inviteCodes.get(id === publicId ? privateId : publicId), outsider.uid, id), /올바르지/)
    // A correctly shaped atomic batch still cannot bypass the invitation check.
    for (const inviteCode of [undefined, 'AAAAAAAAAAAA', inviteCodes.get(id === publicId ? privateId : publicId)]) {
      const data = { uid: outsider.uid, groupId: id, joinedAt: firestore.serverTimestamp(), ...(inviteCode ? { inviteCode } : {}) }
      const batch = firestore.writeBatch(outsider.db)
      batch.set(firestore.doc(outsider.db, 'groups', id, 'members', outsider.uid), data)
      batch.set(firestore.doc(outsider.db, 'users', outsider.uid, 'groupMemberships', id), data)
      batch.update(groupDoc(outsider, id), { memberCount: firestore.increment(1) })
      await assert.rejects(batch.commit(), denied)
    }
    assert.equal(await count(owner, id), 1)
  }

  await assert.rejects(firestore.setDoc(firestore.doc(outsider.db, 'groupInvites', 'AAAAAAAAAAAA'), { groupId: privateId }), denied)
  await assert.rejects(firestore.updateDoc(groupDoc(owner, privateId), { visibility: 'public' }), denied)
  await assert.rejects(firestore.updateDoc(firestore.doc(owner.db, 'groupInvites', inviteCodes.get(publicId)), { groupId: privateId }), denied)
  const formatted = inviteCodes.get(privateId).toLowerCase().match(/.{4}/g).join(' - ')
  assert.equal(await outsider.groups.joinGroupWithCode(formatted, outsider.uid), privateId)
  assert.equal((await firestore.getDoc(groupDoc(outsider, privateId))).data().description, '비밀 소개')
  assert.equal(await outsider.groups.getGroupInviteCode(privateId), inviteCodes.get(privateId))
  assert.equal(await count(owner, privateId), 2)
})

test('private group pins stay out of public and follower queries, and leaving revokes access', async () => {
  const [owner, member, visitor] = await Promise.all([account(), account(), account()])
  const id = await createGroup(owner, { name: '우리만 보는 장소', description: '', visibility: 'private' })
  const pinId = await owner.posts.createPost(input(id), [], author(owner))
  const raw = (await firestore.getDoc(firestore.doc(owner.db, 'posts', pinId))).data()
  assert.equal(raw.visibility, 'group')
  const report = { data: { kind: 'pin', targetId: pinId, reason: 'spam' } }
  await assert.rejects(submitModerationCase.run({ ...report, auth: { uid: visitor.uid } }), denied)
  await assert.rejects(visitor.posts.getPostById(pinId, visitor.uid), denied)
  await assert.rejects(observe((next, error) => visitor.posts.subscribeGroupPosts(id, next, error, 'private'), () => true), denied)
  await assert.rejects(firestore.getDocs(firestore.collection(visitor.db, 'posts', pinId, 'comments')), denied)
  await assert.rejects(firestore.setDoc(firestore.doc(visitor.db, 'posts', pinId, 'likes', visitor.uid), { uid: visitor.uid }), denied)
  await assert.rejects(firestore.updateDoc(firestore.doc(owner.db, 'posts', pinId), { visibility: 'public' }), denied)

  await firestore.setDoc(firestore.doc(owner.db, 'users', owner.uid, 'followers', visitor.uid), { uid: visitor.uid })
  await firestore.setDoc(firestore.doc(visitor.db, 'users', visitor.uid, 'following', owner.uid), { uid: owner.uid })
  assert.ok(!(await visitor.posts.getVisiblePosts(visitor.uid)).some(post => post.id === pinId))
  assert.ok(!(await visitor.posts.getProfilePosts(owner.uid, visitor.uid)).posts.some(post => post.id === pinId))

  await join(member, id)
  const live = await observe((next, error) => member.posts.subscribeGroupPosts(id, next, error, 'private'), posts => posts.length === 1)
  assert.deepEqual(live.map(post => post.id), [pinId])
  assert.equal((await member.posts.getPostById(pinId, member.uid)).visibility, 'group')
  const reported = await submitModerationCase.run({ ...report, auth: { uid: member.uid } })
  assert.ok(reported.id)
  const ownPin = await member.posts.createPost(input(id), [], author(member))
  await member.groups.setGroupMembership(id, member.uid, false)
  await assert.rejects(member.posts.getPostById(pinId, member.uid), denied)
  await assert.rejects(firestore.getDoc(groupDoc(member, id)), denied)
  await assert.rejects(member.groups.getGroupInviteCode(id), denied)
  await assert.rejects(submitModerationCase.run({ ...report, auth: { uid: member.uid } }), denied)
  await member.posts.updatePost(ownPin, { ...input(id), title: '탈퇴 후 내 핀 수정' }, [], [], member.uid)
  assert.equal((await member.posts.getPostById(ownPin, member.uid)).visibility, 'group')
  await member.posts.deletePost(ownPin, member.uid)
  assert.equal(await count(owner, id), 1)
  await join(member, id)
  assert.equal((await member.posts.getPostById(pinId, member.uid)).id, pinId)
})

test('legacy groups migrate without changing private groups, memberships, or pins; code initialization is atomic', async () => {
  const [owner, visitor] = await Promise.all([account(), account()])
  const db = backend.firestore()
  const legacy = db.collection('groups').doc()
  const membership = { uid: owner.uid, groupId: legacy.id, joinedAt: admin.firestore.Timestamp.now() }
  const batch = db.batch()
  batch.set(legacy, { name: '기존 공개 그룹', description: '', ownerUid: owner.uid, memberCount: 1, createdAt: admin.firestore.Timestamp.now() })
  batch.set(legacy.collection('members').doc(owner.uid), membership)
  batch.set(db.doc(`users/${owner.uid}/groupMemberships/${legacy.id}`), membership)
  await batch.commit()
  const privateId = await createGroup(owner, { name: '유지할 비공개 그룹', description: '', visibility: 'private' })
  const pinId = await owner.posts.createPost(input(legacy.id), [], author(owner))
  assert.equal((await migrateGroups(db)).eligible, 1)
  assert.equal((await legacy.get()).data().visibility, undefined)
  assert.equal((await migrateGroups(db, { apply: true, pageSize: 2 })).migrated, 1)
  assert.equal((await migrateGroups(db, { apply: true })).migrated, 0)
  assert.equal((await db.doc(`groups/${privateId}`).get()).data().visibility, 'private')
  assert.equal(await count(owner, legacy.id), 1)
  assert.ok((await visitor.posts.getPostById(pinId, visitor.uid)).id)
  const codes = await Promise.all([owner.groups.getGroupInviteCode(legacy.id), owner.groups.getGroupInviteCode(legacy.id)])
  assert.equal(codes[0], codes[1])
  assert.equal(await visitor.groups.joinGroupWithCode(codes[0], visitor.uid), legacy.id)
  assert.equal(await count(owner, legacy.id), 2)
  const listed = await observe((next, error) => visitor.groups.subscribeGroups(next, error), groups => groups.some(group => group.id === legacy.id))
  assert.ok(!listed.some(group => group.id === privateId))
})
