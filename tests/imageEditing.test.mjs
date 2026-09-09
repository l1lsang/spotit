import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drawEditedImage, exportEditedImage, getEditableImageError, getExportSize, getImagePlacement, getRotatedSize, INITIAL_IMAGE_EDIT } from '../src/lib/imageEditing.ts'

test('image selection rejects unsupported and oversized files before decoding', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) assert.equal(getEditableImageError({ type, size: 20 * 1024 * 1024 }), '')
  for (const type of ['image/svg+xml', 'text/html', 'image/heic', '']) assert.notEqual(getEditableImageError({ type, size: 100 }), '')
  assert.notEqual(getEditableImageError({ type: 'image/jpeg', size: 20 * 1024 * 1024 + 1 }), '')
})

test('square profile crop centers a landscape image and allows reaching both edges', () => {
  const centered = getImagePlacement(400, 200, 200, 200, INITIAL_IMAGE_EDIT)
  assert.equal(centered.scale, 1)
  assert.equal(centered.offsetX, 0)
  assert.equal(centered.offsetY, 0)
  assert.equal(getImagePlacement(400, 200, 200, 200, { ...INITIAL_IMAGE_EDIT, panX: -1 }).offsetX, -100)
  assert.equal(getImagePlacement(400, 200, 200, 200, { ...INITIAL_IMAGE_EDIT, panX: 1 }).offsetX, 100)
})

test('dragging cannot reveal blank edges for any supported ratio, rotation or zoom', () => {
  for (const [imageWidth, imageHeight] of [[4032, 3024], [3024, 4032], [100, 100], [9000, 100]]) {
    for (const rotation of [0, 90, 180, 270]) {
      const rotated = getRotatedSize(imageWidth, imageHeight, rotation)
      for (const ratio of [1, 4 / 3, 3 / 4, 16 / 9, rotated.width / rotated.height]) {
        for (const zoom of [1, 1.5, 4]) for (const pan of [-3, -1, 0, 1, 3]) {
          const width = 300 * ratio, height = 300
          const p = getImagePlacement(imageWidth, imageHeight, width, height, { ...INITIAL_IMAGE_EDIT, rotation, zoom, panX: pan, panY: pan })
          const left = width / 2 + p.offsetX - rotated.width * p.scale / 2
          const top = height / 2 + p.offsetY - rotated.height * p.scale / 2
          assert.ok(left <= 1e-8 && top <= 1e-8)
          assert.ok(left + rotated.width * p.scale >= width - 1e-8)
          assert.ok(top + rotated.height * p.scale >= height - 1e-8)
        }
      }
    }
  }
})

test('preview and large export use the same source area after rotation, zoom and pan', () => {
  const edit = { rotation: 270, zoom: 2.5, flip: true, panX: -0.4, panY: 0.8 }
  const preview = getImagePlacement(4000, 3000, 400, 300, edit)
  const output = getImagePlacement(4000, 3000, 1600, 1200, edit)
  for (const key of ['scale', 'offsetX', 'offsetY']) assert.ok(Math.abs(output[key] - preview[key] * 4) < 1e-8)
})

test('exports preserve crop ratio, cap large images and do not upscale small crops', () => {
  assert.deepEqual(getExportSize(4000, 3000, 4 / 3, INITIAL_IMAGE_EDIT), { width: 2048, height: 1536 })
  assert.deepEqual(getExportSize(4000, 3000, 1, { ...INITIAL_IMAGE_EDIT, zoom: 4 }), { width: 750, height: 750 })
  assert.deepEqual(getExportSize(160, 90, 16 / 9, INITIAL_IMAGE_EDIT), { width: 160, height: 90 })
  assert.deepEqual(getExportSize(160, 90, 9 / 16, { ...INITIAL_IMAGE_EDIT, rotation: 90 }), { width: 90, height: 160 })
})

function canvasDouble() {
  const calls = []
  const context = Object.fromEntries(['clearRect', 'fillRect', 'save', 'translate', 'scale', 'rotate', 'drawImage', 'restore'].map(name => [name, (...args) => calls.push([name, ...args])]))
  return { calls, context, canvas: { width: 200, height: 200, getContext: () => context } }
}

test('renderer applies screen-horizontal flip and quarter rotation without distorting the image', () => {
  const { canvas, calls } = canvasDouble()
  const image = { width: 400, height: 200 }
  drawEditedImage(canvas, image, { ...INITIAL_IMAGE_EDIT, rotation: 90, flip: true, panY: 1 })
  assert.deepEqual(calls, [
    ['clearRect', 0, 0, 200, 200], ['save'], ['translate', 100, 200], ['scale', -1, 1],
    ['rotate', Math.PI / 2], ['drawImage', image, -200, -100, 400, 200], ['restore'],
  ])
})

test('export creates correctly named files, preserves PNG transparency and shrinks oversized output', async (t) => {
  const { canvas, calls } = canvasDouble()
  const sizes = []
  canvas.toBlob = (callback, type) => {
    sizes.push([canvas.width, canvas.height, type])
    callback(new Blob([new Uint8Array(sizes.length === 1 ? 6 * 1024 * 1024 : 100)], { type }))
  }
  const previousDocument = globalThis.document
  globalThis.document = { createElement: name => { assert.equal(name, 'canvas'); return canvas } }
  t.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument })
  const file = await exportEditedImage({ width: 4000, height: 3000 }, new File(['original'], '사진.png', { type: 'image/png' }), 1, INITIAL_IMAGE_EDIT)
  assert.equal(file.name, '사진-edited.png')
  assert.equal(file.type, 'image/png')
  assert.equal(file.size, 100)
  assert.deepEqual(sizes, [[2048, 2048, 'image/png'], [1638, 1638, 'image/png']])
  assert.equal(calls.some(([name]) => name === 'fillRect'), false)
})

test('failed image encoding rejects without producing an upload file', async (t) => {
  const { canvas } = canvasDouble()
  canvas.toBlob = callback => callback(null)
  const previousDocument = globalThis.document
  globalThis.document = { createElement: () => canvas }
  t.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument })
  await assert.rejects(exportEditedImage({ width: 200, height: 200 }, new File(['image'], 'photo.jpg', { type: 'image/jpeg' }), 1, INITIAL_IMAGE_EDIT), /저장하지 못했습니다/)
})
