import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createRequire } from 'node:module'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore'

const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
const backend = admin.initializeApp({ projectId: 'demo-spotit' }, 'moderation-tests')
const db = backend.firestore()
const apps = []
const unique = crypto.randomUUID().slice(0, 8)
const now = admin.firestore.Timestamp.now()
let sessionToken

async function call(name, data = {}, bearer) {
  const response = await fetch(`http://127.0.0.1:5001/demo-spotit/us-central1/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ data }), signal: AbortSignal.timeout(25000),
  })
  const body = await response.json()
  if (body.error) throw Object.assign(new Error(body.error.message), { status: body.error.status })
  return body.result
}
async function client(label) {
  const app = initializeApp({ projectId: 'demo-spotit', apiKey: 'demo-key' }, `${label}-${unique}`)
  apps.push(app)
  const auth = getAuth(app)
  const clientDb = getFirestore(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(clientDb, '127.0.0.1', 8080)
  const { user } = await createUserWithEmailAndPassword(auth, `${label}-${unique}@example.test`, 'Testing123!')
  await db.doc(`users/${user.uid}`).set({ uid: user.uid, nickname: `${label}-${unique}`, username: `${label}_${unique}`, email: user.email, bio: '', createdAt: now, updatedAt: now, isPrivate: false, onboardingComplete: true })
  return { db: clientDb, uid: user.uid, bearer: await user.getIdToken(), email: user.email }
}
after(async () => { await Promise.all(apps.map(deleteApp)); await backend.delete() })

test('moderation and admin: real callable functions, Auth, Firestore and production rules', { timeout: 120000 }, async t => {
  const [owner, reporter, outsider] = await Promise.all([client('owner'), client('reporter'), client('outsider')])
  const postId = `pin-${unique}`
  const chatId = `chat-${unique}`
  const post = { id: postId, uid: owner.uid, title: '검증용 핀', content: '서버 원본 내용', placeName: '서울숲', address: '서울', lat: 37.54, lng: 127.04, dateKey: '2026-09-08', pinColor: 'walk', visibility: 'followers', photoUrls: [], authorNickname: '작성자', likeCount: 0, commentCount: 0, createdAt: now, updatedAt: now }
  await db.doc(`posts/${postId}`).set(post)
  await db.doc(`users/${owner.uid}/followers/${reporter.uid}`).set({ uid: reporter.uid })
  await db.doc(`chats/${chatId}`).set({ id: chatId, participantIds: [owner.uid, reporter.uid], name: '검증 채팅', createdAt: now })
  await db.doc(`chats/${chatId}/messages/message-a`).set({ uid: owner.uid, authorNickname: '작성자', content: '신고할 메시지 원본', createdAt: now })
  let pinCase
  let inquiryCase
  await t.test('password, forged session, expiry and every admin endpoint enforce server authorization', async () => {
    await assert.rejects(call('adminLogin', { password: 'wrong-password' }), { status: 'PERMISSION_DENIED' })
    for (const name of ['adminStats', 'adminListCases', 'adminReviewCase', 'adminSearchUsers', 'adminManageUser', 'adminLogout']) {
      await assert.rejects(call(name, { sessionToken: 'f'.repeat(64) }), { status: 'UNAUTHENTICATED' })
    }
    const session = await call('adminLogin', { password: 'quokka' })
    assert.equal(session.token.length, 64)
    assert.ok(session.expiresAt > Date.now())
    sessionToken = session.token
    const hash = require('node:crypto').createHash('sha256').update('e'.repeat(64)).digest('hex')
    await db.doc(`adminSessions/${hash}`).set({ expiresAt: admin.firestore.Timestamp.fromMillis(1) })
    await assert.rejects(call('adminStats', { sessionToken: 'e'.repeat(64) }), { status: 'UNAUTHENTICATED' })
  })
  await t.test('reports require login, visible target, valid reason, and preserve original evidence once', async () => {
    const report = { kind: 'pin', targetId: postId, reason: 'spam', details: '신고 사유', evidence: { content: '위조 내용' } }
    await assert.rejects(call('submitModerationCase', report), { status: 'UNAUTHENTICATED' })
    await assert.rejects(call('submitModerationCase', report, outsider.bearer), { status: 'PERMISSION_DENIED' })
    await assert.rejects(call('submitModerationCase', { ...report, reason: 'fake' }, reporter.bearer), { status: 'INVALID_ARGUMENT' })
    pinCase = await call('submitModerationCase', report, reporter.bearer)
    assert.equal(pinCase.duplicate, false)
    const duplicate = await call('submitModerationCase', report, reporter.bearer)
    assert.equal(duplicate.id, pinCase.id)
    assert.equal(duplicate.duplicate, true)
    assert.equal((await db.doc(`moderationCases/${pinCase.id}`).get()).data().evidence.content, post.content)
  })
  await t.test('chat report enforces membership and copies selected message from server', async () => {
    const report = { kind: 'chat', targetId: chatId, messageId: 'message-a', reason: 'harassment', details: '' }
    await assert.rejects(call('submitModerationCase', report, outsider.bearer), { status: 'PERMISSION_DENIED' })
    await assert.rejects(call('submitModerationCase', report, owner.bearer), { status: 'INVALID_ARGUMENT' })
    const result = await call('submitModerationCase', report, reporter.bearer)
    const saved = (await db.doc(`moderationCases/${result.id}`).get()).data()
    assert.equal(saved.targetUid, owner.uid)
    assert.equal(saved.evidence.content, '신고할 메시지 원본')
  })
  await t.test('user report and inquiry persist; retried inquiry is idempotent', async () => {
    await call('submitModerationCase', { kind: 'user', targetId: owner.uid, reason: 'privacy', details: '개인정보 노출' }, reporter.bearer)
    const input = { kind: 'inquiry', title: '문의 테스트', details: '답변 부탁드립니다.', requestId: crypto.randomUUID() }
    inquiryCase = await call('submitModerationCase', input, reporter.bearer)
    assert.equal((await call('submitModerationCase', input, reporter.bearer)).id, inquiryCase.id)
  })
  await t.test('raw database access cannot expose reports or forge admin privileges', async () => {
    for (const path of [`moderationCases/${pinCase.id}`, 'adminSessions/fake', `moderationPosts/${postId}`, `moderationUsers/${reporter.uid}`, 'moderationAudit/fake', 'moderationLimits/fake']) {
      await assert.rejects(getDoc(doc(reporter.db, path)), { code: 'permission-denied' })
      await assert.rejects(setDoc(doc(reporter.db, path), { suspended: false, admin: true }), { code: 'permission-denied' })
    }
    await assert.rejects(getDoc(doc(outsider.db, 'posts', postId)), { code: 'permission-denied' })
    assert.equal((await getDocs(query(collection(reporter.db, 'posts'), where('uid', '==', owner.uid), where('visibility', 'in', ['followers', 'public'])))).size, 1)
  })
  await t.test('hide removes pin from direct reads and queries; author cannot recreate it; restore works', async () => {
    await call('adminReviewCase', { sessionToken, caseId: pinCase.id, status: 'resolved', action: 'hide', note: '검토 완료', reply: '숨김 처리했습니다.' })
    assert.equal((await getDoc(doc(reporter.db, 'posts', postId))).exists(), false)
    assert.equal((await db.doc(`moderationPosts/${postId}`).get()).data().post.title, post.title)
    await assert.rejects(setDoc(doc(owner.db, 'posts', postId), { ...post, createdAt: new Date(), updatedAt: new Date() }), { code: 'permission-denied' })
    await call('adminReviewCase', { sessionToken, caseId: pinCase.id, status: 'resolved', action: 'restore', note: '재검토', reply: '복구했습니다.' })
    assert.equal((await getDoc(doc(reporter.db, 'posts', postId))).data().title, post.title)
    assert.equal((await db.doc(`moderationPosts/${postId}`).get()).exists, false)
  })
  await t.test('reply reaches only reporter; internal notes and evidence stay private', async () => {
    await call('adminReviewCase', { sessionToken, caseId: inquiryCase.id, status: 'resolved', action: 'save', note: '내부 메모', reply: '안녕하세요. 확인했습니다.' })
    const mine = await call('listMyModerationCases', {}, reporter.bearer)
    const item = mine.cases.find(item => item.id === inquiryCase.id)
    assert.equal(item.reply, '안녕하세요. 확인했습니다.')
    assert.equal(item.note, undefined)
    assert.equal(item.evidence, undefined)
    assert.equal((await call('listMyModerationCases', {}, outsider.bearer)).cases.length, 0)
    const filtered = await call('adminListCases', { sessionToken, kind: 'inquiry', status: 'resolved' })
    assert.ok(filtered.cases.some(item => item.id === inquiryCase.id))
  })
  await t.test('statistics reflect data; user searches cover nickname, username, email and UID', async () => {
    const stats = await call('adminStats', { sessionToken })
    assert.ok(stats.users >= 3); assert.ok(stats.posts >= 1); assert.ok(stats.chats >= 1)
    for (const [field, search] of [['nickname', `owner-${unique}`], ['username', `@owner_${unique}`], ['email', owner.email], ['uid', owner.uid]]) {
      const result = await call('adminSearchUsers', { sessionToken, field, search })
      assert.equal(result.users.length, 1)
      assert.equal(result.users[0].uid, owner.uid)
    }
  })
  await t.test('suspension gates already issued tokens; recovery restores access and records audit', async () => {
    await call('adminManageUser', { sessionToken, targetUid: owner.uid, suspended: true, reason: '신고 검토로 정지' })
    assert.equal((await backend.auth().getUser(owner.uid)).disabled, true)
    await assert.rejects(getDoc(doc(owner.db, 'posts', postId)), { code: 'permission-denied' })
    await assert.rejects(setDoc(doc(owner.db, `chats/${chatId}/messages/suspended`), { uid: owner.uid, content: '우회' }), { code: 'permission-denied' })
    await call('adminManageUser', { sessionToken, targetUid: owner.uid, suspended: false, reason: '재검토 후 해제' })
    assert.equal((await backend.auth().getUser(owner.uid)).disabled, false)
    assert.equal((await getDoc(doc(owner.db, 'posts', postId))).exists(), true)
    assert.ok((await db.collection('moderationAudit').where('targetUid', '==', owner.uid).get()).size >= 2)
  })
  await t.test('automatic filter queues suspicious content and does not automatically remove pins', async () => {
    const autoId = 'auto-' + unique
    await db.doc(`posts/${autoId}`).set({ ...post, id: autoId, content: '마약 판매' })
    let reports
    for (let attempt = 0; attempt < 30; attempt++) {
      reports = await db.collection('moderationCases').where('targetId', '==', autoId).get()
      if (!reports.empty) break
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    assert.equal(reports.size, 1)
    assert.equal(reports.docs[0].data().kind, 'auto')
    assert.equal((await db.doc(`posts/${autoId}`).get()).exists, true)
  })
  await t.test('logout revokes session on server', async () => {
    await call('adminLogout', { sessionToken })
    await assert.rejects(call('adminStats', { sessionToken }), { status: 'UNAUTHENTICATED' })
  })
})
