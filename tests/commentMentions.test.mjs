import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as react from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import * as router from 'react-router-dom'
import ts from 'typescript'
import * as mentions from '../src/lib/commentMentions.ts'

test('mention tokens preserve ranges, dots/underscores, case and repeated names', () => {
  const text = '안녕 (@A.B_1) @a.b_1\n@other!'
  assert.deepEqual(mentions.getMentionUsernames(text), ['a.b_1', 'other'])
  assert.deepEqual(mentions.getMentionTokens(text).map(token => text.slice(token.start, token.end)), ['@A.B_1', '@a.b_1', '@other'])
  assert.deepEqual(mentions.getMentionUsernames('@__proto__ @constructor @a. '), ['__proto__', 'constructor', 'a.'])
})

test('email addresses, URL paths, invalid handles and overly long names remain plain text', () => {
  assert.deepEqual(mentions.getMentionUsernames(`person@example.com https://host/@user hello@user @@user @${'x'.repeat(31)} @한글`), [])
  for (const text of ['person@example', 'https://host/@user', '@' + 'a'.repeat(31)]) assert.equal(mentions.getActiveMention(text, text.length), null)
})

test('autocomplete replaces a whole handle at the caret without dropping suffix text or reopening the menu', () => {
  const text = '함께 @fr.end 갈까요?'
  const active = mentions.getActiveMention(text, 6)
  assert.equal(active.query, 'fr')
  const selected = mentions.insertMention(text, active, 'friend')
  assert.equal(selected.content, '함께 @friend 갈까요?')
  assert.equal(mentions.getActiveMention(selected.content, selected.cursor), null)
  const end = mentions.insertMention('친구 @', mentions.getActiveMention('친구 @', 4), 'friend')
  assert.equal(end.content, '친구 @friend ')
  assert.equal(end.cursor, end.content.length)
})

const source = await readFile(new URL('../src/components/post/CommentContent.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
const component = new SourceTextModule(compiled)
await component.link(specifier => {
  const exports = { react, 'react/jsx-runtime': jsxRuntime, 'react-router-dom': router, '../../lib/commentMentions': mentions }[specifier]
  assert.ok(exports, `Unexpected component dependency: ${specifier}`)
  return new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value) })
})
await component.evaluate()

test('resolved mentions render as safe UID profile links; unresolved and legacy @text remain literal', () => {
  const render = (content, bindings) => renderToStaticMarkup(createElement(router.MemoryRouter, {},
    createElement(component.namespace.CommentContent, { content, mentions: bindings })))
  const html = render('@Alice 와 @unknown <script>alert(1)</script>\n@Alice', { '@alice': 'stable / uid' })
  assert.equal((html.match(/class="comment-mention"/g) || []).length, 2)
  assert.ok(html.includes('href="/people/stable%20%2F%20uid"'))
  assert.ok(html.includes('@unknown'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.doesNotMatch(html, /<script>/)
  assert.doesNotMatch(render('@alice @constructor @__proto__'), /<a/)
})
