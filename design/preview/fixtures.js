import previewContent from '/src/data/previewContent.json'

const stamp = { toMillis: () => 1791936000000, toDate: () => new Date('2026-10-14T00:00:00Z'), seconds: 1791936000, nanoseconds: 0 }
export const profile = { uid: 'design-viewer', email: 'design@example.test', nickname: '소연', username: 'soyeon.walk', bio: '조금 느리게 걷고, 마음에 드는 곳을 기록해요.\n산책길과 작은 카페를 좋아합니다.', photoURL: '', onboardingComplete: true, followerCount: 24, followingCount: 18, pinThemes: [], createdAt: stamp, updatedAt: stamp }
export const users = [profile, ...['지민', '수현', '민서', '도윤'].map((nickname, i) => ({ ...profile, uid: 'person-' + i, nickname, username: ['jimin.day', 'soohyun', 'minseo.log', 'doyun'][i], bio: ['골목마다 새로운 발견', '주말에는 어디든', '사진으로 남기는 하루', '동네 산책이 좋아요'][i] }))]
export const posts = previewContent.posts.map(post => ({ ...post, photoThumbnailUrls: post.photoUrls, createdAt: stamp, updatedAt: stamp }))
export const groups = previewContent.groups.map(group => ({ ...group, ownerUid: profile.uid, createdAt: stamp, updatedAt: stamp }))
export const chats = users.slice(1).map((user, i) => ({ id: 'chat-' + i, kind: i === 1 ? 'group' : 'direct', name: i === 1 ? '주말 산책 모임' : undefined, participantIds: [profile.uid, user.uid], participants: { [profile.uid]: profile, [user.uid]: user }, lastMessage: ['여기 산책길 좋다! 다음에 같이 가자.', '토요일 오후에 성북천 어때요?', '사진 잘 봤어. 카페 이름 알려줘!', '주말에 날씨가 좋대요.'][i], lastMessageUid: user.uid, lastMessageAt: stamp, readAtBy: {}, createdAt: stamp }))
export const notifications = [{ id: 'n1', recipientUid: profile.uid, actorUid: users[1].uid, actorNickname: users[1].nickname, actorPhotoURL: '', type: 'like', title: '새 좋아요', message: '지민님이 내 기록을 좋아합니다.', href: '/posts/walk', readAt: null, createdAt: stamp }]
export const messages = [
  { id: 'm1', chatId: 'chat-0', uid: 'person-0', authorNickname: '지민', content: '이번 주말에 여기 같이 걸을래?', createdAt: stamp },
  { id: 'm2', chatId: 'chat-0', uid: profile.uid, authorNickname: profile.nickname, content: '좋아! 날씨도 좋다던데. 커피도 한 잔 하자.', createdAt: stamp },
  { id: 'm3', chatId: 'chat-0', uid: 'person-0', authorNickname: '지민', content: '이 길이야. 여유롭게 걸어보자!', photoUrl: '/src/assets/landing/walk.webp', photoName: '성북천 산책길', createdAt: stamp },
]
export const cases = [{ id: 'case-1', kind: 'inquiry', title: '기록 공개 범위를 바꾸고 싶어요', details: '친구들과만 기록을 공유하려면 어떻게 설정하나요?', status: 'resolved', reply: '기록 수정 화면에서 공개 범위를 팔로워 공개로 선택해 주세요.', reporterName: '소연', reporterUid: profile.uid, createdAt: 1791936000000, updatedAt: 1791936000000 }]
