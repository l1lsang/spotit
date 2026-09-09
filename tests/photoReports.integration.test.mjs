import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createRequire } from 'node:module'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore'

const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
const backend = admin.initializeApp({ projectId: 'demo-spotit' }, 'photo-report-tests')
const db = backend.firestore()
const apps = []
const unique = crypto.randomUUID().slice(0, 8)
const now = admin.firestore.Timestamp.now()
const photos = ['https://example.test/one.jpg', 'https://example.test/two.jpg']

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
  const app = initializeApp({ projectId: 'demo-spotit', apiKey: 'demo-key' }, `photo-${label}-${unique}`)
  apps.push(app)
  const auth = getAuth(app)
  const clientDb = getFirestore(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(clientDb, '127.0.0.1', 8080)
  const { user } = await createUserWithEmailAndPassword(auth, `photo-${label}-${unique}@example.test`, 'Testing123!')
  await db.doc(`users/${user.uid}`).set({ uid: user.uid, nickname: label, username: `photo_${label}_${unique}`, photoURL: photos[0], bio: 'private-to-evidence bio', createdAt: now, updatedAt: now, onboardingComplete: true })
  return { uid: user.uid, bearer: await user.getIdToken(), db: clientDb }
}

after(async () => { await Promise.all(apps.map(deleteApp)); await backend.delete() })

