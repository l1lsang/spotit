import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import * as react from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import * as icons from 'lucide-react'
import * as router from 'react-router-dom'
import ts from 'typescript'
import * as candidates from '../src/lib/chatCandidates.ts'

async function loadModule(path, dependencies = {}) {
  const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  }).outputText
  const module = new SourceTextModule(code)
  await module.link(specifier => {
    const exports = { react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, 'react-router-dom': router, ...dependencies }[specifier]
    assert.ok(exports, `Unexpected dependency: ${specifier}`)
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    })
  })
  await module.evaluate()
  return module.namespace
}

const unexpected = () => { throw new Error('Unexpected side effect during render') }
const users = [
  { uid: 'jimin', nickname: '지민', username: 'jimin.day', email: 'jimin@example.test', photoURL: '' },
  { uid: 'soo', nickname: '수현', username: 'soohyun', email: 'soo@example.test', photoURL: 'https://example.test/soo.webp' },
  { uid: 'legacy', nickname: '도윤', email: 'doyun@example.test', photoURL: '' },
]

test('candidate search matches nicknames and usernames with or without @, never emails', () => {
  assert.equal(candidates.filterChatCandidates(users, '  '), users)
  assert.deepEqual(candidates.filterChatCandidates(users, '지민').map(user => user.uid), ['jimin'])
  assert.deepEqual(candidates.filterChatCandidates(users, '@SOOHYUN').map(user => user.uid), ['soo'])
  assert.deepEqual(candidates.filterChatCandidates(users, 'example').map(user => user.uid), [])
})

test('only 1:1 rooms mark someone as already chatting', () => {
  const chats = [
    { id: 'a', participantIds: ['me', 'jimin'] },
    { id: 'b', kind: 'direct', participantIds: ['soo', 'me'] },
    { id: 'c', kind: 'group', participantIds: ['me', 'legacy', 'jimin'] },
  ]
  assert.deepEqual([...candidates.getDirectChatPartnerIds(chats, 'me')].sort(), ['jimin', 'soo'])
})

const { NewChatFab } = await loadModule('../src/components/chat/NewChatFab.tsx')
const { DirectChatDialog } = await loadModule('../src/components/chat/DirectChatDialog.tsx', {
  '../../lib/chatCandidates': candidates,
})

test('the floating button starts closed with an accessible name', () => {
  const html = renderToStaticMarkup(react.createElement(NewChatFab, { buttonRef: { current: null }, onGroup: unexpected, onDirect: unexpected }))
  assert.match(html, /class="new-chat-fab"[^>]*aria-label="새 채팅"[^>]*aria-expanded="false"/)
  assert.doesNotMatch(html, /new-chat-backdrop|단체방|1:1 채팅/)
})

const renderDialog = props => renderToStaticMarkup(react.createElement(router.MemoryRouter, null,
  react.createElement(DirectChatDialog, {
    users, loading: false, error: '', chattingUids: new Set(['jimin']),
    onRetry: unexpected, onStart: unexpected, onClose: unexpected, onCreateGroup: unexpected, ...props,
  })))

test('the 1:1 picker lists the people I follow with existing rooms marked and never shows emails', () => {
  const html = renderDialog()
  assert.match(html, /role="dialog"[^>]*aria-modal="true"/)
  assert.match(html, /1:1 채팅 시작/)
  assert.match(html, /팔로잉 3명/)
  assert.equal((html.match(/class="direct-chat-row"/g) || []).length, 3)
  assert.equal((html.match(/class="direct-chat-chip"/g) || []).length, 1)
  assert.match(html, /지민<\/strong><small>@jimin\.day<\/small>[\s\S]*?대화 중/)
  assert.match(html, /<img class="chat-avatar" src="https:\/\/example\.test\/soo\.webp"/)
  assert.match(html, /aria-hidden="true">도<\/span>/)
  assert.doesNotMatch(html, /example\.test(?!\/soo)/)
  assert.match(html, /이미 대화 중인 친구는 기존 채팅방으로 이동해요/)
  assert.match(html, /여러 명과 대화하려면 단체방 만들기/)
})

test('the 1:1 picker shows loading, empty and retryable error states', () => {
  const loading = renderDialog({ loading: true })
  assert.match(loading, /팔로잉 목록을 불러오는 중이에요/)
  assert.doesNotMatch(loading, /direct-chat-row|팔로잉 3명/)
  const empty = renderDialog({ users: [] })
  assert.match(empty, /아직 팔로우한 사람이 없어요/)
  assert.match(empty, /<a[^>]*href="\/people"[^>]*>사람 찾기<\/a>/)
  const failed = renderDialog({ error: '사람 목록을 불러오지 못했습니다.' })
  assert.match(failed, /role="alert"[\s\S]*사람 목록을 불러오지 못했습니다\.[\s\S]*다시 불러오기/)
  assert.doesNotMatch(failed, /direct-chat-row/)
})
