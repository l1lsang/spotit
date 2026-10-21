import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import * as react from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import * as router from 'react-router-dom'
import * as icons from 'lucide-react'
import ts from 'typescript'

async function loadModule(path, dependencies = {}) {
  const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  }).outputText
  const module = new SourceTextModule(code)
  await module.link(specifier => {
    const exports = { react, 'react/jsx-runtime': jsxRuntime, 'react-router-dom': router, 'lucide-react': icons, ...dependencies }[specifier]
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
let gridProps
const grid = { PinAlbumGrid: props => { gridProps = props; return react.createElement('div', { className: 'grid-stub' }, props.posts.map(post => post.title).join(',')) } }
const { ProfileHeader } = await loadModule('../src/components/profile/ProfileHeader.tsx')
const { ProfileTabs, ProfileSingleTab } = await loadModule('../src/components/profile/ProfileTabs.tsx')
const { ProfileMoreMenu } = await loadModule('../src/components/profile/ProfileMoreMenu.tsx', {
  '../moderation/ReportButton': { ReportDialog: unexpected },
})
const { ProfilePinAlbum } = await loadModule('../src/components/profile/ProfilePinAlbum.tsx', { './PinAlbumGrid': grid })
const { LikedPinAlbum } = await loadModule('../src/components/profile/LikedPinAlbum.tsx', { './PinAlbumGrid': grid })

const render = (element, url = '/profile') => renderToStaticMarkup(react.createElement(router.MemoryRouter, { initialEntries: [url] }, element))
const user = { uid: 'soyeon', nickname: '소연', username: 'soyeon.walk', bio: '조금 느리게 걷고,\n마음에 드는 곳을 기록해요.', followerCount: 24, followingCount: 18, isPrivate: false }

test('the header puts the avatar beside pin, follower and following counts, then name and bio', () => {
  const html = render(react.createElement(ProfileHeader, { user, own: true, pinCount: 3, onOpenFollowList: unexpected },
    react.createElement('a', { href: '/profile/settings' }, '프로필 편집')))
  assert.match(html, /class="profile-view-avatar profile-view-initial"[^>]*>소</)
  assert.match(html, /<strong>3<\/strong><span>핀<\/span>/)
  assert.match(html, /aria-label="팔로워 24명 보기"[^>]*><strong>24<\/strong><span>팔로워<\/span>/)
  assert.match(html, /aria-label="팔로잉 18명 보기"[^>]*><strong>18<\/strong><span>팔로잉<\/span>/)
  assert.match(html, /<h1>소연<\/h1>/)
  assert.match(html, /조금 느리게 걷고,\n마음에 드는 곳을 기록해요\./)
  assert.match(html, /class="profile-view-actions"><a href="\/profile\/settings">프로필 편집<\/a>/)
  assert.doesNotMatch(html, /비공개 계정/)
})

test('locked albums hide the pin count, private accounts explain follow approval, photos replace initials', () => {
  const html = render(react.createElement(ProfileHeader, { user: { ...user, isPrivate: true, photoURL: 'https://example.test/me.png', bio: '' }, own: false, pinCount: null, onOpenFollowList: unexpected }))
  assert.match(html, /<strong aria-hidden="true">–<\/strong><span>핀<span class="sr-only"> 수를 볼 수 없어요<\/span><\/span>/)
  assert.match(html, /<img class="profile-view-avatar" src="https:\/\/example\.test\/me\.png" alt="소연 프로필 사진"/)
  assert.match(html, /비공개 계정 · 팔로우 요청을 승인받아야 합니다\./)
  assert.match(html, /profile-view-bio is-empty">아직 소개글이 없습니다\./)
  assert.doesNotMatch(html, /profile-view-actions/)
})

test('own profile tabs keep the choice in the URL and mark the current one', () => {
  const pins = render(react.createElement(ProfileTabs, { active: 'pins' }))
  assert.match(pins, /<a class="profile-view-tab" aria-current="page" href="\/profile"[ >]/)
  assert.match(pins, /href="\/profile\?tab=likes"[^>]*>.*좋아요<\/a>/)
  const likes = render(react.createElement(ProfileTabs, { active: 'likes' }), '/profile?tab=likes')
  assert.match(likes, /aria-current="page" href="\/profile\?tab=likes"/)
  assert.doesNotMatch(likes, /aria-current="page" href="\/profile"[ >]/)
  assert.match(render(react.createElement(ProfileSingleTab, { label: '핀' })), /<h2 class="profile-view-tab is-active">.*핀<\/h2>/)
})

test('reports sit behind a closed more menu instead of a standalone row', () => {
  const html = render(react.createElement(ProfileMoreMenu, { user: { ...user, photoURL: 'https://example.test/me.png' } }), '/people/soyeon')
  assert.match(html, /<button class="profile-view-icon-button" type="button" aria-label="더보기"[^>]*aria-haspopup="menu" aria-expanded="false"/)
  assert.doesNotMatch(html, /role="menu"|신고/)
})

test('pin album shows the grid with visibility only on own pins, and keeps locked, empty and error states', () => {
  const posts = [{ id: 'a', title: '조금 더 걷고 싶은 날' }]
  const retry = () => undefined
  let html = render(react.createElement(ProfilePinAlbum, { own: true, state: { loading: false, error: '', retry, album: { access: 'owner', posts } } }))
  assert.match(html, /조금 더 걷고 싶은 날/)
  assert.equal(gridProps.showVisibility, true)
  render(react.createElement(ProfilePinAlbum, { own: false, state: { loading: false, error: '', retry, album: { access: 'public', posts } } }))
  assert.equal(gridProps.showVisibility, false)
  html = render(react.createElement(ProfilePinAlbum, { own: false, state: { loading: false, error: '', retry, album: { access: 'locked', posts: [] } } }))
  assert.match(html, /비공개 계정입니다/)
  html = render(react.createElement(ProfilePinAlbum, { own: true, state: { loading: false, error: '', retry, album: { access: 'owner', posts: [] } } }))
  assert.match(html, /아직 남긴 핀이 없습니다/)
  html = render(react.createElement(ProfilePinAlbum, { own: true, state: { loading: false, error: '핀을 불러오지 못했습니다.', retry, album: null } }))
  assert.match(html, /role="alert"><p>핀을 불러오지 못했습니다\.<\/p><button[^>]*>다시 시도/)
  assert.match(render(react.createElement(ProfilePinAlbum, { own: true, state: { loading: true, error: '', retry, album: null } })), /role="status">핀을 불러오는 중입니다/)
})

test('the likes tab reuses the square grid and guides an empty list to the feed', () => {
  const retry = () => undefined
  let html = render(react.createElement(LikedPinAlbum, { state: { posts: [{ id: 'b', title: '예쁜 카페 발견' }], loading: false, error: '', retry } }))
  assert.match(html, /aria-label="좋아요한 핀"/)
  assert.match(html, /예쁜 카페 발견/)
  assert.equal(gridProps.showVisibility, undefined)
  html = render(react.createElement(LikedPinAlbum, { state: { posts: [], loading: false, error: '', retry } }))
  assert.match(html, /아직 좋아요한 핀이 없어요/)
  assert.match(html, /href="\/feed"[^>]*>피드 둘러보기/)
  html = render(react.createElement(LikedPinAlbum, { state: { posts: [], loading: false, error: '좋아요한 핀을 불러오지 못했어요. 다시 시도해 주세요.', retry } }))
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /피드 둘러보기/)
  assert.match(render(react.createElement(LikedPinAlbum, { state: { posts: [], loading: true, error: '', retry } })), /불러오는 중이에요/)
})
