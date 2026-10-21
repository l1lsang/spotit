import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as jsxRuntime from 'react/jsx-runtime'
import * as react from 'react'
import * as router from 'react-router-dom'
import * as icons from 'lucide-react'
import ts from 'typescript'
import * as mapLocation from '../src/lib/mapLocation.ts'
import * as feedPosts from '../src/components/feed/feedPosts.ts'

async function loadModule(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  }).outputText
  const module = new SourceTextModule(compiled)
  await module.link(specifier => {
    const exports = { react, 'react/jsx-runtime': jsxRuntime, 'react-router-dom': router, 'lucide-react': icons, ...dependencies }[specifier]
    assert.ok(exports, `Unexpected dependency: ${specifier}`)
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    })
  })
  await module.evaluate()
  return module.namespace
}

const unexpected = () => { throw new Error('Unexpected side effect during render') }
const { PinAlbumGrid } = await loadModule('../src/components/profile/PinAlbumGrid.tsx')
const { FeedPostCard } = await loadModule('../src/components/feed/FeedPostCard.tsx', {
  '../../hooks/useAuth': { useAuth: () => ({ currentUser: { uid: 'viewer' }, profile: { nickname: '소연' }, firebaseReady: true }) },
  '../../hooks/useLiveVisibility': { useLiveVisibility: () => ({ ref: { current: null }, live: false }) },
  '../../lib/mapLocation': mapLocation,
  '../../services/likeService': { subscribeToLikeStatus: unexpected, subscribeToPostReactions: unexpected, togglePostLike: unexpected },
  './feedPosts': feedPosts,
})

const post = (id, extra = {}) => ({ id, uid: 'author / 1', authorNickname: '지민', title: `기록 ${id}`, placeName: '성수동', content: '',
  lat: 37.54, lng: 127.05, dateKey: '2026-10-14', visibility: 'public', photoUrls: [], likeCount: 0, commentCount: 0, ...extra })
const inRouter = element => renderToStaticMarkup(createElement(router.MemoryRouter, null, element))

test('feed tiles open the detail feed, keep square photos and show titles when there is no photo', () => {
  const html = inRouter(createElement(PinAlbumGrid, {
    posts: [post('a / 1', { photoUrls: ['/a.jpg', '/b.jpg'], photoThumbnailUrls: ['/a-small.webp'] }), post('text')],
    className: 'feed-grid', getHref: feedPosts.getFeedDetailHref, getLabel: item => `${item.title} · ${item.placeName} 기록 보기`,
    getTileClassName: feedPosts.getFeedTone, showTitleWithoutPhoto: true,
  }))
  assert.match(html, /class="pin-album-grid feed-grid"/)
  assert.ok(html.includes(`href="/feed/${encodeURIComponent('a / 1')}"`))
  assert.match(html, /aria-label="기록 a \/ 1 · 성수동 기록 보기"/)
  assert.match(html, /src="\/a-small.webp"/)
  assert.match(html, /aria-label="사진 2장"/)
  assert.match(html, /<strong>기록 text<\/strong><span>성수동<\/span>/)
  assert.match(html, /class="pin-album-tile tone-(primary|olive|coral)"/)
})

test('without options the grid keeps the profile album behaviour', () => {
  const html = inRouter(createElement(PinAlbumGrid, { posts: [post('p')] }))
  assert.match(html, /class="pin-album-grid"/)
  assert.match(html, /href="\/posts\/p"/)
  assert.match(html, /기록 p · 성수동 핀 보기/)
  assert.doesNotMatch(html, /<strong>/)
})

test('soft tile colours are stable per record and dates read in Korean', () => {
  assert.equal(feedPosts.getFeedTone({ id: 'same' }), feedPosts.getFeedTone({ id: 'same' }))
  assert.ok(new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(id => feedPosts.getFeedTone({ id }))).size > 1)
  assert.equal(feedPosts.formatFeedDate('2026-10-14'), '2026년 10월 14일')
})

test('the detail feed continues from the tapped record for the same viewer only', () => {
  const posts = [post('1'), post('2'), post('3')]
  feedPosts.rememberFeedPosts('viewer', posts)
  assert.deepEqual(feedPosts.readFeedPostsFrom('viewer', '2').map(item => item.id), ['2', '3'])
  assert.equal(feedPosts.readFeedPostsFrom('viewer', 'missing'), null)
  assert.equal(feedPosts.readFeedPostsFrom('someone-else', '2'), null)
})

test('detail cards show the photo carousel, actions, caption and links to the record', () => {
  const html = inRouter(createElement(FeedPostCard, { post: post('photo', {
    photoUrls: ['/1.jpg', '/2.jpg', '/3.jpg'], content: '햇살이 좋아서 조금 더 걸었다.', likeCount: 3, commentCount: 2 }) }))
  assert.match(html, /사진 3장, 옆으로 넘겨 보기/)
  assert.match(html, /1\/3/)
  assert.equal((html.match(/<img /g) || []).length, 3)
  assert.match(html, /alt="기록 photo 사진 1"/)
  assert.match(html, /좋아요 3개/)
  assert.match(html, /햇살이 좋아서 조금 더 걸었다\./)
  assert.match(html, /댓글 2개 모두 보기/)
  assert.match(html, /2026년 10월 14일/)
  assert.match(html, /href="\/posts\/photo"/)
  assert.ok(html.includes(`href="/people/${encodeURIComponent('author / 1')}"`))
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=37\.54,127\.05"[^>]*aria-label="지도에서 위치 열기"/)
  assert.match(html, /aria-pressed="false"/)

  const textOnly = inRouter(createElement(FeedPostCard, { post: post('text') }))
  assert.match(textOnly, /feed-post-placeholder tone-/)
  assert.match(textOnly, /댓글 남기기/)
  assert.doesNotMatch(textOnly, /<img |feed-post-counter|feed-post-content/)
})
