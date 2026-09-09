import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as jsxRuntime from 'react/jsx-runtime'
import * as router from 'react-router-dom'
import * as icons from 'lucide-react'
import ts from 'typescript'

async function loadModule(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  }).outputText
  const module = new SourceTextModule(compiled)
  await module.link(specifier => {
    const exports = dependencies[specifier]
    assert.ok(exports, `Unexpected dependency: ${specifier}`)
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    })
  })
  await module.evaluate()
  return module.namespace
}

const access = await loadModule('../src/lib/profilePinAccess.ts')
const { PinAlbumGrid } = await loadModule('../src/components/profile/PinAlbumGrid.tsx', {
  'react/jsx-runtime': jsxRuntime, 'react-router-dom': router, 'lucide-react': icons,
})

function pin(id, visibility, createdAt = 1, uid = 'owner') {
  return { id, uid, visibility, title: `기록 ${id}`, placeName: '한강 공원', photoUrls: [], createdAt: { toMillis: () => createdAt } }
}

const records = [pin('public', 'public', 1), pin('followers', 'followers', 2), pin('private', 'private', 3), pin('other', 'public', 4, 'someone-else')]

async function service({ owner = { uid: 'owner', isPrivate: false }, following = false, posts = records } = {}) {
  const reads = { profiles: 0, follows: 0, queries: [] }
  const unexpected = () => { throw new Error('Unexpected read or mutation') }
  const api = await loadModule('../src/services/postService.ts', {
    'firebase/firestore': {
      collection: (_db, path) => path,
      where: (field, operator, value) => ({ field, operator, value }),
      query: (path, ...constraints) => ({ path, constraints }),
      getDocs: async query => {
        reads.queries.push(query)
        assert.equal(query.path, 'posts')
        return { docs: posts.filter(post => query.constraints.every(({ field, operator, value }) =>
          operator === 'in' ? value.includes(post[field]) : post[field] === value,
        )).map(post => ({ id: post.id, data: () => post })) }
      },
      deleteDoc: unexpected, doc: unexpected, getDoc: unexpected, serverTimestamp: unexpected, setDoc: unexpected, updateDoc: unexpected, onSnapshot: unexpected,
    },
    '../lib/firebase': { requireDb: () => ({}) },
    '../lib/profilePinAccess': access,
    '../types/post': { normalizePinColor: color => color || 'teal' },
    './followService': {
      getFollowingIds: unexpected,
      isFollowing: async (viewer, author) => {
        reads.follows++
        assert.equal(viewer, 'viewer')
        assert.equal(author, 'owner')
        return following
      },
    },
    './storageService': { uploadPostPhotos: unexpected },
    './userService': { getUserProfile: async uid => { reads.profiles++; assert.equal(uid, 'owner'); return owner } },
  })
  return { ...api, reads }
}

test('own album includes every visibility, only own pins, newest first', async () => {
  const api = await service({ owner: { uid: 'owner', isPrivate: true } })
  const album = await api.getProfilePosts('owner', 'owner')
  assert.equal(album.access, 'owner')
  assert.deepEqual(album.posts.map(post => post.id), ['private', 'followers', 'public'])
  assert.equal(api.reads.profiles, 0)
  assert.equal(api.reads.follows, 0)
})

test('public account visitors query only that author’s public pins', async () => {
  const api = await service()
  const album = await api.getProfilePosts('owner', 'viewer')
  assert.equal(album.access, 'public')
  assert.deepEqual(album.posts.map(post => post.id), ['public'])
  assert.deepEqual(api.reads.queries[0].constraints, [
    { field: 'uid', operator: '==', value: 'owner' },
    { field: 'visibility', operator: '==', value: 'public' },
  ])
})

test('approved followers can read public and follower pins, never private pins', async () => {
  for (const isPrivate of [false, true]) {
    const api = await service({ following: true, owner: { uid: 'owner', isPrivate } })
    const album = await api.getProfilePosts('owner', 'viewer')
    assert.equal(album.access, 'following')
    assert.deepEqual(album.posts.map(post => post.id), ['followers', 'public'])
    assert.deepEqual(api.reads.queries[0].constraints, [
      { field: 'uid', operator: '==', value: 'owner' },
      { field: 'visibility', operator: 'in', value: ['public', 'followers'] },
    ])
  }
})

test('private accounts without an approved follow do not query any pins', async () => {
  const api = await service({ owner: { uid: 'owner', isPrivate: true } })
  assert.deepEqual(await api.getProfilePosts('owner', 'viewer'), { posts: [], access: 'locked' })
  assert.deepEqual(api.reads.queries, [])
})

test('missing or incomplete profiles and signed-out viewers cannot load an album', async () => {
  for (const owner of [null, { uid: 'owner', onboardingComplete: false }]) {
    const api = await service({ owner, following: true })
    assert.deepEqual(await api.getProfilePosts('owner', 'viewer'), { posts: [], access: 'locked' })
    assert.deepEqual(api.reads.queries, [])
  }
  const api = await service()
  assert.deepEqual(await api.getProfilePosts('owner'), { posts: [], access: 'locked' })
  assert.deepEqual(api.reads, { profiles: 0, follows: 0, queries: [] })
})

test('albums are not truncated by feed limits, for both owners and public visitors', async () => {
  const posts = Array.from({ length: 251 }, (_, index) => pin(`pin-${index}`, 'public', index))
  for (const viewer of ['owner', 'viewer']) {
    const api = await service({ posts })
    const album = await api.getProfilePosts('owner', viewer)
    assert.equal(album.posts.length, 251)
    assert.equal(album.posts[0].id, 'pin-250')
    assert.equal(album.posts.at(-1).id, 'pin-0')
  }
})

function render(posts, showVisibility = false) {
  return renderToStaticMarkup(createElement(router.MemoryRouter, null,
    createElement(PinAlbumGrid, { posts, showVisibility })))
}

test('album tiles link to pin details and include pins without photos', () => {
  const posts = [pin('산책 / 1', 'private'), { ...pin('photo', 'public'), photoUrls: ['/one.jpg', '/two.jpg'] }]
  const html = render(posts, true)
  assert.equal((html.match(/class="pin-album-tile"/g) || []).length, 2)
  assert.ok(html.includes(`href="/posts/${encodeURIComponent('산책 / 1')}"`))
  assert.match(html, /pin-album-placeholder/)
  assert.match(html, /한강 공원/)
  assert.match(html, /src="\/one.jpg"/)
  assert.match(html, /loading="lazy"/)
  assert.match(html, /aria-label="사진 2장"/)
  assert.match(html, /aria-label="나만 보기"/)
  assert.match(html, /aria-label="전체 공개"/)
  assert.doesNotMatch(render(posts), /class="pin-album-visibility"/)
})
