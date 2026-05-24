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
VITE_FIREBASE_KAKAO_PROVIDER_ID=oidc.kakao
VITE_KAKAO_MAP_JS_KEY=
```

환경변수가 비어 있으면 앱은 죽지 않고 Firebase 또는 Kakao Map 설정 안내를 표시합니다.

## Firebase 설정

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

Kakao Map SDK 로드와 타입 래퍼는 `src/lib/kakaoMap.ts`, 지도 렌더링은 `src/components/map/KakaoMapView.tsx`에 분리되어 있습니다.

## 공유 정책

- 게시글 생성 기본 공개 범위는 `followers`입니다.
- `followers` 기록은 작성자를 팔로우한 사용자와 작성자 본인만 볼 수 있습니다.
- `private` 기록은 작성자 본인만 볼 수 있습니다.
- 지도 핀은 “내 기록 + 내가 팔로우한 사람들의 followers 기록”만 표시합니다.
- 피드는 위 기록 중 현재 기준 위치 반경 안에 있는 기록만 표시합니다.

## Firestore 컬렉션 구조

```text
users/{uid}
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
  lastMessageAt: Timestamp
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

## Firestore 보안 규칙 예시

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return signedIn() && request.auth.uid == uid;
    }

    function followerPath(authorUid) {
      return /databases/$(database)/documents/users/$(authorUid)/followers/$(request.auth.uid);
    }

    function followerCountOnly() {
      return request.resource.data.diff(resource.data).changedKeys().hasOnly(["followerCount", "updatedAt"]);
    }

    function postPath(postId) {
      return /databases/$(database)/documents/posts/$(postId);
    }

    function chatPath(chatId) {
      return /databases/$(database)/documents/chats/$(chatId);
    }

    function canReadPost(postData) {
      return isOwner(postData.uid)
        || (
          signedIn()
          && postData.visibility == "followers"
          && exists(followerPath(postData.uid))
        );
    }

    match /users/{uid} {
      allow read: if signedIn();
      allow create: if isOwner(uid) && request.resource.data.uid == uid;
      allow update: if (
          isOwner(uid)
          && request.resource.data.uid == uid
        ) || (
          signedIn()
          && followerCountOnly()
          && request.resource.data.uid == resource.data.uid
          && (exists(followerPath(uid)) || existsAfter(followerPath(uid)))
        );
      allow delete: if false;

      match /followers/{followerUid} {
        allow read: if signedIn();
        allow create, delete: if signedIn() && request.auth.uid == followerUid;
        allow update: if false;
      }

      match /following/{targetUid} {
        allow read: if isOwner(uid);
        allow create, delete: if isOwner(uid);
        allow update: if false;
      }
    }

    match /posts/{postId} {
      allow read: if canReadPost(resource.data);

      allow create: if signedIn()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.visibility in ["followers", "private"];

      allow update: if signedIn()
        && resource.data.uid == request.auth.uid
        && request.resource.data.uid == resource.data.uid;

      allow delete: if signedIn()
        && resource.data.uid == request.auth.uid;

      match /comments/{commentId} {
        allow read: if canReadPost(get(postPath(postId)).data);

        allow create: if signedIn()
          && request.resource.data.uid == request.auth.uid
          && canReadPost(get(postPath(postId)).data);

        allow update: if false;

        allow delete: if signedIn()
          && (
            resource.data.uid == request.auth.uid
            || get(postPath(postId)).data.uid == request.auth.uid
          );
      }

      match /likes/{uid} {
        allow read: if canReadPost(get(postPath(postId)).data);

        allow create: if signedIn()
          && request.auth.uid == uid
          && request.resource.data.uid == uid
          && canReadPost(get(postPath(postId)).data);

        allow update: if false;

        allow delete: if signedIn()
          && request.auth.uid == uid;
      }
    }

    match /chats/{chatId} {
      allow read: if signedIn()
        && request.auth.uid in resource.data.participantIds;

      allow create: if signedIn()
        && request.auth.uid in request.resource.data.participantIds
        && request.resource.data.participantIds.size() == 2;

      allow update: if signedIn()
        && request.auth.uid in resource.data.participantIds
        && request.resource.data.participantIds == resource.data.participantIds;

      allow delete: if false;

      match /messages/{messageId} {
        allow read: if signedIn()
          && request.auth.uid in get(chatPath(chatId)).data.participantIds;

        allow create: if signedIn()
          && request.resource.data.uid == request.auth.uid
          && request.auth.uid in get(chatPath(chatId)).data.participantIds;

        allow update, delete: if false;
      }
    }
  }
}
```

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

## 모바일 앱 확장 구조

- `src/types`: 사용자, 팔로우, 채팅, 기록, 댓글 타입
- `src/services`: Auth, User, Follow, Chat, Post, Comment, Like, Storage 서비스
- `src/contexts/AuthContext.tsx`: 로그인 상태 관리
- `src/lib/firebase.ts`: Firebase 초기화 단일 진입점
- `src/lib/kakaoMap.ts`: 웹 Kakao Map SDK 래퍼

Expo 앱에서는 `types`와 Firebase `services`를 공유하고, Kakao Map 웹 컴포넌트만 네이티브 지도 컴포넌트로 교체하는 방식으로 확장할 수 있습니다.
