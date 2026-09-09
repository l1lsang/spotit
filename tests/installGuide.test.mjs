import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInstallGuidePreference, getInstallPlatform, INSTALL_GUIDE_SEEN_KEY } from '../src/lib/installGuide.ts'

function storage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}

test('first visit is eligible and remembering the guide survives later sessions', () => {
  const saved = storage()
  const first = createInstallGuidePreference(() => saved)
  assert.equal(first.hasSeen(), false)
  first.remember()
  assert.equal(first.hasSeen(), true)
  assert.equal(saved.getItem(INSTALL_GUIDE_SEEN_KEY), '1')
  assert.equal(createInstallGuidePreference(() => saved).hasSeen(), true)
})

test('people who dismissed the old notice are not prompted again after a week', () => {
  const saved = storage({ 'spotit-install-prompt-dismissed-at': String(Date.now() - 30 * 24 * 60 * 60_000) })
  assert.equal(createInstallGuidePreference(() => saved).hasSeen(), true)
})

test('blocked browser storage does not crash the notice or repeat it in the same session', () => {
  const preference = createInstallGuidePreference(() => { throw new Error('Storage blocked') })
  assert.equal(preference.hasSeen(), false)
  assert.doesNotThrow(() => preference.remember())
  assert.equal(preference.hasSeen(), true)
})

test('storage quota errors still preserve the in-memory dismissal', () => {
  const saved = { getItem: () => null, setItem: () => { throw new Error('Quota exceeded') } }
  const preference = createInstallGuidePreference(() => saved)
  preference.remember()
  assert.equal(preference.hasSeen(), true)
})

test('iPhone and iPadOS desktop user agents receive iOS instructions', () => {
  assert.equal(getInstallPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130.0 Mobile Safari/604.1', 5), 'ios')
  assert.equal(getInstallPlatform('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Version/18.0 Safari/604.1', 5), 'ios')
  assert.equal(getInstallPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15', 5), 'ios')
})

test('Android, Mac Safari and desktop Chromium receive their matching installation paths', () => {
  assert.equal(getInstallPlatform('Mozilla/5.0 (Linux; Android 15) Chrome/130.0 Mobile Safari/537.36', 5), 'android')
  assert.equal(getInstallPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15', 0), 'mac-safari')
  assert.equal(getInstallPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Chrome/130.0 Safari/537.36', 0), 'desktop')
  assert.equal(getInstallPlatform('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0', 0), 'desktop')
})
