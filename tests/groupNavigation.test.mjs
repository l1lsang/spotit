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
import * as navigation from '../src/lib/groupNavigation.ts'
import * as mapLocation from '../src/lib/mapLocation.ts'
import * as mapFeatures from '../src/types/mapFeature.ts'
import * as postTypes from '../src/types/post.ts'

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
const groupState = {
  groups: [{ id: 'my-group', name: '내 산책 그룹', description: '산책 장소', memberCount: 2, ownerUid: 'viewer' },
    { id: 'public-group', name: '공개 맛집 그룹', description: '맛집 장소', memberCount: 3, ownerUid: 'other' }],
  joinedIds: ['my-group'], loading: false, error: '', retry: unexpected,
}
const authState = { currentUser: { uid: 'viewer' }, profile: { nickname: '참여자' }, firebaseReady: true }
const shared = {
  '../hooks/useAuth': { useAuth: () => authState },
  '../hooks/useGroups': { useGroups: () => groupState },
  '../lib/groupNavigation': navigation,
  '../components/group/GroupJoinButton': { GroupJoinButton: ({ joined }) => react.createElement('button', null, joined ? '그룹 탈퇴' : '코드로 가입') },
  '../components/group/GroupInvitePanel': { GroupInvitePanel: () => react.createElement('div', null, '그룹 초대코드') },
  '../components/layout/PageContainer': { PageContainer: ({ children }) => react.createElement('main', null, children) },
}
const { BottomNav } = await loadModule('../src/components/layout/BottomNav.tsx', { '../../lib/groupNavigation': navigation })
const { GroupDetailPage } = await loadModule('../src/pages/GroupDetailPage.tsx', {
  ...shared,
  '../components/post/PostCard': { PostCard: () => null },
  '../services/postService': { subscribeGroupPosts: unexpected },
})
const { GroupsPage } = await loadModule('../src/pages/GroupsPage.tsx', {
  ...shared,
  '../components/group/CreateGroupDialog': { CreateGroupDialog: () => null },
  '../components/group/JoinGroupDialog': { JoinGroupDialog: () => null },
})
let formProps
const createdPosts = []
const { MapPage } = await loadModule('../src/pages/MapPage.tsx', {
  ...shared,
  '../components/map/MapView': { MapView: () => null },
  '../components/map/MapPinList': { MapPinList: () => null },
  '../components/map/MapPostPreview': { MapPostPreview: () => null },
  '../components/post/PostFormModal': { PostFormModal: props => { formProps = props; return null } },
  '../hooks/useCurrentLocation': { SEOUL_CITY_HALL: { lat: 37.5665, lng: 126.978 }, useCurrentLocation: () => ({ requestLocation: unexpected, loading: false, error: '' }) },
  '../lib/mapLocation': mapLocation,
  '../lib/placeSearch': { searchPlaces: unexpected },
  '../services/mapFeatureService': { createLivePlaceStatus: unexpected, subscribePlaceStatusUpdates: unexpected },
  '../services/postService': { createPost: async (input, files, author) => { createdPosts.push({ input, files, author }); return 'saved-pin' }, getVisiblePosts: unexpected, subscribeGroupPosts: unexpected },
  '../types/mapFeature': mapFeatures,
  '../types/post': postTypes,
})

function render(Component, url, route) {
  const content = route ? react.createElement(router.Routes, null, react.createElement(router.Route, { path: route, element: react.createElement(Component) })) : react.createElement(Component)
  return renderToStaticMarkup(react.createElement(router.MemoryRouter, { initialEntries: [url] }, content))
}

test('group map links preserve the complete group ID and map section boundaries', () => {
  assert.equal(navigation.getGroupMapUrl(), '/map')
  for (const groupId of ['my-group', '한글 그룹', 'a&b?group=other']) {
    const url = new URL(navigation.getGroupMapUrl(groupId), 'https://example.test')
    assert.equal(url.pathname, '/map')
    assert.equal(url.searchParams.get('group'), groupId)
    assert.equal([...url.searchParams].length, 1)
  }
  for (const path of ['/map', '/groups', '/groups/my-group']) assert.equal(navigation.isMapSection(path), true)
  for (const path of ['/feed', '/groups-other', '/maple']) assert.equal(navigation.isMapSection(path), false)
})

test('group pages belong to the map tab and the bottom navigation has five destinations', () => {
  for (const path of ['/map', '/groups', '/groups/my-group']) {
    const html = render(BottomNav, path)
    assert.equal((html.match(/<a /g) || []).length, 5)
    assert.match(html, /<a[^>]*class="active"[^>]*aria-current="page"[^>]*href="\/map"/)
    assert.doesNotMatch(html, /href="\/groups"/)
  }
  assert.doesNotMatch(render(BottomNav, '/feed'), /<a[^>]*aria-current="page"[^>]*href="\/map"/)
})

