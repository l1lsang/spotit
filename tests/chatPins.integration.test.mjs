import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import ts from 'typescript'
import { initializeApp, deleteApp } from 'firebase/app'
import * as firestore from 'firebase/firestore'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apps = []
after(async () => { await Promise.all(apps.map(deleteApp)) })

async function client() {
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
    let module
    const exports = id === 'firebase/firestore' ? firestore : id === resolve(root, 'src/lib/firebase.ts') ? { requireDb: () => db } : null
    if (exports) module = new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { identifier: id })
    else module = new SourceTextModule(ts.transpileModule(await readFile(id, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    }).outputText, { identifier: id })
    modules.set(id, module)
    return module
  }
  const module = await load(resolve(root, 'src/services/chatService.ts'))
  const linker = (specifier, parent) => load(specifier.startsWith('.') ? resolve(dirname(parent.identifier), specifier + '.ts') : specifier)
  await module.link(linker)
  await module.evaluate()
  const users = await load(resolve(root, 'src/services/userService.ts'))
  if (users.status === 'unlinked') await users.link(linker)
  if (users.status !== 'evaluated') await users.evaluate()
  await users.namespace.upsertUserProfile(user)
  await users.namespace.updateUserProfileDetails(user.uid, {
    username: crypto.randomUUID().replaceAll('-', '').slice(0, 25), nickname: '테스트 참여자', bio: '',
  }, { birthDate: '2000-01-01', termsAccepted: true, privacyAccepted: true, locationAccepted: false })
  return { db, uid: user.uid, person: { uid: user.uid, nickname: '테스트 참여자', photoURL: '' }, service: module.namespace }
}

async function setup(group = false) {
  const [a, b] = await Promise.all([client(), client()])
  const chatId = group ? await a.service.createGroupChat(a.person, [b.person], '테스트 방')
    : await a.service.getOrCreateDirectChat(a.person, b.person)
  await Promise.all([a, b].map((c, index) => firestore.setDoc(firestore.doc(c.db, 'chats', chatId, 'messages', `message-${index}`), {
    chatId, uid: c.uid, authorNickname: c.person.nickname, content: `메시지 ${index}`, photoUrl: '', photoName: '', createdAt: firestore.serverTimestamp(),
  })))
  return { a, b, chatId }
}

test('direct and group members share durable pins, concurrent additions, deduplication and unpinning', { timeout: 30000 }, async () => {
  for (const group of [false, true]) {
    const { a, b, chatId } = await setup(group)
    await Promise.all([
      a.service.setChatMessagePinned(chatId, 'message-0', a.uid, true),
      b.service.setChatMessagePinned(chatId, 'message-1', b.uid, true),
    ])
    await b.service.setChatMessagePinned(chatId, 'message-0', b.uid, true)
    const shared = await b.service.getChatById(chatId, b.uid)
    assert.deepEqual([...shared.pinnedMessageIds].sort(), ['message-0', 'message-1'])
    await b.service.setChatMessagePinned(chatId, 'message-0', b.uid, false)
    assert.deepEqual((await a.service.getChatById(chatId, a.uid)).pinnedMessageIds, ['message-1'])
    assert.equal((await firestore.getDoc(firestore.doc(a.db, 'chats', chatId, 'messages', 'message-0'))).data().content, '메시지 0')
  }
})

test('nonmembers cannot read media, pin through the service, or bypass it with a raw room update', { timeout: 30000 }, async () => {
  const { chatId } = await setup()
  const outsider = await client()
  const denied = error => error.code === 'permission-denied'
  await assert.rejects(outsider.service.setChatMessagePinned(chatId, 'message-0', outsider.uid, true), denied)
  await assert.rejects(firestore.updateDoc(firestore.doc(outsider.db, 'chats', chatId), { pinnedMessageIds: ['message-0'] }), denied)
  await assert.rejects(firestore.getDocs(firestore.collection(outsider.db, 'chats', chatId, 'messages')), denied)
})

test('missing and anonymized messages cannot be pinned; stale references can still be removed', { timeout: 30000 }, async () => {
  const { a, chatId } = await setup()
  await assert.rejects(a.service.setChatMessagePinned(chatId, 'missing', a.uid, true), /고정할 수 없는/)
  await a.service.setChatMessagePinned(chatId, 'message-0', a.uid, true)
  await firestore.updateDoc(firestore.doc(a.db, 'chats', chatId, 'messages', 'message-0'), {
    uid: 'deleted-user', authorNickname: '탈퇴한 사용자', content: '탈퇴한 사용자의 메시지입니다.', photoUrl: '', photoName: '',
  })
  await assert.rejects(a.service.setChatMessagePinned(chatId, 'message-0', a.uid, true), /고정할 수 없는/)
  await a.service.setChatMessagePinned(chatId, 'message-0', a.uid, false)
  assert.deepEqual((await a.service.getChatById(chatId, a.uid)).pinnedMessageIds, [])
})

test('pin changes arrive in another participant’s live room subscription', { timeout: 30000 }, async () => {
  const { a, b, chatId } = await setup()
  let unsubscribe = () => {}
  let timer
  const change = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('No pin update received')), 10000)
    unsubscribe = b.service.subscribeToChat(chatId, b.uid, chat => {
      if (chat?.pinnedMessageIds?.includes('message-0')) resolve(chat)
    }, reject)
  })
  try {
    await a.service.setChatMessagePinned(chatId, 'message-0', a.uid, true)
    assert.deepEqual((await change).pinnedMessageIds, ['message-0'])
  } finally { unsubscribe(); clearTimeout(timer) }
})
