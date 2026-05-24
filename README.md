# 스팟잇: 오늘, 이곳

글로벌 이름은 **Daymark**입니다. 오늘 내가 있었던 장소를 지도 위에 핀으로 남기고, 날짜·사진·메모를 기록하며 다른 사람들과 공유하는 지도 기반 SNS MVP입니다.

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
VITE_KAKAO_MAP_JS_KEY=
```

환경변수가 비어 있으면 앱은 죽지 않고 Firebase 또는 Kakao Map 설정 안내를 표시합니다.

## Firebase 설정

1. Firebase Console에서 Web 앱을 생성합니다.
2. Authentication에서 이메일/비밀번호 로그인을 활성화합니다.
3. Firestore Database를 생성합니다.
4. Storage를 생성합니다.
5. Firebase Web SDK 설정 값을 `.env`에 입력합니다.

Firebase 초기화는 `src/lib/firebase.ts` 한 곳에서만 수행합니다. Auth, Firestore, Storage 사용 로직은 `src/services`로 분리되어 있습니다.

## Kakao Map API 설정

1. Kakao Developers에서 JavaScript 앱 키를 발급합니다.
2. 플랫폼 Web에 로컬 개발 주소와 배포 도메인을 등록합니다.
3. `.env`의 `VITE_KAKAO_MAP_JS_KEY`에 JavaScript 키를 입력합니다.

Kakao Map SDK 로드와 타입 래퍼는 `src/lib/kakaoMap.ts`, 지도 렌더링은 `src/components/map/KakaoMapView.tsx`에 분리되어 있습니다.

## Firestore 컬렉션 구조

```text
users/{uid}
posts/{postId}
posts/{postId}/comments/{commentId}
posts/{postId}/likes/{uid}
```

`users/{uid}`

```ts
{
  uid: string
  email: string
  nickname: string
  photoURL: string
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
  visibility: "public" | "private"
  photoUrls: string[]
  likeCount: number
  commentCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
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

    function postPath(postId) {
      return /databases/$(database)/documents/posts/$(postId);
    }

    function canReadPost(postData) {
      return postData.visibility == "public" || isOwner(postData.uid);
    }

    match /users/{uid} {
      allow read: if isOwner(uid);
      allow create: if isOwner(uid) && request.resource.data.uid == uid;
      allow update: if isOwner(uid) && request.resource.data.uid == uid;
      allow delete: if false;
    }

    match /posts/{postId} {
      allow read: if canReadPost(resource.data);

      allow create: if signedIn()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.visibility in ["public", "private"];

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
  }
}
```

Storage 규칙 예시:

```js
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /posts/{uid}/{postId}/{fileName} {
      allow read: if true;
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
5. Kakao Developers Web 플랫폼에 Vercel 배포 도메인을 추가합니다.

## 모바일 앱 확장 구조

나중에 Expo 앱으로 확장할 때 재사용하기 쉽도록 다음을 UI와 분리했습니다.

- `src/types`: 사용자, 기록, 댓글 타입
- `src/services`: Auth, User, Post, Comment, Like, Storage 서비스
- `src/contexts/AuthContext.tsx`: 로그인 상태 관리
- `src/lib/firebase.ts`: Firebase 초기화 단일 진입점
- `src/lib/kakaoMap.ts`: 웹 Kakao Map SDK 래퍼

Expo 앱에서는 `types`와 Firebase `services`를 공유하고, Kakao Map 웹 컴포넌트만 네이티브 지도 컴포넌트로 교체하는 방식으로 확장할 수 있습니다.
