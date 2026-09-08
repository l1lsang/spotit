# 사용자 이름과 구글 로그인 적용

## 가입 흐름

- 이메일 가입: 사용자 이름·이메일·비밀번호 → 다음 → 사진·닉네임·소개글 → 가입 완료.
- 구글/카카오 최초 로그인: 사용자 이름 → 사진·닉네임·소개글. 기존 계정은 바로 로그인합니다.
- 사용자 이름: 영어·숫자·밑줄·점, 1~30자, 소문자로 저장합니다. 표시할 때 `@`를 붙입니다.
- 닉네임: 한글 등 사용 가능, 1~24자. 소개글: 선택, 최대 150자. 사진: 선택, JPG/PNG/WebP/GIF, 최대 5MB.
- `users/{uid}`에 `username`, `bio`, `onboardingComplete`를 저장합니다. 중복 방지를 위해 `usernames/@{username}`에 `{ uid }`를 함께 저장합니다.
- 사진이나 프로필 저장에 실패한 신규 계정은 재시도할 수 있습니다. 다시 로그인해도 미완료 계정은 가입 설정으로 이동합니다.
- 기존 사용자 이름이 없는 프로필은 로그인 시 `user_`와 임의 문자열을 조합한 이름을 한 번 생성합니다. 기존 닉네임·사진·소개글·팔로우 정보는 보존됩니다.

## 운영 Firebase에서 필요한 설정

아래 설정과 일괄 적용 명령은 대상 Firebase 프로젝트의 관리 권한이 있는 계정으로 실행합니다.

### Google 로그인

1. Firebase Console → Authentication → Sign-in method → Google을 활성화합니다.
2. 프로젝트 지원 이메일을 선택하고 저장합니다.
3. Authentication → Settings → Authorized domains에 실제 서비스 도메인과 필요한 개발 도메인을 등록합니다.

Google 로그인은 Firebase `GoogleAuthProvider`와 팝업을 사용합니다. 지도 API 키와 지도 ID는 로그인 설정에 사용하지 않습니다.

버튼 아래에는 Chrome, Safari, Edge, Firefox 등 지원되는 일반 브라우저 안내와 앱 내 브라우저의 로그인 제한 안내를 표시합니다. 브라우저 이름으로 버튼을 막지는 않습니다. 팝업 차단·취소·기존 로그인 방법 충돌·미등록 도메인 오류를 별도로 처리합니다.

공식 문서: [Firebase Google 로그인](https://firebase.google.com/docs/auth/web/google-signin), [Google 지원 브라우저](https://support.google.com/accounts/answer/7675428?hl=ko).

### Firestore 규칙

가입 전 중복 확인에 `usernames` 문서 단건 읽기 권한이 필요합니다. 현재 운영 규칙을 먼저 내보낸 후 다음 내용을 병합합니다. 이 저장소의 기존 README 예시는 모든 기능의 최신 운영 규칙을 포함하지 않습니다.

검증된 규칙 원문은 [`tests/fixtures/profile.rules`](../tests/fixtures/profile.rules)에 있습니다. 해당 파일은 사용자 프로필만 다루는 테스트 규칙입니다. 실제 서비스에 적용할 때는 다음과 같이 병합합니다.

1. `validProfileIdentity`, `validProfileText`, `releasesOldUsername` 함수를 기존 `match /databases/{database}/documents` 아래에 추가합니다. `isOwner`가 없다면 함께 추가합니다.
2. `match /usernames/{usernameKey}` 블록 전체를 같은 위치에 추가합니다.
3. 기존 `users/{uid}`의 본인 create 조건에 `validProfileIdentity(uid) && validProfileText()`를 추가합니다.
4. 본인 update 조건에 `validProfileIdentity(uid) && validProfileText() && releasesOldUsername()`를 추가합니다.
5. 다른 사용자의 팔로워 수 변경 등 기존 허용 분기에서는 `affectedKeys().hasOnly(...)`로 수정 필드를 한정해 `username`, `bio`, `onboardingComplete`, `uid`를 바꿀 수 없도록 합니다.
6. 계정 삭제 조건에 해당 사용자의 사용자 이름 예약도 `existsAfter` 기준으로 삭제되었는지 확인하는 조건을 병합합니다.
7. 기존 게시글·댓글·채팅·팔로우·알림·토큰 하위 경로 규칙을 유지하고 병합한 규칙을 게시합니다.

기존에 전역 `allow write: if true` 또는 전체 경로에 대한 로그인 사용자 쓰기 허용이 있으면 위 조건을 우회할 수 있으므로 해당 허용 범위를 조정해야 합니다. 프로필에 저장하는 이름과 이름 예약은 하나의 Firestore 트랜잭션으로 쓰며 규칙에서도 `getAfter()`로 일치 여부를 검증합니다.

Storage의 `profiles/{uid}/{filename}` 경로는 본인 쓰기 및 프로필 이미지 읽기를 허용해야 합니다. 파일 형식/5MB 검증 예시는 [`tests/fixtures/profile-storage.rules`](../tests/fixtures/profile-storage.rules)에 있습니다.

### 기존 사용자 전체에 일괄 부여

로그인하지 않은 계정까지 즉시 반영하려면 프로젝트의 Firestore 읽기·쓰기 권한이 있는 Application Default Credentials 또는 `GOOGLE_APPLICATION_CREDENTIALS`로 실행합니다. 키 파일은 저장소에 추가하지 않습니다.

```sh
cd functions
npm install
# 변경 대상 수만 확인
node scripts/migrate-usernames.js --project YOUR_PROJECT_ID
# 임의 사용자 이름을 부여
node scripts/migrate-usernames.js --project YOUR_PROJECT_ID --apply
```

페이지 단위로 처리하며 실제 저장 직전에 문서를 다시 확인합니다. 이미 사용자 이름이 있거나 새 가입 절차가 미완료인 계정은 건너뜁니다. 재실행해도 이미 부여한 이름은 바뀌지 않습니다. 기존 데이터는 이름·완료 상태·수정 시각 및 누락된 소개글 기본값만 보완합니다.

## 로컬 검증

Java 21 이상과 Firebase CLI가 필요합니다. 테스트 프로젝트 ID는 운영 프로젝트와 분리된 `demo-spotit`입니다.

```sh
firebase emulators:start --only auth,firestore,storage --project demo-spotit --config tests/firebase.json
# 다른 터미널에서 실행 (Node.js 22.6 이상)
npm run test:profiles
```

개발 서버에서 화면까지 확인하려면 `VITE_USE_FIREBASE_EMULATORS=true`와 `VITE_FIREBASE_PROJECT_ID=demo-spotit`, 테스트용 Firebase 설정을 환경변수로 지정하고 `npm run dev`를 실행합니다. 에뮬레이터 연결은 Vite 개발 모드에서만 적용됩니다.

검증 항목: 문자/길이/사진 검증, 프로필과 사진 저장, 동시 사용자 이름 예약 경쟁, 비로그인 중복 조회, 예약 위조 및 타인 수정 차단, 이름 변경·해제, 기존 사용자 자동 부여·일괄 적용의 재실행 안전성.
