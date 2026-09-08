# 스팟잇: 오늘, 이곳

글로벌 이름은 **Daymark**입니다. 오늘 내가 있었던 장소를 지도 위에 핀으로 남기고, 사진과 메모를 기록하며 팔로우 관계 안에서 공유하는 지도 기반 SNS MVP입니다.

## 실행 방법

```bash
npm install
npm run dev
```

빌드 확인:

```bash
npm run build
```

## 환경변수 설정

`.env.example`을 참고해 프로젝트 루트에 `.env`를 만듭니다. Vite 환경변수는 반드시 `VITE_` prefix를 사용합니다.

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_VAPID_KEY=
VITE_FIREBASE_KAKAO_PROVIDER_ID=oidc.kakao
VITE_KAKAO_MAP_JS_KEY=
VITE_GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_MAPS_MAP_ID=
```

환경변수가 비어 있으면 앱은 죽지 않고 Firebase 또는 Kakao Map 설정 안내를 표시합니다.

## Firebase 설정

사용자 이름을 포함한 2단계 가입, Google 로그인, 기존 사용자 일괄 적용과 필요한 보안 규칙은 [계정 기능 설정](docs/account-setup.md)을 참고합니다.

1. Firebase Console에서 Web 앱을 생성합니다.
2. Authentication에서 이메일/비밀번호 로그인을 활성화합니다.
3. Firestore Database와 Storage를 생성합니다.
4. Firebase Web SDK 설정 값을 `.env`에 입력합니다.
5. 카카오 로그인은 Firebase Auth의 OpenID Connect Provider로 설정합니다.

### 카카오 로그인 설정

Firebase Auth는 Kakao를 기본 provider로 제공하지 않으므로 커스텀 OIDC Provider를 사용합니다.

1. Kakao Developers에서 앱을 만들고 카카오 로그인을 활성화합니다.
2. Redirect URI에 Firebase Auth OIDC 콜백 URL을 등록합니다.
3. Firebase Console > Authentication > Sign-in method > OpenID Connect를 추가합니다.
4. Provider ID를 `oidc.kakao`로 만들거나, 다른 ID를 쓴다면 `.env`의 `VITE_FIREBASE_KAKAO_PROVIDER_ID`를 바꿉니다.
5. Client ID/Secret, issuer 등 OIDC 설정은 Firebase Console에 저장합니다. 클라이언트 코드에는 secret을 넣지 않습니다.

## Kakao Map API 설정

1. Kakao Developers에서 JavaScript 앱 키를 발급합니다.
2. 플랫폼 Web에 로컬 개발 주소와 배포 도메인을 등록합니다.
3. `.env`의 `VITE_KAKAO_MAP_JS_KEY`에 JavaScript 키를 입력합니다.

Kakao Map SDK 로드와 타입 래퍼는 `src/lib/kakaoMap.ts`, 공통 지도 렌더링은 `src/components/map/MapView.tsx`에 분리되어 있습니다.

## Google Maps 및 국내외 지도 전환

1. Google Cloud 프로젝트에서 결제 계정을 연결하고 **Maps JavaScript API**, **Places API (New)**를 활성화합니다.
2. 웹 API 키를 `.env`의 `VITE_GOOGLE_MAPS_API_KEY`에 입력합니다. 웹사이트(HTTP referrer) 제한에 로컬 개발 주소와 배포 도메인을 등록하고 위 API들로 키 사용 범위를 제한합니다.
3. JavaScript 지도 ID를 생성해 `VITE_GOOGLE_MAPS_MAP_ID`에 입력합니다. 로컬 테스트에서는 비워두면 `DEMO_MAP_ID`를 사용합니다.
4. 개발 서버를 재시작합니다. 배포 시에도 같은 환경변수를 설정하고 다시 빌드합니다.

지도는 브라우저 현재 위치와 선택한 핀의 좌표를 기준으로 한국에서는 카카오맵, 해외에서는 Google Maps를 사용합니다. IP 국가 조회는 하지 않습니다. 한국 서비스 영역 판별은 본토와 주요 도서의 근사 영역이며 행정 경계 판별용이 아닙니다. 위치 권한을 사용할 수 없으면 서울 시청에서 시작하며, 상단 지도 선택에서 Google Maps로 바꾸고 해외 장소를 검색할 수 있습니다. 현재 위치 버튼은 자동 선택으로 돌아갑니다.

해외 검색은 Places API (New)를 사용합니다. 카카오 장소 검색 결과가 없고 Google 키가 설정되어 있으면 Google 검색도 시도합니다. Google 검색 결과는 Google 지도에서 표시하며, 기존 카카오 장소 ID는 유지하고 Google 장소 ID에는 `google:` 접두사를 붙입니다.

두 지도 모두 화면에서 겹친 핀을 총 개수로 묶습니다(예: 핀 2개 = `+2`). 클릭하면 장소·주소·작성자 목록이 열리고 항목을 선택하면 해당 좌표로 이동합니다. 지도를 확대하면 떨어진 핀은 분리됩니다. 기존 팔로우/비공개 접근 범위는 그대로 적용됩니다.

지도 영역·좌표 유효성·핀 겹침 회귀 테스트: Node.js 22.6 이상에서 `npm run test:maps`를 실행합니다.

공식 설정 문서: [Google 지도 로드](https://developers.google.com/maps/documentation/javascript/load-maps-js-api), [고급 마커와 지도 ID](https://developers.google.com/maps/documentation/javascript/advanced-markers/start), [장소 검색](https://developers.google.com/maps/documentation/javascript/place-search).

## 공유 정책

- 게시글 생성 기본 공개 범위는 `followers`입니다.
- `followers` 기록은 작성자를 팔로우한 사용자와 작성자 본인만 볼 수 있습니다.
- `private` 기록은 작성자 본인만 볼 수 있습니다.
- 지도 핀은 “내 기록 + 내가 팔로우한 사람들의 followers 기록”만 표시합니다.
- 피드는 위 기록 중 현재 기준 위치 반경 안에 있는 기록만 표시합니다.

## Firestore 컬렉션 구조

```text
users/{uid}
usernames/@{username}
users/{uid}/followers/{followerUid}
users/{uid}/following/{targetUid}
posts/{postId}
posts/{postId}/comments/{commentId}
posts/{postId}/likes/{uid}
chats/{chatId}
chats/{chatId}/messages/{messageId}
```

`users/{uid}`

```ts
{
  uid: string
  email: string
  nickname: string
  username: string
  bio: string
  onboardingComplete: boolean
  photoURL: string
  followerCount: number
  followingCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

`posts/{postId}`

```ts
{
  id: string
  uid: string
  authorNickname: string
  title: string
  content: string
  placeName: string
  address: string
  lat: number
  lng: number
  dateKey: string
  visibility: "followers" | "private"
  photoUrls: string[]
  likeCount: number
  commentCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

팔로우 기반 지도 조회를 위해 Firestore에서 `posts` 컬렉션에 `uid` + `visibility` 복합 인덱스가 필요할 수 있습니다. 콘솔에 인덱스 생성 안내가 뜨면 해당 링크로 생성하면 됩니다.

`chats/{chatId}`

```ts
{
  id: string
  participantIds: string[]
  participants: Record<string, { uid: string; nickname: string; photoURL: string }>
  lastMessage: string
  lastMessageUid: string
  lastMessageAt: Timestamp
  readAtBy: Record<string, Timestamp>
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

`chats/{chatId}/messages/{messageId}`

```ts
{
  id: string
  chatId: string
  uid: string
  authorNickname: string
  content: string
  createdAt: Timestamp
}
```

## 관리자·신고·문의 및 보안 규칙

관리자 통계, 유저 검색·정지, 핀·유저·채팅 신고와 문의 기능은 [관리자 기능 설정](docs/admin-setup.md)을 참고합니다. 실제 Firestore 규칙은 [firestore.rules](firestore.rules), 인덱스는 [firestore.indexes.json](firestore.indexes.json)에서 관리합니다.

아래 Storage 규칙은 별도 예시입니다.

Storage 규칙 예시:

```js
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /posts/{uid}/{postId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    match /profiles/{uid}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## 배포 방법

Vercel 기준:

1. GitHub 저장소를 Vercel 프로젝트로 import합니다.
2. Framework Preset은 Vite로 설정합니다.
3. Environment Variables에 `.env.example`의 값을 등록합니다.
4. Build Command는 `npm run build`, Output Directory는 `dist`를 사용합니다.
5. Kakao Developers Web 플랫폼과 Firebase Auth OIDC 설정에 Vercel 배포 도메인을 추가합니다.
6. `vercel.json`의 SPA rewrite 설정으로 `/feed`, `/profile`, `/chats/:id` 같은 경로에서 새로고침해도 `index.html`이 로드됩니다.

## 휴대폰 푸시 알림

웹/PWA 푸시는 Firebase Cloud Messaging을 사용합니다.

1. Firebase Console > Project settings > Cloud Messaging > Web Push certificates에서 VAPID key pair를 생성합니다.
2. 공개 키를 `VITE_FIREBASE_MESSAGING_VAPID_KEY`에 넣습니다.
3. Firestore 규칙에서 로그인 사용자가 `users/{uid}/fcmTokens/{tokenId}`를 본인 UID 아래에 생성/삭제할 수 있게 허용합니다.
4. Cloud Functions 의존성을 설치합니다: `cd functions && npm install`
5. Functions를 배포합니다: `firebase deploy --only functions`

푸시 전송 흐름:

```text
앱 액션 -> users/{uid}/notifications/{notificationId} 생성
Cloud Function -> users/{uid}/fcmTokens 토큰 조회
Firebase Cloud Messaging -> 휴대폰/PWA 푸시 전송
```

## 모바일 앱 확장 구조

- `src/types`: 사용자, 팔로우, 채팅, 기록, 댓글 타입
- `src/services`: Auth, User, Follow, Chat, Post, Comment, Like, Storage 서비스
- `src/contexts/AuthContext.tsx`: 로그인 상태 관리
- `src/lib/firebase.ts`: Firebase 초기화 단일 진입점
- `src/lib/kakaoMap.ts`: 웹 Kakao Map SDK 래퍼

Expo 앱에서는 `types`와 Firebase `services`를 공유하고, Kakao Map 웹 컴포넌트만 네이티브 지도 컴포넌트로 교체하는 방식으로 확장할 수 있습니다.
