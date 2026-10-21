import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import * as react from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import * as icons from 'lucide-react'
import ts from 'typescript'
import * as dateLib from '../src/lib/date.ts'
import * as imageEditing from '../src/lib/imageEditing.ts'
import * as mapLocation from '../src/lib/mapLocation.ts'
import * as postTypes from '../src/types/post.ts'
import {
  findExifTiff, hasPhotoMetadata, parseExifDateTime, parsePhotoMetadata, redactPhotoLocation, summarizePhotoMetadata,
} from '../src/lib/photoMetadata.ts'
import { compressUploadImage } from '../src/lib/imageUpload.ts'

const ascii = text => [...text].map(char => char.charCodeAt(0))
const EXIF_HEADER = [...ascii('Exif'), 0, 0]
const TYPE_IDS = { ascii: 2, short: 3, long: 4, rational: 5 }
const TYPE_SIZES = { ascii: 1, short: 2, long: 4, rational: 8 }

// Writes IFDs in order; a long value given as a name points at that IFD.
function buildTiff(groups, little = true) {
  const bytes = new Uint8Array(4096)
  const view = new DataView(bytes.buffer)
  bytes.set(ascii(little ? 'II' : 'MM'))
  view.setUint16(2, 42, little)
  view.setUint32(4, 8, little)
  const offsets = {}
  let cursor = 8
  for (const [name, entries] of groups) {
    offsets[name] = cursor
    cursor += 2 + entries.length * 12 + 4
  }
  let data = cursor
  for (const [name, entries] of groups) {
    let position = offsets[name]
    view.setUint16(position, entries.length, little)
    position += 2
    for (const { tag, type, value } of entries) {
      const raw = type === 'ascii' ? [...ascii(value), 0] : value
      const count = type === 'rational' ? raw.length / 2 : raw.length
      const size = TYPE_SIZES[type] * count
      view.setUint16(position, tag, little)
      view.setUint16(position + 2, TYPE_IDS[type], little)
      view.setUint32(position + 4, count, little)
      let target = position + 8
      if (size > 4) {
        view.setUint32(position + 8, data, little)
        target = data
        data += size + (size % 2)
      }
      raw.forEach((item, index) => {
        if (type === 'ascii') bytes[target + index] = item
        else if (type === 'short') view.setUint16(target + index * 2, item, little)
        else view.setUint32(target + index * 4, typeof item === 'string' ? offsets[item] : item, little)
      })
      position += 12
    }
  }
  return bytes.slice(0, data)
}

const SEOUL = { lat: [37, 1, 34, 1, 865, 100], lng: [126, 1, 58, 1, 2556, 100] }
const expectedLat = 37 + 34 / 60 + 8.65 / 3600
const expectedLng = 126 + 58 / 60 + 25.56 / 3600

function sampleTiff({ little = true, gps = SEOUL, latRef = 'N', lngRef = 'E', original = '2026:10:17 16:32:05', offset = '+09:00' } = {}) {
  const exif = [{ tag: 0x9003, type: 'ascii', value: original }]
  if (offset) exif.push({ tag: 0x9011, type: 'ascii', value: offset })
  const ifd0 = [
    { tag: 0x0112, type: 'short', value: [6] },
    { tag: 0x0132, type: 'ascii', value: '2026:10:20 09:00:00' },
    { tag: 0x8769, type: 'long', value: ['exif'] },
  ]
  const groups = [['ifd0', ifd0], ['exif', exif]]
  if (gps) {
    ifd0.push({ tag: 0x8825, type: 'long', value: ['gps'] })
    groups.push(['gps', [
      { tag: 1, type: 'ascii', value: latRef }, { tag: 2, type: 'rational', value: gps.lat },
      { tag: 3, type: 'ascii', value: lngRef }, { tag: 4, type: 'rational', value: gps.lng },
    ]])
  }
  return buildTiff(groups, little)
}

const segment = (marker, payload) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload]
const XMP_SEGMENT = segment(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0, ...ascii('<x:xmpmeta exif:GPSLatitude="37,34.1N"/>')])
const SCAN = [0xff, 0xda, 0, 4, 1, 2, 9, 8, 7, 0xff, 0xd9]

