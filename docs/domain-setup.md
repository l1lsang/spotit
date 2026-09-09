# 운영 도메인 설정

운영 주소: **https://spotitmap.kr**

코드에는 `index.html`의 canonical·공유 미리보기·구조화 데이터, `public/robots.txt`, `public/sitemap.xml`에 운영 주소를 지정합니다. 게시글 공유는 현재 접속 주소를 사용하고, PWA와 푸시 알림은 상대 경로를 사용하므로 별도의 호스트 변경이 필요하지 않습니다.

## 카카오 지도와 장소 검색

1. [Kakao Developers](https://developers.kakao.com/)에서 현재 서비스에 사용하는 앱을 선택합니다.
2. **앱 > 플랫폼 키 > JavaScript 키**에서 배포 환경의 `VITE_KAKAO_MAP_JS_KEY`와 같은 키를 선택합니다.
3. **JavaScript SDK 도메인**에 아래 주소를 추가하고 저장합니다. `/map` 같은 경로는 붙이지 않습니다.

   ```text
   https://spotitmap.kr
   http://localhost:5173
   ```

4. `www.spotitmap.kr`에서도 앱을 직접 제공한다면 `https://www.spotitmap.kr`도 추가합니다. 로컬에서 다른 포트나 `127.0.0.1`을 사용하면 해당 개발 주소도 등록합니다.
5. 같은 카카오 앱과 키를 계속 사용하면 키를 재발급할 필요는 없습니다. 키를 변경한 경우에만 `.env`와 배포 환경의 `VITE_KAKAO_MAP_JS_KEY`를 함께 수정하고 다시 빌드·배포합니다.

현재 지도와 장소 검색은 같은 JavaScript 지도 SDK 키를 사용합니다. REST API 키를 `VITE_KAKAO_MAP_JS_KEY`에 넣지 않습니다. 카카오의 **제품 링크 관리 > 웹 도메인**은 카카오톡 공유 등의 링크용 설정이며, 지도용 JavaScript SDK 도메인 등록은 별도로 필요합니다.

공식 안내: [카카오 지도 시작하기](https://apis.map.kakao.com/web/guide/), [개편된 메뉴 위치](https://developers.kakao.com/docs/ko/getting-started/app-key-migration).

## 카카오 로그인 (Firebase OIDC)

이 앱은 `src/services/authService.ts`의 `OAuthProvider('oidc.kakao')`와 Firebase 팝업 로그인으로 인증합니다. 카카오 로그인 콜백은 Firebase가 처리합니다.

1. **Firebase Console > Authentication > Settings > Authorized domains**에 `spotitmap.kr`를 추가합니다. 여기는 `https://`와 경로 없이 도메인만 입력합니다. `www`에서도 앱을 제공하면 `www.spotitmap.kr`도 추가합니다.
2. **Kakao Developers > 카카오 로그인 > 사용 설정**과 **OpenID Connect**가 모두 ON인지 확인합니다.
3. **앱 > 플랫폼 키 > REST API 키**에서 Firebase OIDC의 Client ID로 등록한 키를 선택합니다. **카카오 로그인 리다이렉트 URI**에는 Firebase Console의 OIDC 설정에 표시된 콜백 URL을 등록합니다.

   ```text
   https://<VITE_FIREBASE_AUTH_DOMAIN>/__/auth/handler
   ```

   현재 로컬 `.env`의 `VITE_FIREBASE_AUTH_DOMAIN`은 `naran-235a6.firebaseapp.com`이므로, 배포 환경도 같다면 등록할 값은 다음과 같습니다.

   ```text
   https://naran-235a6.firebaseapp.com/__/auth/handler
   ```

4. 이미 위 콜백을 등록했다면 유지합니다. 현재 Vercel 설정은 SPA 페이지만 제공하므로 `https://spotitmap.kr/__/auth/handler`로 바꾸거나 `VITE_FIREBASE_AUTH_DOMAIN=spotitmap.kr`로 바꾸지 않습니다. 사용자 지정 인증 도메인은 Firebase 인증 핸들러 호스팅을 별도로 구성해야 합니다.
5. 기존에 카카오 로그인이 동작했다면 Firebase OIDC 설정도 그대로 사용합니다. 처음 설정하는 경우 Authentication with Identity Platform을 활성화한 뒤 아래 값으로 OIDC 공급자를 구성합니다.

   | 항목 | 값 |
   | --- | --- |
   | Provider ID | `oidc.kakao` (`VITE_FIREBASE_KAKAO_PROVIDER_ID`와 일치) |
   | 흐름 | Authorization code |
   | Client ID | 로그인에 사용하는 카카오 REST API 키 |
   | Client Secret | 그 REST API 키의 클라이언트 시크릿 |
   | Issuer | `https://kauth.kakao.com` |

   Client Secret은 Firebase Console에만 저장합니다. 앱이 요청하는 닉네임(`profile_nickname`)과 프로필 사진(`profile_image`) 동의항목도 카카오 로그인 설정에서 확인합니다.

`auth/unauthorized-domain` 오류는 Firebase 승인된 도메인을, `KOE006` 오류는 카카오에 등록한 콜백 URI와 실제 `redirect_uri`가 정확히 일치하는지 확인합니다.

공식 안내: [Firebase OIDC](https://firebase.google.com/docs/auth/web/openid-connect), [Firebase OAuth 인증 도메인](https://firebase.google.com/docs/auth/web/google-signin#customizing-the-redirect-domain-for-google-sign-in), [카카오 로그인 설정](https://developers.kakao.com/docs/ko/kakaologin/prerequisite), [카카오 리다이렉트 URI 설정](https://developers.kakao.com/docs/ko/app-setting/app#redirect-uri).

## Google Maps와 배포

- **Google Cloud Console > APIs & Services > Credentials > 지도 API 키**의 웹사이트 제한에도 `https://spotitmap.kr`와 `https://spotitmap.kr/*`를 추가합니다. `www`에서 앱을 제공하면 해당 주소도 추가합니다. 대상 키는 `VITE_GOOGLE_MAPS_API_KEY`입니다. [Google 공식 안내](https://developers.google.com/maps/api-security-best-practices)
- Firebase API 키에도 웹사이트 제한을 별도로 설정했다면 새 운영 주소를 추가하고, 기존 Firebase 인증 도메인 허용은 유지합니다.
- Vercel 프로젝트에 `spotitmap.kr`가 연결된 상태에서 이번 변경을 빌드·배포합니다. 기존 도메인에서 새 도메인으로 이동시키려면 Vercel의 도메인 리다이렉트를 설정합니다. [Vercel 공식 안내](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting)
- 검색엔진 도구에 사이트맵을 제출했다면 `https://spotitmap.kr/sitemap.xml`로 갱신합니다.

## 배포 후 확인

1. `https://spotitmap.kr/map`에서 지도와 장소 검색을 확인합니다.
2. `https://spotitmap.kr/login`에서 카카오·Google 로그인을 확인합니다.
3. `/feed` 등 하위 경로에서 새로고침하고, 게시글 공유 주소가 새 도메인으로 생성되는지 확인합니다.
4. `/robots.txt`와 `/sitemap.xml`이 새 도메인을 가리키는지 확인합니다.
