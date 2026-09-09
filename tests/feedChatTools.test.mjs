import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterFeedPosts } from '../src/lib/feedSearch.ts'
import { getChatMedia, getPinnedChatMessages } from '../src/lib/chatCollections.ts'

const posts = [
  { id: 'cafe', title: '한강 산책', placeName: 'Cafe Day', address: '서울 성동구', content: '라벤더 라떼', authorNickname: '산책가', email: 'secret@example.test' },
  { id: 'park', title: '공원에서', placeName: '서울숲', address: '서울', content: '피크닉', authorNickname: '친구' },
]

test('feed searches title, place, address, content and nickname, combining words across fields', () => {
  for (const keyword of ['한강', 'cAfE', '성동구', '라벤더', '산책가', '  서울   라떼  ']) {
    assert.deepEqual(filterFeedPosts(posts, keyword).map(post => post.id), ['cafe'])
  }
  assert.deepEqual(filterFeedPosts(posts, 'ＣＡＦＥ').map(post => post.id), ['cafe'])
  assert.deepEqual(filterFeedPosts(posts, '서울 친구').map(post => post.id), ['park'])
})

test('search preserves the visible input scope and order, clears fully, and never searches emails', () => {
  assert.equal(filterFeedPosts(posts, '  '), posts)
  assert.deepEqual(filterFeedPosts(posts, 'secret@example'), [])
  assert.deepEqual(filterFeedPosts(posts.slice(0, 1), '친구'), [])
  assert.deepEqual(filterFeedPosts(posts, '서울'), posts)
  assert.deepEqual(filterFeedPosts(posts, '없는 검색어'), [])
})

test('search can find old records beyond the previous 80 and 240 item limits', () => {
  const many = Array.from({ length: 300 }, (_, i) => ({ ...posts[0], id: String(i), title: `오래된 기록 ${i}` }))
  assert.deepEqual(filterFeedPosts(many, '기록 299').map(post => post.id), ['299'])
})

const messages = [
  { id: 'text', uid: 'one', content: '약속 장소' },
  { id: 'photo', uid: 'two', content: '', photoUrl: 'https://example.test/one.jpg' },
  { id: 'deleted', uid: 'deleted-user', content: '탈퇴한 사용자의 메시지입니다.', photoUrl: '' },
  { id: 'both', uid: 'one', content: '모임 사진', photoUrl: 'https://example.test/two.jpg' },
]

test('media includes image-only and captioned photos, newest first, without changing message order', () => {
  assert.deepEqual(getChatMedia(messages).map(message => message.id), ['both', 'photo'])
  assert.deepEqual(messages.map(message => message.id), ['text', 'photo', 'deleted', 'both'])
  assert.deepEqual(getChatMedia([]), [])
})

test('pins use live messages, deduplicate IDs, and exclude missing or anonymized messages', () => {
  const pins = ['photo', 'missing', 'text', 'deleted', 'text']
  assert.deepEqual(getPinnedChatMessages(messages, pins).map(message => message.id), ['text', 'photo'])
  const updated = messages.map(message => message.id === 'text' ? { ...message, content: '변경된 내용' } : message)
  assert.equal(getPinnedChatMessages(updated, pins)[0].content, '변경된 내용')
  assert.deepEqual(getPinnedChatMessages(messages), [])
  assert.deepEqual(getPinnedChatMessages([], pins), [])
})
