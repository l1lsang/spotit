import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_POST_PIN_COLOR, FOLLOWING_PIN_COLOR, getPinThemeError, getPostMarkerColor, getPostPinColor, normalizePinColor } from '../src/types/post.ts'

test('custom colors survive normalization and malformed values use a safe default', () => {
  assert.equal(normalizePinColor('#12ABef'), '#12abef')
  assert.equal(normalizePinColor('#000000'), '#000000')
  for (const value of [undefined, null, 3, '', '#12', 'red', 'url(example.test)', '__proto__', 'constructor']) {
    assert.equal(normalizePinColor(value), DEFAULT_POST_PIN_COLOR)
  }
})

test('existing records retain their original seven colors without pre-populating themes', () => {
  const expected = { default: '#e8674f', cafe: '#2b756d', food: '#bc7a1f', study: '#297e99', date: '#c44b6a', solo: '#6d7f42', walk: '#4f5f9f' }
  for (const [oldId, color] of Object.entries(expected)) assert.equal(normalizePinColor(oldId), color)
})

test('following pins stay fixed even when their color or theme matches my themes', () => {
  const themes = [{ id: 'travel', name: '여행', color: '#2266aa' }]
  const post = { uid: 'following', pinColor: '#112233', pinThemeId: 'travel' }
  assert.equal(getPostMarkerColor(post, 'me', themes), FOLLOWING_PIN_COLOR)
  assert.equal(getPostMarkerColor(post, undefined, themes), FOLLOWING_PIN_COLOR)
  assert.equal(getPostMarkerColor({ ...post, uid: 'me' }, 'me', themes), '#2266aa')
})

test('theme edits update my themed pins; direct colors and missing themes retain their saved color', () => {
  const themes = [{ id: 'travel', name: '여행', color: '#2266aa' }]
  const post = { pinColor: '#112233', pinThemeId: 'travel' }
  assert.equal(getPostPinColor(post, themes), '#2266aa')
  assert.equal(getPostPinColor(post, [{ ...themes[0], color: '#445566' }]), '#445566')
  assert.equal(getPostPinColor(post, []), '#112233')
  assert.equal(getPostPinColor({ ...post, pinThemeId: '' }, themes), '#112233')
})

test('custom themes require a name, stable ID, and a valid color', () => {
  const theme = { id: 'custom-theme-1', name: '나의 장소', color: '#12ABEF' }
  assert.equal(getPinThemeError(theme), '')
  assert.equal(getPinThemeError({ ...theme, name: '가'.repeat(18) }), '')
  for (const change of [{ name: '   ' }, { name: '가'.repeat(19) }, { id: '' }, { id: 'path/id' }, { color: '#fff' }, { color: 'transparent' }]) {
    assert.notEqual(getPinThemeError({ ...theme, ...change }), '')
  }
})