function jpeg(tiff, { xmp = false } = {}) {
  return new Uint8Array([
    0xff, 0xd8,
    ...segment(0xe0, [...ascii('JFIF'), 0]),
    ...(tiff ? segment(0xe1, [...EXIF_HEADER, ...tiff]) : []),
    ...(xmp ? XMP_SEGMENT : []),
    ...segment(0xdb, [0, 1, 2]),
    ...SCAN,
  ])
}

const be32 = value => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]
const le32 = value => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]
const pngChunk = (type, data) => [...be32(data.length), ...ascii(type), ...data, 0, 0, 0, 0]
const png = tiff => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ...pngChunk('IHDR', new Array(13).fill(1)), ...pngChunk('eXIf', [...tiff]), ...pngChunk('IDAT', [1, 2, 3]), ...pngChunk('IEND', [])])
const riffChunk = (type, data) => [...ascii(type), ...le32(data.length), ...data, ...(data.length % 2 ? [0] : [])]

function webp(tiff) {
  const body = [
    ...riffChunk('VP8X', [0x0c, 0, 0, 0, 1, 0, 0, 1, 0, 0]),
    ...riffChunk('VP8 ', [9, 9, 9]),
    ...riffChunk('EXIF', [...EXIF_HEADER, ...tiff]),
    ...riffChunk('XMP ', ascii('<x:xmpmeta/>')),
  ]
  return new Uint8Array([...ascii('RIFF'), ...le32(body.length + 4), ...ascii('WEBP'), ...body])
}

test('JPEG EXIF gives the GPS position and the capture time in either byte order', () => {
  const little = parsePhotoMetadata(jpeg(sampleTiff()))
  assert.ok(Math.abs(little.location.lat - expectedLat) < 1e-9)
  assert.ok(Math.abs(little.location.lng - expectedLng) < 1e-9)
  assert.equal(little.takenAt.dateKey, '2026-10-17')
  assert.equal(little.takenAt.time, '16:32')
  assert.equal(little.takenAt.sortValue, Date.UTC(2026, 9, 17, 7, 32, 5))

  const southWest = parsePhotoMetadata(jpeg(sampleTiff({ little: false, latRef: 'S', lngRef: 'W', offset: '' })))
  assert.ok(Math.abs(southWest.location.lat + expectedLat) < 1e-9)
  assert.ok(Math.abs(southWest.location.lng + expectedLng) < 1e-9)
  assert.equal(southWest.takenAt.sortValue, new Date(2026, 9, 17, 16, 32, 5).getTime())
})

test('PNG and WebP photos carry the same EXIF block', () => {
  for (const bytes of [png(sampleTiff()), webp(sampleTiff({ little: false }))]) {
    const metadata = parsePhotoMetadata(bytes)
    assert.ok(Math.abs(metadata.location.lat - expectedLat) < 1e-9)
    assert.equal(metadata.takenAt.dateKey, '2026-10-17')
  }
})

test('missing, placeholder or impossible values are ignored instead of guessed', () => {
  assert.deepEqual(parsePhotoMetadata(jpeg(null)), { location: null, takenAt: null })
  assert.deepEqual(parsePhotoMetadata(new Uint8Array(ascii('not an image'))), { location: null, takenAt: null })
  assert.equal(parsePhotoMetadata(jpeg(sampleTiff({ gps: null }))).location, null)
  assert.equal(parsePhotoMetadata(jpeg(sampleTiff({ gps: { lat: [0, 1, 0, 1, 0, 1], lng: [0, 1, 0, 1, 0, 1] } }))).location, null)
  assert.equal(parsePhotoMetadata(jpeg(sampleTiff({ gps: { lat: [37, 0, 0, 1, 0, 1], lng: SEOUL.lng } }))).location, null)
  // An impossible original date falls back to the file's last-modified EXIF date.
  assert.equal(parsePhotoMetadata(jpeg(sampleTiff({ original: '2026:02:31 10:00:00' }))).takenAt.dateKey, '2026-10-20')
  assert.equal(parseExifDateTime('0000:00:00 00:00:00'), null)
  assert.equal(parseExifDateTime('2026:10:17 24:10:00'), null)
  assert.deepEqual(parseExifDateTime('2026:01:02 03:04'), { dateKey: '2026-01-02', time: '03:04', sortValue: new Date(2026, 0, 2, 3, 4).getTime() })
})

