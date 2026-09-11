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
  const reads = { queries: 0, documents: 0 }
  const measuredFirestore = { ...firestore, getDocs: async (...args) => {
    reads.queries++
    const snapshot = await firestore.getDocs(...args)
    reads.documents += snapshot.size
    return snapshot
  } }
  async function load(id) {
    if (modules.has(id)) return modules.get(id)
    const exports = id === 'firebase/firestore' ? measuredFirestore : id === 'firebase/storage' ? storageSdk
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
  return { db, reads, uid: user.uid, actor: { uid: user.uid, nickname, photoURL: '' }, service,
    comments: await service('comment'), likes: await service('like'), notifications: await service('notification') }
}

before(async () => {
  [owner, commenter, replier, outsider] = await Promise.all(['핀 작성자', '댓글 작성자', '답글 작성자', '다른 사용자'].map(client))
})

test('batched feed pages honor follower rules, preserve equal-time ordering and invalidate after unfollow', { timeout: 60000 }, async () => {
  const [viewer, ...authors] = await Promise.all(['페이지 뷰어', '저자 1', '저자 2', '저자 3', '저자 4', '저자 5', '저자 6'].map(client))
  const follow = await viewer.service('follow')
  for (const author of authors) await follow.followUser(viewer.actor, author.actor)
  const expected = []
  for (const author of [viewer, ...authors]) {
    const batch = firestore.writeBatch(author.db)
    for (const visibility of ['public', 'followers', 'private']) {
      const ref = firestore.doc(firestore.collection(author.db, 'posts'))
      batch.set(ref, {
        uid: author.uid, authorNickname: author.actor.nickname, title: visibility, content: '같은 시간',
        lat: 37.5, lng: 127, visibility, photoUrls: [], pinColor: '#356f68',
        createdAt: new firestore.Timestamp(1000, 123), updatedAt: firestore.serverTimestamp(),
      })
      if (author === viewer || visibility !== 'private') expected.push(ref.id)
    }
    await batch.commit()
  }
  const posts = await viewer.service('post')
  const before = { ...viewer.reads }
  const first = await posts.getVisiblePostPage(viewer.uid, null, 4)
  assert.equal(viewer.reads.queries - before.queries, 4, 'one following query and three bounded author queries')
  assert.ok(viewer.reads.documents - before.documents <= 6 + 3 * 5)
  const afterFirst = { ...viewer.reads }
  assert.deepEqual(await posts.getVisiblePostPage(viewer.uid, null, 4), first)
  assert.deepEqual(viewer.reads, afterFirst, 'returning to a fresh page performs no additional read')
  let cursor = first.nextCursor
  const actual = first.posts.map(post => post.id)
  while (cursor) {
    const page = await posts.getVisiblePostPage(viewer.uid, cursor, 4)
    assert.ok(page.posts.length <= 4)
    actual.push(...page.posts.map(post => post.id))
    cursor = page.nextCursor
  }
  assert.deepEqual(actual, expected.sort().reverse())
  assert.deepEqual(await posts.getVisiblePosts(viewer.uid, 0), [])
  assert.equal((await posts.getVisiblePosts(viewer.uid, Infinity)).length, expected.length)
  assert.equal((await posts.getNearbyVisiblePosts(viewer.uid, { lat: 37.5, lng: 127 }, 1, 5)).length, 5)
  assert.deepEqual(await posts.getNearbyVisiblePosts(viewer.uid, { lat: 0, lng: 0 }, 1), [])
  const removed = authors[0]
  await follow.unfollowUser(viewer.uid, removed.uid)
  const refreshed = await posts.getVisiblePostPage(viewer.uid, null, 80)
  assert.ok(refreshed.posts.every(post => post.uid !== removed.uid))
  assert.equal(refreshed.posts.length, expected.length - 2)
  await assert.rejects(firestore.getDocs(firestore.query(firestore.collection(viewer.db, 'posts'),
    firestore.where('uid', 'in', [removed.uid, authors[1].uid]), firestore.where('visibility', 'in', ['public', 'followers']),
    firestore.orderBy('createdAt', 'desc'), firestore.limit(4))), denied)
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
async function handleFor(client) { return (await firestore.getDoc(firestore.doc(client.db, 'users', client.uid))).data().username }
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

test('comment and reply mentions resolve typed handles, notify once per recipient and suppress self notifications', { timeout: 30000 }, async () => {
  const postId = await pin()
  const [ownerHandle, commenterHandle, replierHandle, outsiderHandle] = await Promise.all([owner, commenter, replier, outsider].map(handleFor))
  await commenter.comments.addComment(postId, commenter.actor, `@${ownerHandle} @${replierHandle.toUpperCase()} @${replierHandle} @${commenterHandle} 함께 가요!`)
  const comment = await firstComment(postId)
  assert.deepEqual(comment.mentions, { [`@${ownerHandle}`]: owner.uid, [`@${replierHandle}`]: replier.uid, [`@${commenterHandle}`]: commenter.uid })
  for (const recipient of [owner, replier]) {
    const notice = await notifications(recipient, postId)
    assert.equal(notice.length, 1)
    assert.equal(notice[0].type, 'mention')
    assert.equal(notice[0].href, `/posts/${postId}#comment-${comment.id}`)
  }
  assert.equal((await notifications(commenter, postId)).length, 0)
  await replier.comments.addReply(postId, comment.id, replier.actor, `@${commenterHandle} @${ownerHandle} @${outsiderHandle} 답글에서 멘션`)
  const reply = (await firstComment(postId)).replies[0]
  for (const recipient of [owner, commenter, outsider]) {
    const notices = (await notifications(recipient, postId)).filter(notice => notice.replyId === reply.id)
    assert.equal(notices.length, 1)
    assert.equal(notices[0].type, 'mention')
    assert.equal(notices[0].href, `/posts/${postId}#reply-${reply.id}`)
  }
  assert.equal((await counts(postId)).commentCount, 2)
})

test('mention lookup ignores unknown handles and emails; stored links survive username changes', { timeout: 30000 }, async () => {
  const person = await client('사용자 이름 변경')
  const postId = await pin()
  const users = await person.service('user')
  const username = 'mention.dot_' + crypto.randomUUID().slice(0, 8)
  await users.updateUserProfileDetails(person.uid, { username, nickname: person.actor.nickname, bio: '' })
  const lookup = await commenter.service('mention')
  const results = await lookup.searchMentionUsers(username.slice(0, -2))
  assert.equal(results.length, 1)
  assert.equal(results[0].uid, person.uid)
  assert.deepEqual(Object.keys(results[0]).sort(), ['nickname', 'photoURL', 'uid', 'username'])
  await commenter.comments.addComment(postId, commenter.actor, `@${username} person@${username} @no_such_person_test`)
  const comment = await firstComment(postId)
  assert.deepEqual(comment.mentions, { [`@${username}`]: person.uid })
  assert.equal((await notifications(person, postId)).length, 1)
  await users.updateUserProfileDetails(person.uid, { username: 'renamed_' + crypto.randomUUID().slice(0, 8), nickname: person.actor.nickname, bio: '' })
  const replacement = await client('예전 이름 사용자')
  await (await replacement.service('user')).updateUserProfileDetails(replacement.uid, { username, nickname: replacement.actor.nickname, bio: '' })
  assert.equal((await firstComment(postId)).mentions[`@${username}`], person.uid)
  assert.equal((await notifications(replacement, postId)).length, 0)
})

test('private and followers-only pins notify only mentioned people who can read the pin', { timeout: 30000 }, async () => {
  const [commenterHandle, replierHandle] = await Promise.all([commenter, replier].map(handleFor))
  const privateId = await pin('private')
  await owner.comments.addComment(privateId, owner.actor, `@${replierHandle} 비공개 기록`)
  assert.equal((await notifications(replier, privateId)).length, 0)
  assert.equal((await firstComment(privateId)).mentions[`@${replierHandle}`], replier.uid)
  const followersId = await pin('followers')
  const followerRef = firestore.doc(owner.db, 'users', owner.uid, 'followers', commenter.uid)
  if (!(await firestore.getDoc(followerRef)).exists()) await firestore.setDoc(followerRef, { uid: commenter.uid })
  await owner.comments.addComment(followersId, owner.actor, `@${commenterHandle} @${replierHandle} 팔로워 공개 기록`)
  assert.equal((await notifications(commenter, followersId)).length, 1)
  assert.equal((await notifications(replier, followersId)).length, 0)
})

test('private group mentions support five recipients atomically without opening member lists to outsiders', { timeout: 30000 }, async () => {
  const people = await Promise.all(Array.from({ length: 5 }, (_, index) => client(`그룹 멘션 ${index}`)))
  const groupService = await owner.service('group')
  const groupId = await groupService.createGroup({ name: '멘션할 그룹', description: '', visibility: 'private' }, owner.uid)
  const code = await groupService.getGroupInviteCode(groupId)
  for (const person of [commenter, ...people]) await (await person.service('group')).joinGroupWithCode(code, person.uid)
  const postId = await pin('group', { groupId })
  const handles = await Promise.all(people.map(handleFor))
  await owner.comments.addComment(postId, owner.actor, '그룹 원댓글')
  const parent = await firstComment(postId)
  await commenter.comments.addReply(postId, parent.id, commenter.actor, handles.map(name => '@' + name).join(' '))
  assert.equal((await counts(postId)).commentCount, 2)
  for (const person of people) assert.equal((await notifications(person, postId)).length, 1)
  assert.equal((await notifications(owner, postId)).length, 1)
  const outsiderHandle = await handleFor(outsider)
  await owner.comments.addComment(postId, owner.actor, `@${outsiderHandle} 접근 권한 없음`)
  assert.equal((await notifications(outsider, postId)).length, 0)
  await assert.rejects(firestore.getDoc(firestore.doc(outsider.db, 'groups', groupId, 'members', people[0].uid)), denied)
  await assert.rejects(firestore.getDocs(firestore.collection(commenter.db, 'groups', groupId, 'members')), denied)
})

test('excessive and forged mention notifications are rejected without partial writes', { timeout: 30000 }, async () => {
  const postId = await pin()
  await assert.rejects(commenter.comments.addComment(postId, commenter.actor, '@one @two @three @four @five @six'), /최대 5명/)
  assert.equal((await counts(postId)).commentCount, 0)
  const replierHandle = await handleFor(replier)
  const ref = firestore.doc(firestore.collection(commenter.db, 'posts', postId, 'comments'))
  const batch = firestore.writeBatch(commenter.db)
  batch.set(ref, { id: ref.id, uid: commenter.uid, authorNickname: commenter.actor.nickname, content: `@${replierHandle}`, mentions: {}, replyCount: 0, createdAt: firestore.serverTimestamp() })
  commenter.notifications.queueNotification(batch, {
    recipientUid: replier.uid, actor: commenter.actor, type: 'mention', title: '위조 멘션', message: '본문의 멘션 대상에 없음',
    href: `/posts/${postId}#comment-${ref.id}`, postId, commentId: ref.id, mentionUsername: replierHandle,
  })
  await assert.rejects(batch.commit(), denied)
  assert.equal((await owner.comments.listComments(postId)).length, 0)
  assert.equal((await notifications(replier, postId)).length, 0)
})
