import assert from 'node:assert/strict'
import test from 'node:test'
import { getExternalMapUrl, isValidLocation } from '../src/lib/mapLocation.ts'
import { clusterPosts } from '../src/lib/mapClusters.ts'

test('Korean cities, islands and overseas pins all open Google Maps at their exact coordinates', () => {
  const korea = [[37.5665, 126.978], [35.1796, 129.0756], [33.4996, 126.5312], [37.4845, 130.9057], [37.2411, 131.8675], [37.966, 124.63]]
  const overseas = [[35.6762, 139.6503], [34.7, 129.45], [34.2, 129.29], [35.1, 129.6], [48.8566, 2.3522], [40.7128, -74.006], [-33.8688, 151.2093], [39.0392, 125.7625]]
  for (const [lat, lng] of [...korea, ...overseas, [0, 0], [-90, -180], [90, 180]]) {
    const url = new URL(getExternalMapUrl({ lat, lng }))
    assert.equal(url.origin, 'https://www.google.com')
    assert.equal(url.pathname, '/maps/search/')
    assert.equal(url.searchParams.get('api'), '1')
    assert.equal(url.searchParams.get('query'), `${lat},${lng}`)
  }
})

test('equator and prime meridian are valid; malformed coordinates are rejected', () => {
  for (const location of [{ lat: 0, lng: 0 }, { lat: 0, lng: 20 }, { lat: 51.5, lng: 0 }]) assert.ok(isValidLocation(location))
  for (const location of [{ lat: NaN, lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: 0, lng: Infinity }]) assert.equal(isValidLocation(location), false)
})

const post = (id, lat, lng) => ({ id, lat, lng })
const project = ({ lat, lng }) => ({ x: lng * 1000, y: lat * 1000 })

test('coincident pins remain grouped at any zoom and every post is preserved', () => {
  const posts = [post('a', 37.5, 127), post('b', 37.5, 127), post('c', 36, 127)]
  const groups = clusterPosts(posts, project)
  assert.deepEqual(groups.map((group) => group.posts.map((item) => item.id)), [['a', 'b'], ['c']])
  assert.deepEqual(clusterPosts(posts, () => null).map((group) => group.posts.length), [2, 1])
  assert.equal(posts.length, 3)
})

test('visually overlapping pins group, then separate when zoomed in', () => {
  const posts = [post('a', 37, 127), post('b', 37.03, 127)]
  assert.equal(clusterPosts(posts, project).length, 1)
  assert.equal(clusterPosts(posts, (location) => { const p = project(location); return { x: p.x * 2, y: p.y * 2 } }).length, 2)
})

test('overlap across neighboring groups is combined without losing entries', () => {
  const groups = clusterPosts([post('a', 0, 0), post('b', 0, 0.06), post('bridge', 0, 0.03)], project)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].posts.length, 3)
})

test('invalid coordinates never reach SDK projection', () => {
  const posts = [post('bad', NaN, 127), post('outside', 90.1, 0), post('valid', 0, 0)]
  const groups = clusterPosts(posts, (location) => { assert.ok(isValidLocation(location)); return project(location) })
  assert.deepEqual(groups[0].posts.map((item) => item.id), ['valid'])
  assert.deepEqual(clusterPosts([], project), [])
})