test('truncated or corrupt files never throw while reading metadata', () => {
  const bytes = jpeg(sampleTiff(), { xmp: true })
  for (let length = 0; length <= bytes.length; length += 1) {
    assert.doesNotThrow(() => parsePhotoMetadata(bytes.slice(0, length)))
    assert.doesNotThrow(() => redactPhotoLocation(bytes.slice(0, length)))
  }
  const noisy = bytes.slice()
  for (let index = 20; index < noisy.length; index += 7) noisy[index] = 0xff
  assert.doesNotThrow(() => parsePhotoMetadata(noisy))
})

test('the first located photo places the pin and the earliest capture at that place sets the date', () => {
  const at = (dateKey, time, sortValue) => ({ dateKey, time, sortValue })
  const home = { lat: 37.5691, lng: 126.9804 }
  const summary = summarizePhotoMetadata([
    { location: null, takenAt: at('2026-10-12', '13:15', 500) },
    { location: home, takenAt: at('2026-10-17', '16:40', 2000) },
    { location: { lat: 37.5736, lng: 126.9804 }, takenAt: at('2026-10-17', '16:32', 1000) },
    { location: { lat: 37.5694, lng: 126.9806 }, takenAt: at('2026-10-17', '18:00', 3000) },
  ])
  assert.deepEqual(summary.location, home)
  assert.equal(summary.locationIndex, 1)
  // An earlier photo from another day or about 500m away does not move the record's date.
  assert.equal(summary.takenAt.dateKey, '2026-10-17')
  assert.equal(summary.takenAt.time, '16:40')
  assert.equal(summary.missingLocationCount, 1)
  // About 500m north counts as another place; about 40m does not.
  assert.equal(summary.distantPhotoCount, 1)
  // Without any date at the pin, the earliest date in the selection is used.
  assert.equal(summarizePhotoMetadata([{ location: home, takenAt: null }, { location: null, takenAt: at('2026-10-12', '09:00', 1) }]).takenAt.time, '09:00')
  assert.deepEqual(summarizePhotoMetadata([{ location: null, takenAt: null }]),
    { location: null, locationIndex: -1, takenAt: null, missingLocationCount: 1, distantPhotoCount: 0 })
})

test('location redaction removes GPS and XMP but keeps orientation, dates and image data', () => {
  const original = jpeg(sampleTiff(), { xmp: true })
  const redacted = redactPhotoLocation(original)
  const metadata = parsePhotoMetadata(redacted)
  assert.equal(metadata.location, null)
  assert.equal(metadata.takenAt.dateKey, '2026-10-17')
  assert.equal(redacted.length, original.length - XMP_SEGMENT.length)
  assert.ok(!Buffer.from(redacted).includes('ns.adobe.com'))
  assert.deepEqual([...redacted.slice(-SCAN.length)], SCAN)
  const before = findExifTiff(original)
  const after = findExifTiff(redacted)
  // IFD0 (orientation, date and pointers) is untouched.
  assert.deepEqual([...after.slice(0, 8 + 2 + 4 * 12)], [...before.slice(0, 8 + 2 + 4 * 12)])
  assert.ok(hasPhotoMetadata(redacted))
  assert.equal(original[0], 0xff, 'the source buffer is not modified')
  assert.ok(parsePhotoMetadata(original).location)

  const cleanWebp = redactPhotoLocation(webp(sampleTiff()))
  assert.equal(parsePhotoMetadata(cleanWebp).location, null)
  assert.equal(new DataView(cleanWebp.buffer).getUint32(4, true), cleanWebp.length - 8)
  assert.equal(cleanWebp[20], 0x08, 'VP8X keeps the EXIF flag and drops the XMP flag')
  assert.ok(!Buffer.from(cleanWebp).includes('XMP '))
  assert.equal(parsePhotoMetadata(redactPhotoLocation(png(sampleTiff()))).location, null)
})

