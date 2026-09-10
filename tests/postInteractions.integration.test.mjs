import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import ts from 'typescript'
import { initializeApp, deleteApp } from 'firebase/app'
import * as firestore from 'firebase/firestore'
import * as storageSdk from 'firebase/storage'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apps = []
const denied = error => error.code === 'permission-denied'
let owner, commenter, replier, outsider
after(async () => { await Promise.all(apps.map(deleteApp)) })

async function client(nickname) {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-spotit-pins', 'Run with the isolated Firebase emulator script')
  const app = initializeApp({ projectId: 'demo-spotit-pins', apiKey: 'demo-key' }, crypto.randomUUID())
  apps.push(app)
  const auth = getAuth(app)
  const db = firestore.getFirestore(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9191', { disableWarnings: true })
  firestore.connectFirestoreEmulator(db, '127.0.0.1', 8181)
  const { user } = await signInAnonymously(auth)
  const modules = new Map()
  async function load(id) {
    if (modules.has(id)) return modules.get(id)
    const exports = id === 'firebase/firestore' ? firestore : id === 'firebase/storage' ? storageSdk
      : id === resolve(root, 'src/lib/firebase.ts') ? { requireDb: () => db, requireStorage: () => { throw new Error('No uploads in these tests') } } : null
    const module = exports ? new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { identifier: id }) : new SourceTextModule(ts.transpileModule(await readFile(id, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    }).outputText, { identifier: id })
    modules.set(id, module)
    return module
  }
  const linker = (specifier, parent) => load(specifier.startsWith('.') ? resolve(dirname(parent.identifier), specifier + '.ts') : specifier)
  async function service(name) {
    const module = await load(resolve(root, `src/services/${name}Service.ts`))
    if (module.status === 'unlinked') await module.link(linker)
    if (module.status !== 'evaluated') await module.evaluate()
    return module.namespace
  }
  const users = await service('user')
  await users.upsertUserProfile(user)
  await users.updateUserProfileDetails(user.uid, {
    username: crypto.randomUUID().replaceAll('-', '').slice(0, 25), nickname, bio: '',
  }, { birthDate: '2000-01-01', termsAccepted: true, privacyAccepted: true, locationAccepted: true })
  return { db, uid: user.uid, actor: { uid: user.uid, nickname, photoURL: '' }, service,
    comments: await service('comment'), likes: await service('like'), notifications: await service('notification') }
}

before(async () => {
  [owner, commenter, replier, outsider] = await Promise.all(['핀 작성자', '댓글 작성자', '답글 작성자', '다른 사용자'].map(client))
})

