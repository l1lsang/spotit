import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createReadCache } from '../src/lib/readCache.ts'
import { compressUploadImage, fitImageSize } from '../src/lib/imageUpload.ts'

test('concurrent reads share a request; expiration, refresh and account changes reload', async () => {
  let time = 0, calls = 0
  const cache = createReadCache(10, () => time)
  const loader = async () => ++calls
  assert.deepEqual(await Promise.all([cache.read('a', loader, 30), cache.read('a', loader, 30)]), [1, 1])
  time = 29
  assert.equal(await cache.read('a', loader, 30), 1)
  time = 30
  assert.equal(await cache.read('a', loader, 30), 2)
  cache.clear()
  assert.equal(await cache.read('a', loader, 30), 3)
})

test('a failed read retries, and a late read cannot restore invalidated account data', async () => {
  const cache = createReadCache()
  await assert.rejects(cache.read('error', async () => { throw new Error('offline') }))
  assert.equal(await cache.read('error', async () => 'online'), 'online')
  let finish
  const pending = cache.read('profile', () => new Promise(resolve => { finish = resolve }))
  await Promise.resolve()
  cache.clear()
  assert.equal(await cache.read('profile', async () => 'new account'), 'new account')
  finish('old account')
  await pending
  assert.equal(await cache.read('profile', async () => 'unexpected'), 'new account')
})

test('read cache bounds retained entries', async () => {
  const cache = createReadCache(2)
  await cache.read('a', async () => 1)
  await cache.read('b', async () => 2)
  await cache.read('c', async () => 3)
  assert.equal(await cache.read('a', async () => 4), 4)
})

test('upload compression limits dimensions, preserves aspect ratio and never upscales', () => {
  assert.deepEqual(fitImageSize(4000, 3000, 1600), { width: 1600, height: 1200 })
  assert.deepEqual(fitImageSize(3000, 4000, 384), { width: 288, height: 384 })
  assert.deepEqual(fitImageSize(100, 80, 384), { width: 100, height: 80 })
})

test('upload encoding preserves transparency, releases bitmaps and names the actual format', async t => {
  let closed = 0, drawn
  const previousBitmap = globalThis.createImageBitmap
  const previousDocument = globalThis.document
  globalThis.createImageBitmap = async () => ({ width: 4000, height: 3000, close: () => closed++ })
  t.after(() => {
    if (previousBitmap === undefined) delete globalThis.createImageBitmap
    else globalThis.createImageBitmap = previousBitmap
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  })
  const canvas = {
    getContext: () => ({ drawImage: (...args) => { drawn = args }, imageSmoothingEnabled: false, imageSmoothingQuality: 'low' }),
    toBlob: (callback, type) => callback(new Blob(['small'], { type })),
  }
  globalThis.document = { createElement: () => canvas }
  const file = new File(['image'], 'photo.png', { type: 'image/png' })
  const result = await compressUploadImage(file)
  assert.equal(result.type, 'image/webp')
  assert.equal(result.name, 'photo.webp')
  assert.equal(canvas.width, 1600)
  assert.equal(canvas.height, 1200)
  assert.deepEqual(drawn.slice(1), [0, 0, 1600, 1200])
  assert.equal(closed, 1)
})

test('GIF uploads keep animation and an unavailable decoder preserves the source', async () => {
  const gif = new File(['GIF'], 'moving.gif', { type: 'image/gif' })
  assert.equal(await compressUploadImage(gif), gif)
})