function mockCanvas(t, blobBytes) {
  const previousBitmap = globalThis.createImageBitmap
  const previousDocument = globalThis.document
  globalThis.createImageBitmap = async () => ({ width: 800, height: 600, close() {} })
  globalThis.document = { createElement: () => ({
    getContext: () => ({ drawImage() {} }),
    toBlob: (callback, type) => callback(new Blob([new Uint8Array(blobBytes)], { type })),
  }) }
  t.after(() => {
    if (previousBitmap === undefined) delete globalThis.createImageBitmap
    else globalThis.createImageBitmap = previousBitmap
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  })
}

test('uploads never send an original that still carries metadata', async t => {
  const larger = 4096
  mockCanvas(t, larger)
  const located = new File([jpeg(sampleTiff())], 'small.jpg', { type: 'image/jpeg' })
  const reencoded = await compressUploadImage(located)
  assert.notEqual(reencoded, located)
  assert.equal(reencoded.type, 'image/webp')
  const plain = new File([jpeg(null)], 'plain.jpg', { type: 'image/jpeg' })
  assert.equal(await compressUploadImage(plain), plain)
})

test('without a decoder the original is kept but its GPS block is blanked', async t => {
  const previousBitmap = globalThis.createImageBitmap
  delete globalThis.createImageBitmap
  t.after(() => { if (previousBitmap !== undefined) globalThis.createImageBitmap = previousBitmap })
  const file = new File([jpeg(sampleTiff())], 'photo.jpg', { type: 'image/jpeg', lastModified: 42 })
  const result = await compressUploadImage(file)
  assert.equal(result.type, 'image/jpeg')
  assert.equal(result.name, 'photo.jpg')
  const metadata = parsePhotoMetadata(new Uint8Array(await result.arrayBuffer()))
  assert.equal(metadata.location, null)
  assert.equal(metadata.takenAt.dateKey, '2026-10-17')
})

test('capture dates read naturally in Korean', () => {
  assert.equal(dateLib.formatDateKeyWithWeekday('2026-10-17'), '2026년 10월 17일 (토)')
  assert.equal(dateLib.formatDateKeyWithWeekday('2026-10-12'), '2026년 10월 12일 (월)')
  assert.equal(dateLib.formatClockTime('16:32'), '오후 4:32')
  assert.equal(dateLib.formatClockTime('00:05'), '오전 12:05')
  assert.equal(dateLib.formatClockTime('12:00'), '오후 12:00')
})

async function loadModule(path, dependencies = {}) {
  const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  }).outputText
  const module = new SourceTextModule(code)
  await module.link(specifier => {
    const exports = { react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, ...dependencies }[specifier]
      ?? (specifier.endsWith('.css') ? {} : undefined)
    assert.ok(exports, `Unexpected dependency: ${specifier}`)
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    })
  })
  await module.evaluate()
  return module.namespace
}

const unexpected = () => { throw new Error('Unexpected side effect during render') }
let nearby = { loading: false, places: [] }
const flowUi = await loadModule('../src/components/map/PhotoRecordFlow.tsx', {
  '../../lib/date': dateLib,
  '../../lib/imageEditing': imageEditing,
  '../../lib/placeSearch': { searchPlaces: unexpected },
  '../../hooks/usePhotoRecordFlow': { useNearbyPlaces: () => nearby },
})

const takenAt = { dateKey: '2026-10-17', time: '16:32', sortValue: 1 }
const photo = (name, metadata) => ({ id: name, file: { name }, url: `blob:${name}`, metadata })
const located = { location: { lat: 37.56912, lng: 126.98041 }, takenAt }
const handlers = {
  getSearchCenter: () => located.location, locating: false, onBack: unexpected, onConfirm: unexpected, onAdjust: unexpected,
  onReturnToPhotoLocation: unexpected, onPlaceHere: unexpected, onUseCurrentLocation: unexpected, onSelectPlace: unexpected,
}
const renderSheet = flow => renderToStaticMarkup(react.createElement(flowUi.PhotoRecordSheet, { ...handlers, flow }))