async function pin(visibility = 'public', extra = {}) {
  const ref = firestore.doc(firestore.collection(owner.db, 'posts'))
  await firestore.setDoc(ref, {
    uid: owner.uid, authorNickname: owner.actor.nickname, title: '서울숲 산책', content: '동네 산책 기록',
    placeName: '서울숲', address: '서울', lat: 37.54, lng: 127.04, dateKey: '2026-09-10', visibility,
    photoUrls: [], pinColor: '#356f68', likeCount: 0, commentCount: 0,
    createdAt: firestore.serverTimestamp(), updatedAt: firestore.serverTimestamp(), ...extra,
  })
  return ref.id
}
async function counts(postId) { return (await firestore.getDoc(firestore.doc(owner.db, 'posts', postId))).data() }
async function notifications(client, postId) {
  const snapshot = await firestore.getDocs(firestore.query(firestore.collection(client.db, 'users', client.uid, 'notifications'), firestore.where('postId', '==', postId)))
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id }))
}
async function firstComment(postId) { return (await owner.comments.listComments(postId))[0] }
async function until(predicate) {
  const deadline = Date.now() + 8000
  while (!predicate()) {
    if (Date.now() > deadline) assert.fail('Live subscription did not reach the expected state')
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

test('likes toggle atomically, remain correct under concurrent users, and skip self/unlike notifications', { timeout: 30000 }, async () => {
  const postId = await pin()
  await Promise.all([commenter.likes.togglePostLike(postId, commenter.actor), replier.likes.togglePostLike(postId, replier.actor)])
  assert.equal((await counts(postId)).likeCount, 2)
  assert.equal((await notifications(owner, postId)).length, 2)
  assert.equal(await commenter.likes.togglePostLike(postId, commenter.actor), false)
  assert.equal((await counts(postId)).likeCount, 1)
  assert.equal((await notifications(owner, postId)).length, 2)
  await owner.likes.togglePostLike(postId, owner.actor)
  assert.equal((await notifications(owner, postId)).length, 2)
  const notice = (await notifications(owner, postId))[0]
  assert.equal(notice.href, `/posts/${postId}`)
  assert.equal(notice.readAt, null)
  await owner.notifications.markNotificationAsRead(owner.uid, notice.id)
  assert.ok((await notifications(owner, postId)).find(item => item.id === notice.id).readAt)
})

test('comments and replies notify the correct recipients, deduplicate owners, and target their exact row', { timeout: 30000 }, async () => {
  const postId = await pin()
  await commenter.comments.addComment(postId, commenter.actor, '  함께 가고 싶어요\n산책하기 좋네요!  ')
  const comment = await firstComment(postId)
  assert.equal(comment.content, '함께 가고 싶어요\n산책하기 좋네요!')
  assert.equal(comment.authorNickname, commenter.actor.nickname)
  assert.equal((await notifications(owner, postId))[0].href, `/posts/${postId}#comment-${comment.id}`)
  assert.equal((await notifications(commenter, postId)).length, 0)
  await replier.comments.addReply(postId, comment.id, replier.actor, '주말에 같이 가요!')
  const reply = (await firstComment(postId)).replies[0]
  for (const recipient of [owner, commenter]) {
    const notice = (await notifications(recipient, postId)).find(item => item.replyId === reply.id)
    assert.equal(notice.type, 'reply')
    assert.equal(notice.href, `/posts/${postId}#reply-${reply.id}`)
  }
  assert.equal((await notifications(replier, postId)).length, 0)
  await owner.comments.addComment(postId, owner.actor, '작성자 댓글')
  const ownComment = (await owner.comments.listComments(postId)).find(item => item.uid === owner.uid)
  await replier.comments.addReply(postId, ownComment.id, replier.actor, '작성자에게 답글')
  assert.equal((await notifications(owner, postId)).filter(item => item.commentId === ownComment.id).length, 1)
  await commenter.comments.addReply(postId, comment.id, commenter.actor, '내 댓글에 답글')
  assert.equal((await notifications(commenter, postId)).length, 1)
  assert.equal((await counts(postId)).commentCount, 5)
})

test('another account receives live counts, comments and replies; unsubscribing stops delivery', { timeout: 30000 }, async () => {
  const postId = await pin()
  let thread = [], reactions, liked, unread = -1, updates = 0
  const errors = []
  const beforeUnread = await firestore.getDocs(firestore.query(firestore.collection(owner.db, 'users', owner.uid, 'notifications'), firestore.where('readAt', '==', null)))
  const stops = [
    owner.comments.subscribeToComments(postId, items => { thread = items; updates++ }, error => errors.push(error)),
    owner.likes.subscribeToPostReactions(postId, value => { reactions = value }, error => errors.push(error)),
    commenter.likes.subscribeToLikeStatus(postId, commenter.uid, value => { liked = value }, error => errors.push(error)),
    owner.notifications.subscribeToUnreadNotificationCount(owner.uid, value => { unread = value }, error => errors.push(error)),
  ]
  try {
    await until(() => reactions?.commentCount === 0 && liked === false)
    await commenter.comments.addComment(postId, commenter.actor, '실시간 댓글')
    await until(() => thread.length === 1 && reactions.commentCount === 1 && unread === beforeUnread.size + 1)
    await replier.comments.addReply(postId, thread[0].id, replier.actor, '실시간 답글')
    await commenter.likes.togglePostLike(postId, commenter.actor)
    await until(() => thread[0]?.replies.length === 1 && reactions.commentCount === 2 && reactions.likeCount === 1 && liked === true)
    await replier.comments.deleteReply(postId, thread[0].id, thread[0].replies[0].id, replier.uid)
    await until(() => thread[0]?.replies.length === 0 && reactions.commentCount === 1)
    assert.deepEqual(errors, [])
  } finally { stops.forEach(stop => stop()) }
  const stoppedAt = updates
  await commenter.comments.addComment(postId, commenter.actor, '구독 종료 후 댓글')
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.equal(updates, stoppedAt)
})

test('concurrent deletes count once and a deleted parent preserves existing replies', { timeout: 30000 }, async () => {
  const postId = await pin()
  await commenter.comments.addComment(postId, commenter.actor, '원댓글')
  const comment = await firstComment(postId)
  await Promise.all([replier.comments.addReply(postId, comment.id, replier.actor, '첫 답글'), owner.comments.addReply(postId, comment.id, owner.actor, '둘째 답글')])
  await Promise.all([commenter.comments.deleteComment(postId, comment.id, commenter.uid), owner.comments.deleteComment(postId, comment.id, owner.uid)])
  assert.equal((await counts(postId)).commentCount, 2)
  const deleted = await firstComment(postId)
  assert.equal(deleted.deleted, true)
  assert.equal(deleted.content, '')
  assert.equal(deleted.replies.length, 2)
  await assert.rejects(replier.comments.addReply(postId, comment.id, replier.actor, '삭제 후 답글'), /삭제된 댓글/)
  const reply = deleted.replies.find(item => item.uid === replier.uid)
  await Promise.all([replier.comments.deleteReply(postId, comment.id, reply.id, replier.uid), owner.comments.deleteReply(postId, comment.id, reply.id, owner.uid)])
  assert.equal((await counts(postId)).commentCount, 1)
  assert.equal((await firstComment(postId)).replyCount, 1)
  await assert.rejects(outsider.comments.deleteReply(postId, comment.id, deleted.replies.find(item => item.uid === owner.uid).id, outsider.uid), /권한/)
})

test('failed notification writes roll back likes and comments; fabricated social notifications are denied', { timeout: 30000 }, async () => {
  const postId = await pin()
  const forgedActor = { ...commenter.actor, nickname: '다른 사람 이름' }
  await assert.rejects(commenter.likes.togglePostLike(postId, forgedActor), denied)
  await assert.rejects(commenter.comments.addComment(postId, forgedActor, '실패해야 하는 댓글'), denied)
  assert.equal((await counts(postId)).likeCount, 0)
  assert.equal((await counts(postId)).commentCount, 0)
  assert.equal((await owner.comments.listComments(postId)).length, 0)
  assert.equal((await notifications(owner, postId)).length, 0)
  await assert.rejects(commenter.notifications.createNotification({
    recipientUid: owner.uid, actor: commenter.actor, type: 'like', title: '위조 알림', message: '실제 좋아요 없음', href: `/posts/${postId}`, postId,
  }), denied)
  await assert.rejects(commenter.comments.addComment(postId, commenter.actor, ' '.repeat(4)), /1~2000/)
  await assert.rejects(commenter.comments.addComment(postId, commenter.actor, '가'.repeat(2001)), /1~2000/)
})

test('private, followers and private-group pins enforce access for every reaction', { timeout: 30000 }, async () => {
  const groupService = await owner.service('group')
  const groupId = await groupService.createGroup({ name: '비공개 모임', description: '', visibility: 'private' }, owner.uid)
  for (const [visibility, extra] of [['private', {}], ['followers', {}], ['group', { groupId }]]) {
    const postId = await pin(visibility, extra)
    await owner.comments.addComment(postId, owner.actor, '접근 제한 댓글')
    const comment = await firstComment(postId)
    await assert.rejects(outsider.likes.togglePostLike(postId, outsider.actor), denied)
    await assert.rejects(outsider.comments.addComment(postId, outsider.actor, '권한 없는 댓글'), denied)
    await assert.rejects(outsider.comments.addReply(postId, comment.id, outsider.actor, '권한 없는 답글'), denied)
    await assert.rejects(outsider.comments.listComments(postId), denied)
    assert.equal((await counts(postId)).commentCount, 1)
    assert.equal((await counts(postId)).likeCount, 0)
    if (visibility === 'followers') {
      await firestore.setDoc(firestore.doc(owner.db, 'users', owner.uid, 'followers', commenter.uid), { uid: commenter.uid })
      await commenter.comments.addComment(postId, commenter.actor, '허용된 팔로워 댓글')
      await commenter.likes.togglePostLike(postId, commenter.actor)
      assert.equal((await counts(postId)).likeCount, 1)
    }
  }
})

test('raw writes cannot add orphan replies, empty comments, or delete another person’s comment', { timeout: 30000 }, async () => {
  const postId = await pin()
  const commentRef = firestore.doc(commenter.db, 'posts', postId, 'comments', 'raw')
  const data = { id: 'raw', uid: commenter.uid, authorNickname: commenter.actor.nickname, content: '', replyCount: 0, createdAt: firestore.serverTimestamp() }
  await assert.rejects(firestore.setDoc(commentRef, data), denied)
  const replyRef = firestore.doc(commenter.db, 'posts', postId, 'comments', 'missing', 'replies', 'raw')
  await assert.rejects(firestore.setDoc(replyRef, { ...data, commentId: 'missing', content: '부모 없는 답글' }), denied)
  await commenter.comments.addComment(postId, commenter.actor, '삭제 권한 확인')
  const comment = await firstComment(postId)
  await assert.rejects(firestore.deleteDoc(firestore.doc(outsider.db, 'posts', postId, 'comments', comment.id)), denied)
  await assert.rejects(firestore.updateDoc(firestore.doc(outsider.db, 'posts', postId, 'comments', comment.id), { deleted: true, content: '' }), denied)
})

test('liked pins load newest first, include older likes, and update on unlike, deletion and loss of access', { timeout: 30000 }, async () => {
  const savedBy = await client('좋아요 모음 사용자')
  const postsService = await savedBy.service('post')
  const olderId = await pin()
  const newerId = await pin()
  const removedId = await pin()
  // The older like has the original schema, without a mirrored user collection or postId field.
  await firestore.setDoc(firestore.doc(savedBy.db, 'posts', olderId, 'likes', savedBy.uid), {
    uid: savedBy.uid, createdAt: firestore.Timestamp.fromMillis(1000),
  })
  await savedBy.likes.togglePostLike(newerId, savedBy.actor)
  await savedBy.likes.togglePostLike(removedId, savedBy.actor)
  let saved = [], calls = 0
  const errors = []
  const stop = postsService.subscribeToLikedPosts(savedBy.uid, next => { saved = next; calls++ }, error => errors.push(error))
  try {
    await until(() => saved.length === 3)
    assert.deepEqual(saved.map(item => item.id), [removedId, newerId, olderId])
    await savedBy.likes.togglePostLike(newerId, savedBy.actor)
    await until(() => saved.length === 2)
    assert.deepEqual(saved.map(item => item.id), [removedId, olderId])
    await firestore.deleteDoc(firestore.doc(owner.db, 'posts', removedId))
    await until(() => saved.length === 1)
    await firestore.updateDoc(firestore.doc(owner.db, 'posts', olderId), { visibility: 'private' })
    await until(() => saved.length === 0)
    assert.deepEqual(errors, [])
  } finally { stop() }
  const stoppedAt = calls
  await savedBy.likes.togglePostLike(newerId, savedBy.actor)
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.equal(calls, stoppedAt)
  const othersPosts = await outsider.service('post')
  const deniedList = await new Promise(resolve => {
    const unsubscribe = othersPosts.subscribeToLikedPosts(savedBy.uid, () => { unsubscribe(); resolve(false) }, error => {
      unsubscribe(); resolve(denied(error))
    })
  })
  assert.equal(deniedList, true)
})
