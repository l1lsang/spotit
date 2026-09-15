import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createContext, SourceTextModule } from 'node:vm'
import ts from 'typescript'

async function loadSearch(searchByText, env = {}) {
  const libraries = []
  const window = searchByText ? { google: { maps: {
    importLibrary: async library => { libraries.push(library) },
    places: { Place: { searchByText } },
  } } } : {}
  const context = createContext({ window })
  const modules = new Map()
  async function load(url) {
    if (modules.has(url.href)) return modules.get(url.href)
    const code = ts.transpileModule(await readFile(url, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    }).outputText
    const module = new SourceTextModule(code, {
      context, identifier: url.href,
      initializeImportMeta(meta) { meta.env = env },
    })
    modules.set(url.href, module)
    await module.link((specifier, parent) => load(new URL(`${specifier}.ts`, parent.identifier)))
    return module
  }
  const module = await load(new URL('../src/lib/placeSearch.ts', import.meta.url))
  await module.evaluate()
  return { searchPlaces: module.namespace.searchPlaces, libraries }
}

const coordinates = (lat, lng) => ({ lat: () => lat, lng: () => lng })

test('domestic and overseas searches use Google Places and preserve the selected place coordinates', async () => {
  const requests = []
  const { searchPlaces, libraries } = await loadSearch(async request => {
    requests.push(request)
    return { places: [{ id: 'place-id', displayName: request.textQuery,
      formattedAddress: '선택한 주소', location: coordinates(request.locationBias.center.lat, request.locationBias.center.lng) },
    { id: 'no-location', displayName: '좌표 없는 장소' }] }
  })
  for (const [keyword, center] of [
    ['서울숲', { lat: 37.5445, lng: 127.0374 }],
    ['Eiffel Tower', { lat: 48.8584, lng: 2.2945 }],
  ]) {
    const results = await searchPlaces(`  ${keyword}  `, center)
    assert.equal(results.length, 1)
    assert.equal(results[0].id, 'google:place-id')
    assert.equal(results[0].name, keyword)
    assert.equal(results[0].address, '선택한 주소')
    assert.equal(results[0].location.lat, center.lat)
    assert.equal(results[0].location.lng, center.lng)
    const request = requests.at(-1)
    assert.equal(request.textQuery, keyword)
    assert.equal(request.language, 'ko')
    assert.equal(request.locationBias.center, center)
    for (const field of ['id', 'displayName', 'formattedAddress', 'location']) assert.ok(request.fields.includes(field))
  }
  assert.equal(requests.length, 2)
  assert.deepEqual(libraries, ['places', 'places'])
})

test('repeated searches share requests while different centers have separate results', async () => {
  let count = 0
  const { searchPlaces } = await loadSearch(async () => {
    count += 1
    return { places: [{ id: String(count), location: coordinates(0, 0) }] }
  })
  const center = { lat: 37.5665, lng: 126.978 }
  const [first, duplicate] = await Promise.all([searchPlaces('카페', center), searchPlaces(' 카페 ', center)])
  assert.equal(count, 1)
  assert.equal(first, duplicate)
  assert.equal(first[0].name, '카페')
  assert.equal(first[0].address, '')
  await searchPlaces('카페', { lat: 35.1796, lng: 129.0756 })
  assert.equal(count, 2)
})

test('failed Google searches can be retried and empty results do not trigger another provider', async () => {
  let count = 0
  const { searchPlaces } = await loadSearch(async () => {
    if (++count === 1) throw new Error('Places unavailable')
    return { places: [] }
  })
  const center = { lat: 37.5665, lng: 126.978 }
  await assert.rejects(searchPlaces('없는 장소', center), /Places unavailable/)
  assert.equal((await searchPlaces('없는 장소', center)).length, 0)
  assert.equal((await searchPlaces('없는 장소', center)).length, 0)
  assert.equal(count, 2)
})

test('blank searches need no SDK and missing Google configuration produces a readable error', async () => {
  const { searchPlaces } = await loadSearch()
  const center = { lat: 37.5665, lng: 126.978 }
  assert.equal((await searchPlaces('  ', center)).length, 0)
  await assert.rejects(searchPlaces('서울숲', center), /지도가 아직 준비되지 않았습니다/)
})