test('reading shows each photo as its metadata arrives', () => {
  const html = renderSheet({ step: 'reading', locateReason: 'missing', summary: null, searchedPlace: null,
    items: [photo('IMG_4021.JPG', located), photo('IMG_4025.JPG', null)] })
  assert.match(html, /사진 정보를 읽고 있어요/)
  assert.match(html, /aria-valuenow="1"/)
  assert.match(html, /1 \/ 2/)
  assert.match(html, /위치 있음/)
  assert.match(html, /10\.17 오후 4:32/)
  assert.match(html, /위치 · 날짜 읽는 중…/)
  assert.match(html, /원본의 위치 정보는 지워져요/)
})

test('a located photo asks to confirm the nearest place, capture time and photo notes', () => {
  const summary = { location: located.location, locationIndex: 0, takenAt, missingLocationCount: 1, distantPhotoCount: 0 }
  const flow = { step: 'confirm', locateReason: 'missing', summary, searchedPlace: null,
    items: [photo('a.jpg', located), photo('b.jpg', located), photo('c.jpg', { location: null, takenAt: null })] }
  nearby = { loading: true, places: [] }
  assert.match(renderSheet(flow), /주변 장소를 찾는 중…/)
  nearby = { loading: false, places: [{ id: 'p', name: '청계천 광통교', address: '서울 종로구 청계천로 85', location: located.location }] }
  const html = renderSheet(flow)
  assert.match(html, /이 장소에 핀을 찍을까요\?/)
  assert.match(html, /청계천 광통교/)
  assert.match(html, /서울 종로구 청계천로 85/)
  assert.match(html, /2026년 10월 17일 \(토\) 오후 4:32/)
  assert.match(html, /이 장소에서 가장 먼저 찍은 시간/)
  assert.match(html, /1장은 위치 정보가 없어 대표 사진의 위치를 사용해요/)
  assert.match(html, /위치 조정/)
  assert.match(html, /이 위치로 기록하기/)
  nearby = { loading: false, places: [] }
  assert.match(renderSheet({ ...flow, summary: { ...summary, distantPhotoCount: 2 } }), /2장은 다른 장소에서 찍은 사진이에요/)
  assert.match(renderSheet(flow), /사진을 찍은 위치/)
})

test('photos without GPS ask for a manual pin and keep the capture date', () => {
  const missing = renderSheet({ step: 'locate', locateReason: 'missing', searchedPlace: null,
    summary: { location: null, locationIndex: -1, takenAt, missingLocationCount: 1, distantPhotoCount: 0 },
    items: [photo('kakao.jpg', { location: null, takenAt })] })
  assert.match(missing, /이 사진엔 위치 정보가 없어요/)
  assert.match(missing, /장소 이름이나 주소로 검색/)
  assert.match(missing, /날짜는 사진 촬영일로 입력돼요/)
  assert.match(missing, /현재 위치/)
  assert.match(missing, /여기에 핀 찍기/)
  const undated = renderSheet({ step: 'locate', locateReason: 'missing', searchedPlace: null,
    summary: { location: null, locationIndex: -1, takenAt: null, missingLocationCount: 2, distantPhotoCount: 0 },
    items: [photo('a.png', { location: null, takenAt: null }), photo('b.png', { location: null, takenAt: null })] })
  assert.match(undated, /사진에 위치 정보가 없어요/)
  assert.match(undated, /오늘 날짜로 입력되고/)
  const adjust = renderSheet({ step: 'locate', locateReason: 'adjust', searchedPlace: null,
    summary: { location: located.location, locationIndex: 0, takenAt, missingLocationCount: 0, distantPhotoCount: 0 },
    items: [photo('a.jpg', located)] })
  assert.match(adjust, /핀 위치를 맞춰주세요/)
  assert.match(adjust, /사진 위치로/)
  assert.doesNotMatch(adjust, /위치 정보 없음/)
})

