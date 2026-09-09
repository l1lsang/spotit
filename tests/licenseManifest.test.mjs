import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hash = value => createHash('sha256').update(value).digest('hex')

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'spotit-license-test-'))
  t.after(() => {
    // Only remove the temporary directory created by this test.
    assert.equal(dirname(directory), resolve(tmpdir()))
    assert.ok(basename(directory).startsWith('spotit-license-test-'))
    rmSync(directory, { recursive: true, force: true })
  })
  for (const path of ['scripts', 'functions', 'src/data']) mkdirSync(join(directory, path), { recursive: true })
  copyFileSync(join(projectRoot, 'scripts/generate-open-source-licenses.mjs'), join(directory, 'scripts/generate-open-source-licenses.mjs'))
  const entry = { version: '1.0.0', integrity: 'sha512-fixture', license: 'MIT' }
  const locks = {
    'package-lock.json': { lockfileVersion: 3, packages: { '': { dependencies: { example: '^1.0.0' } }, 'node_modules/example': entry } },
    'functions/package-lock.json': { lockfileVersion: 3, packages: { '': { dependencies: { server: '^1.0.0' } }, 'node_modules/server': entry } },
  }
  const text = 'A test-only license notice.'
  const textId = hash(text)
  const data = {
    sources: Object.fromEntries(Object.entries(locks).map(([file, lock]) => [file, hash(JSON.stringify(lock))])),
    packages: ['example', 'server'].map((name, i) => ({ ...entry, name, scopes: [i ? 'server' : 'app'], direct: true, documents: [{ textId, source: `${name}@1.0.0/LICENSE` }] })),
    texts: { [textId]: text },
  }
  const manifestPath = join(directory, 'src/data/openSourceLicenses.json')
  return { locks, data, textId, manifestPath, check() {
    for (const [file, lock] of Object.entries(locks)) writeFileSync(join(directory, file), JSON.stringify(lock))
    writeFileSync(manifestPath, JSON.stringify(data))
    return spawnSync(process.execPath, [join(directory, 'scripts/generate-open-source-licenses.mjs'), '--check'], { encoding: 'utf8', timeout: 10000 })
  } }
}

test('license check accepts npm metadata/key-order rewrites without modifying notices', t => {
  const f = fixture(t)
  const entry = f.locks['package-lock.json'].packages['node_modules/example']
  f.locks['package-lock.json'].packages['node_modules/example'] = { peer: true, engines: { node: '>=20' }, ...Object.fromEntries(Object.entries(entry).reverse()) }
  f.locks['functions/package-lock.json'].packages[''].name = 'renamed-service'
  f.data.sources = Object.fromEntries(Object.entries(f.data.sources).reverse())
  const result = f.check()
  assert.equal(result.status, 0, result.stderr)
  assert.equal(readFileSync(f.manifestPath, 'utf8'), JSON.stringify(f.data))
})

test('license check accepts an unchanged manifest', t => {
  const result = fixture(t).check()
  assert.equal(result.status, 0, result.stderr)
})

for (const [name, mutate] of [
  ['added dependency', f => { f.locks['package-lock.json'].packages['node_modules/extra'] = { version: '1.0.0', license: 'MIT' } }],
  ['removed dependency', f => { delete f.locks['functions/package-lock.json'].packages['node_modules/server'] }],
  ['version change', f => { f.locks['package-lock.json'].packages['node_modules/example'] = { ...f.locks['package-lock.json'].packages['node_modules/example'], version: '2.0.0' } }],
  ['artifact integrity change', f => { f.data.packages[0].integrity = 'sha512-different' }],
  ['license declaration change', f => { f.data.packages[0].license = 'Apache-2.0' }],
  ['usage scope change', f => { f.data.packages[1].scopes = ['development'] }],
  ['direct dependency change', f => { f.data.packages[0].direct = false }],
  ['duplicate entry', f => { f.data.packages.push(f.data.packages[0]) }],
  ['missing notices', f => { f.data.packages[0].documents = [] }],
  ['corrupt notice text', f => { f.data.texts[f.textId] = 'Changed without updating its hash' }],
]) {
  test(`license check rejects ${name}`, t => {
    const f = fixture(t)
    mutate(f)
    const result = f.check()
    assert.equal(result.status, 1, result.stdout)
    assert.match(result.stderr, /라이선스/)
  })
}