test('group homes send members and visitors to the same scoped map without an embedded pin editor', () => {
  const member = render(GroupDetailPage, '/groups/my-group', '/groups/:groupId')
  assert.match(member, /href="\/map\?group=my-group"/)
  assert.match(member, /지도에서 핀 남기기/)
  const visitor = render(GroupDetailPage, '/groups/public-group', '/groups/:groupId')
  assert.match(visitor, /href="\/map\?group=public-group"/)
  assert.match(visitor, /지도에서 그룹 핀 보기/)
  for (const html of [member, visitor]) {
    assert.doesNotMatch(html, /<form|role="dialog"|class="group-map-shell"/)
    assert.match(html, /함께 모은 핀/)
  }
})

test('map entry icon, group selector, and pin destination follow the selected route', () => {
  let html = render(MapPage, '/map')
  assert.match(html, /aria-label="그룹 페이지 열기"[^>]*href="\/groups"/)
  assert.match(html, /내 지도 · 나와 팔로잉/)
  assert.match(html, /내 산책 그룹/)
  assert.doesNotMatch(html, /공개 맛집 그룹/)
  assert.equal(formProps.initialGroupId, '')
  assert.equal(formProps.lockGroup, false)

  html = render(MapPage, '/map?group=my-group')
  assert.match(html, /value="my-group" selected=""/)
  assert.match(html, /href="\/groups\/my-group"/)
  assert.equal(formProps.initialGroupId, 'my-group')
  assert.equal(formProps.lockGroup, true)

  html = render(MapPage, '/map?group=public-group')
  assert.match(html, /value="public-group" selected=""/)
  assert.match(html, /코드로 가입/)
  assert.equal(formProps.initialGroupId, 'public-group')
  assert.equal(formProps.isOpen, false)

  html = render(MapPage, '/map?group=missing')
  assert.match(html, /그룹을 찾을 수 없습니다/)
  assert.equal(formProps.isOpen, false)
})

test('submitting on a group map saves into that group and rejects visitors before writing', async () => {
  const payload = { title: '산책길', content: '함께 걷는 곳', placeName: '서울숲', address: '서울', lat: 37.54, lng: 127.04,
    dateKey: '2026-09-10', visibility: 'private', pinColor: '#123456', groupId: 'public-group', files: [], existingPhotoUrls: [] }
  render(MapPage, '/map?group=my-group')
  await formProps.onSubmit(payload)
  assert.equal(createdPosts.length, 1)
  assert.equal(createdPosts[0].input.groupId, 'my-group')
  assert.equal(createdPosts[0].input.visibility, 'public')
  assert.equal(createdPosts[0].input.placeName, '서울숲')
  assert.equal(createdPosts[0].author.uid, 'viewer')
  render(MapPage, '/map?group=public-group')
  await assert.rejects(formProps.onSubmit(payload), /그룹에 가입한 뒤/)
  render(MapPage, '/map?group=missing')
  await assert.rejects(formProps.onSubmit(payload), /그룹에 가입한 뒤/)
  assert.equal(createdPosts.length, 1)
})

test('private groups stay out of discovery and lose their home and invitation panel immediately after leaving', () => {
  const privateGroup = { id: 'private-group', name: '숨겨진 이름', description: '숨겨진 소개', visibility: 'private', memberCount: 2, ownerUid: 'other' }
  groupState.groups.push(privateGroup)
  groupState.joinedIds.push(privateGroup.id)
  try {
    const discovery = render(GroupsPage, '/groups')
    assert.doesNotMatch(discovery, /숨겨진 이름|숨겨진 소개/)
    assert.match(discovery, /초대코드로 가입/)
    const member = render(GroupDetailPage, '/groups/private-group', '/groups/:groupId')
    assert.match(member, /숨겨진 이름/)
    assert.match(member, /그룹 초대코드/)
    groupState.joinedIds.pop()
    // Simulate the group snapshot arriving later than the membership removal.
    const formerMember = render(GroupDetailPage, '/groups/private-group', '/groups/:groupId')
    assert.doesNotMatch(formerMember, /숨겨진 이름|숨겨진 소개|그룹 초대코드/)
    assert.match(formerMember, /코드로 가입/)
    const publicVisitor = render(GroupDetailPage, '/groups/public-group', '/groups/:groupId')
    assert.doesNotMatch(publicVisitor, /그룹 초대코드/)
  } finally {
    groupState.groups.pop()
    groupState.joinedIds = groupState.joinedIds.filter(id => id !== privateGroup.id)
  }
})