test('the launcher offers the photo picker with a first-use tip or a selection error', () => {
  const render = props => renderToStaticMarkup(react.createElement(flowUi.PhotoRecordLauncher, { onSelect: unexpected, ...props }))
  const html = render()
  assert.match(html, /사진으로 기록/)
  assert.match(html, /사진만 올리면 위치·날짜가 자동으로 채워져요/)
  assert.match(html, /type="file"[^>]*accept="image\/jpeg,image\/png,image\/webp,image\/gif"[^>]*multiple/)
  assert.doesNotMatch(render({ hideTip: true }), /자동으로 채워져요/)
  const error = render({ error: 'a.heic: JPG, PNG, WebP, GIF 이미지를 선택해 주세요.' })
  assert.match(error, /role="alert"/)
  assert.doesNotMatch(error, /자동으로 채워져요/)
})

let uploaderProps
const { PostFormModal } = await loadModule('../src/components/post/PostFormModal.tsx', {
  '../../lib/date': dateLib,
  '../../lib/mapLocation': mapLocation,
  '../../hooks/useAuth': { useAuth: () => ({ profile: null }) },
  '../../hooks/useGroups': { useGroups: () => ({ groups: [], joinedIds: [], loading: false, error: '', retry: unexpected }) },
  '../../hooks/usePhotoRecordFlow': { useNearbyPlaces: () => nearby },
  '../../contexts/locationConsentCore': { useLocationConsent: () => unexpected },
  '../../types/post': postTypes,
  './PhotoUploader': { PhotoUploader: props => { uploaderProps = props; return null } },
  './PinThemePicker': { PinThemePicker: () => null },
})

test('the record form starts from the photo date, place and location', () => {
  const first = { name: 'a.jpg' }, second = { name: 'b.jpg' }
  const prefill = { files: [first, second], filesWithoutLocation: [second], location: located.location, source: 'photo', takenAt,
    place: { id: 'p', name: '청계천 광통교', address: '서울 종로구 청계천로 85', location: located.location } }
  nearby = { loading: false, places: [prefill.place, { id: 'q', name: '청계광장', address: '서울 중구', location: located.location }] }
  const html = renderToStaticMarkup(react.createElement(PostFormModal, {
    isOpen: true, mode: 'create', location: located.location, photoPrefill: prefill,
    onClose: unexpected, onChangeLocation: unexpected, onSubmit: unexpected,
  }))
  assert.match(html, /사진으로 기록하기/)
  assert.match(html, /type="date"[^>]*value="2026-10-17"/)
  assert.match(html, /사진 촬영일/)
  assert.match(html, /사진을 찍은 날로 자동 입력됐어요 \(오후 4:32\)/)
  assert.match(html, /value="청계천 광통교"/)
  assert.match(html, /주변 장소 추천/)
  assert.match(html, /<button[^>]*aria-pressed="true"[^>]*>청계천 광통교<\/button>/)
  assert.match(html, /<button[^>]*aria-pressed="false"[^>]*>청계광장<\/button>/)
  assert.match(html, /사진을 찍은 위치/)
  assert.match(html, /좌표 37\.56912, 126\.98041/)
  assert.match(html, /위치 변경/)
  assert.match(html, /공개 범위를 한 번 더 확인해 주세요/)
  assert.doesNotMatch(html, /<textarea[^>]*required/)
  assert.match(html, /핀 찍고 기록 저장/)
  assert.match(renderToStaticMarkup(react.createElement(react.Fragment, null, uploaderProps.badgeFor(first))), /대표/)
  assert.match(renderToStaticMarkup(react.createElement(react.Fragment, null, uploaderProps.badgeFor(second))), /위치 없음/)

  const regular = renderToStaticMarkup(react.createElement(PostFormModal, {
    isOpen: true, mode: 'create', location: located.location, onClose: unexpected, onSubmit: unexpected,
  }))
  assert.match(regular, /오늘의 장소를 남겨요/)
  assert.match(regular, /<textarea[^>]*required/)
  assert.doesNotMatch(regular, /사진 촬영일|주변 장소 추천|위치 변경/)
  assert.equal(uploaderProps.badgeFor, undefined)
})
