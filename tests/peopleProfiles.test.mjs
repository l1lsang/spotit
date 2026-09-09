import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as jsxRuntime from 'react/jsx-runtime'
import * as router from 'react-router-dom'
import ts from 'typescript'

const source = await readFile(new URL('../src/components/profile/UserSummaryLink.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
const summaryModule = new SourceTextModule(compiled)
await summaryModule.link(specifier => {
  const exports = { 'react/jsx-runtime': jsxRuntime, 'react-router-dom': router }[specifier]
  assert.ok(exports, `Unexpected component dependency: ${specifier}`)
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
  })
})
await summaryModule.evaluate()
const { UserSummaryLink } = summaryModule.namespace

const user = {
  uid: 'friend-123', nickname: '산책하는 친구', username: 'walking.friend', photoURL: 'https://example.test/avatar.png',
  email: 'private@example.test', bio: '목록에 보이면 안 되는 소개글', isPrivate: true, followerCount: 987, followingCount: 654,
}
function render(overrides = {}) {
  return renderToStaticMarkup(createElement(router.MemoryRouter, { initialEntries: ['/people?q=walking'] },
    createElement(UserSummaryLink, { user: { ...user, ...overrides }, returnTo: '/people?q=walking' })))
}

test('people rows render only nickname, unique name and avatar with a profile link', () => {
  const html = render()
  assert.match(html, /산책하는 친구/)
  assert.match(html, /@walking\.friend/)
  assert.match(html, /src="https:\/\/example\.test\/avatar\.png"/)
  assert.match(html, /href="\/people\/friend-123"/)
  assert.doesNotMatch(html, /private@example|목록에 보이면|987|654|비공개|팔로워|팔로잉|채팅|신고|<button/)
})

test('legacy users without handles or photos never fall back to their email', () => {
  const html = render({ username: undefined, photoURL: '' })
  assert.match(html, /산책하는 친구/)
  assert.match(html, /profile-avatar/)
  assert.doesNotMatch(html, /private@example|@walking|<img/)
})

test('profile links encode user identifiers and render names as text', () => {
  const html = render({ uid: '친구 / 1', nickname: '<script>name</script>' })
  assert.ok(html.includes(`href="/people/${encodeURIComponent('친구 / 1')}"`))
  assert.match(html, /&lt;script&gt;name&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})