test('photo reports: trusted source, access, evidence privacy and admin handling', { timeout: 120000 }, async t => {
  const [owner, reporter, outsider, profileReporter, chatReporter, invalidReporter] = await Promise.all(
    ['owner', 'reporter', 'outsider', 'profile', 'chat', 'invalid'].map(client),
  )
  const postId = `photo-pin-${unique}`
  const privateId = `photo-private-${unique}`
  const chatId = `photo-chat-${unique}`
  const post = { id: postId, uid: owner.uid, title: 'Photo fixture', content: 'Do not copy this text for photo reports', placeName: 'Place', address: 'Do not copy this address', lat: 37.5, lng: 127, visibility: 'followers', photoUrls: photos, authorNickname: 'Original owner', createdAt: now, updatedAt: now }
  await db.doc(`posts/${postId}`).set(post)
  await db.doc(`posts/${privateId}`).set({ ...post, id: privateId, visibility: 'private' })
  await db.doc(`users/${owner.uid}/followers/${reporter.uid}`).set({ uid: reporter.uid })
  await db.doc(`chats/${chatId}`).set({ participantIds: [owner.uid, chatReporter.uid], name: 'Photo chat', createdAt: now })
  for (const messageId of ['one', 'two']) {
    await db.doc(`chats/${chatId}/messages/${messageId}`).set({ uid: owner.uid, authorNickname: 'Original owner', content: 'Do not copy this message', photoUrl: photos[0], createdAt: now })
  }
  await db.doc(`chats/${chatId}/messages/other`).set({ uid: owner.uid, content: 'Unrelated conversation', createdAt: now })
  await db.doc(`chats/${chatId}/messages/deleted`).set({ uid: 'deleted-user', photoUrl: photos[0], createdAt: now })
  const pinInput = { kind: 'photo', sourceKind: 'pin', targetId: postId, photoUrl: photos[0], reason: 'privacy', details: '' }
  const profileInput = { ...pinInput, sourceKind: 'user', targetId: owner.uid }
  const chatInput = { ...pinInput, sourceKind: 'chat', targetId: chatId, messageId: 'one' }
  let pinCase, profileCase, chatCase

  await t.test('rejects unauthenticated, malformed, suspended and own-photo requests', async () => {
    await assert.rejects(call('submitModerationCase', pinInput), { status: 'UNAUTHENTICATED' })
    for (const data of [
      { ...pinInput, sourceKind: 'inquiry' }, { ...pinInput, photoUrl: 'data:image/png;base64,abc' },
      { ...pinInput, photoUrl: '' }, { ...pinInput, targetId: 'nested/path' },
      { ...pinInput, reason: 'unknown' }, { ...chatInput, messageId: '' },
    ]) await assert.rejects(call('submitModerationCase', data, invalidReporter.bearer), { status: 'INVALID_ARGUMENT' })
    for (const data of [pinInput, profileInput, chatInput]) {
      await assert.rejects(call('submitModerationCase', data, owner.bearer), { status: 'INVALID_ARGUMENT' })
    }
    await db.doc(`moderationUsers/${invalidReporter.uid}`).set({ suspended: true })
    await assert.rejects(call('submitModerationCase', pinInput, invalidReporter.bearer), { status: 'PERMISSION_DENIED' })
  })

  await t.test('pin access and exact photo attachment are enforced; each photo has its own case', async () => {
    await assert.rejects(call('submitModerationCase', pinInput, outsider.bearer), { status: 'PERMISSION_DENIED' })
    await assert.rejects(call('submitModerationCase', { ...pinInput, targetId: privateId }, reporter.bearer), { status: 'PERMISSION_DENIED' })
    await assert.rejects(call('submitModerationCase', { ...pinInput, photoUrl: 'https://example.test/forged.jpg' }, reporter.bearer), { status: 'NOT_FOUND' })
    pinCase = await call('submitModerationCase', { ...pinInput, targetUid: outsider.uid, evidence: { photoUrls: ['forged'], content: 'forged' } }, reporter.bearer)
    const duplicate = await call('submitModerationCase', { ...pinInput, details: 'overwrite attempt' }, reporter.bearer)
    assert.equal(duplicate.duplicate, true)
    assert.equal(duplicate.id, pinCase.id)
    const second = await call('submitModerationCase', { ...pinInput, photoUrl: photos[1] }, reporter.bearer)
    assert.notEqual(second.id, pinCase.id)
    const saved = (await db.doc(`moderationCases/${pinCase.id}`).get()).data()
    assert.equal(saved.kind, 'photo')
    assert.equal(saved.sourceKind, 'pin')
    assert.equal(saved.targetUid, owner.uid)
    assert.equal(saved.details, '')
    assert.deepEqual(saved.evidence, { photoUrls: [photos[0]], authorNickname: 'Original owner', sourceKind: 'pin' })
  })

  await t.test('profile evidence uses the current avatar and excludes unrelated profile fields', async () => {
    profileCase = await call('submitModerationCase', profileInput, profileReporter.bearer)
    const saved = (await db.doc(`moderationCases/${profileCase.id}`).get()).data()
    assert.deepEqual(saved.evidence, { photoUrls: [photos[0]], authorNickname: 'owner', sourceKind: 'user' })
    await db.doc(`users/${owner.uid}`).update({ photoURL: photos[1] })
    await assert.rejects(call('submitModerationCase', profileInput, profileReporter.bearer), { status: 'NOT_FOUND' })
    const replacement = await call('submitModerationCase', { ...profileInput, photoUrl: photos[1] }, profileReporter.bearer)
    assert.notEqual(replacement.id, profileCase.id)
  })

  await t.test('chat requires membership and a live photo message; no message text or other messages are copied', async () => {
    await assert.rejects(call('submitModerationCase', chatInput, outsider.bearer), { status: 'PERMISSION_DENIED' })
    for (const messageId of ['missing', 'other', 'deleted']) {
      await assert.rejects(call('submitModerationCase', { ...chatInput, messageId }, chatReporter.bearer), { status: 'NOT_FOUND' })
    }
    chatCase = await call('submitModerationCase', chatInput, chatReporter.bearer)
    const saved = (await db.doc(`moderationCases/${chatCase.id}`).get()).data()
    assert.equal(saved.targetUid, owner.uid)
    assert.deepEqual(saved.evidence, { photoUrls: [photos[0]], authorNickname: 'Original owner', sourceKind: 'chat', messageId: 'one' })
    const duplicate = await call('submitModerationCase', chatInput, chatReporter.bearer)
    assert.equal(duplicate.id, chatCase.id)
    const anotherMessage = await call('submitModerationCase', { ...chatInput, messageId: 'two' }, chatReporter.bearer)
    assert.notEqual(anotherMessage.id, chatCase.id)
  })

  await t.test('photo cases are admin-filterable; only pin photos can hide and restore their parent', async () => {
    const { token: sessionToken } = await call('adminLogin', { password: 'quokka' })
    try {
      const filtered = await call('adminListCases', { sessionToken, kind: 'photo', status: 'open' })
      for (const item of [pinCase, profileCase, chatCase]) assert.ok(filtered.cases.some(row => row.id === item.id))
      assert.ok(filtered.cases.every(row => row.kind === 'photo'))
      for (const item of [profileCase, chatCase]) {
        await assert.rejects(call('adminReviewCase', { sessionToken, caseId: item.id, status: 'resolved', action: 'hide' }), { status: 'INVALID_ARGUMENT' })
      }
      await call('adminReviewCase', { sessionToken, caseId: pinCase.id, status: 'resolved', action: 'hide', note: 'Internal', reply: 'Photo reviewed' })
      assert.equal((await getDoc(doc(reporter.db, 'posts', postId))).exists(), false)
      assert.deepEqual((await db.doc(`moderationPosts/${postId}`).get()).data().post.photoUrls, photos)
      await call('adminReviewCase', { sessionToken, caseId: pinCase.id, status: 'resolved', action: 'restore', note: 'Internal', reply: 'Restored' })
      assert.deepEqual((await getDoc(doc(reporter.db, 'posts', postId))).data().photoUrls, photos)
    } finally { await call('adminLogout', { sessionToken }) }
  })

  await t.test('reporter sees status and reply; evidence, uploader IDs and internal notes stay private', async () => {
    await assert.rejects(getDoc(doc(reporter.db, 'moderationCases', pinCase.id)), { code: 'permission-denied' })
    const mine = (await call('listMyModerationCases', {}, reporter.bearer)).cases
    const item = mine.find(row => row.id === pinCase.id)
    assert.equal(item.kind, 'photo')
    assert.equal(item.sourceKind, 'pin')
    assert.equal(item.reply, 'Restored')
    for (const key of ['evidence', 'note', 'targetUid', 'targetId', 'reporterUid']) assert.equal(item[key], undefined)
    assert.equal((await call('listMyModerationCases', {}, outsider.bearer)).cases.length, 0)
  })
})
