# 스팟잇 디자인 시스템

Hallmark를 적용한 장소·사진 기록 서비스의 공통 디자인 기준입니다.
전체 앱은 이 시스템을 공유하고, 새 화면도 `tokens.css`를 사용합니다.

## 방향

사진과 사용자의 기록이 먼저 보이는 차분한 사진 기록장.
기존 Spotit 로고와 청록색 정체성, 장소 사진, 라우트와 기능을 유지합니다.
범용 카드 장식, 불필요한 영문 라벨, 과도한 그림자와 반투명 효과를 줄입니다.

## 화면 구성

- 시작 화면: Photographic. 큰 장소 사진과 기록을 나란히 놓고 직접 선택하는 장소 목록을 제공합니다. 자동 전환은 없습니다. 예시 기록임을 표시합니다.
- 로그인·가입: 사진과 폼을 나란히 배치합니다. 960px 이하에서는 입력 폼에 집중합니다.
- 앱: Workbench. 페이지 제목, 검색·필터, 사용자 콘텐츠 순서. 지도는 전체 화면을 활용합니다.
- 정책·라이선스: Long Document. 읽기 너비와 문서 구조를 유지합니다.
- 탐색: 데스크톱은 상단 메뉴, 860px 이하는 하단 탭. 그룹은 지도 섹션에 속합니다.

## 색과 글꼴

색상과 크기의 구현 원본은 [tokens.css](tokens.css)입니다.

- 바탕: `--bg`, 거의 흰 중립색. 콘텐츠: `--paper`, 보조면: `--surface`.
- 본문: `--ink`. 보조 정보: `--muted`. 테두리: `--line`.
- 주요 행동과 선택: `--primary`, 청록색. 주요 버튼 글자는 `--paper`.
- 오류: `--danger`. 저장된 핀의 사용자 지정 색상은 유지합니다.
- 한글·영문: 자체 호스팅한 Pretendard Variable. 본문 400, 버튼 600, 제목 650.
- 단일 글꼴은 한국어 앱의 읽기와 일관성을 위한 선택입니다. 기존 로고 이미지는 별도로 유지합니다.
- 제목은 정체로 작성합니다. 페이지 제목 28–38px, 첫 화면 제목 44–76px. 본문은 16px, 보조 정보는 12–14px입니다.

## 컴포넌트

- 4px 간격 기반 `--space-*` 토큰. 입력란과 버튼은 44–48px 높이.
- 버튼·입력 6px, 사진 3–6px, 대화상자 12px 반경.
- 목록은 구분선, 사진은 여백으로 나눕니다. 프로필 사진은 원형입니다.
- 지도 제어와 대화상자에만 필요한 그림자를 사용합니다.
- hover, 선택, disabled, busy, error, focus 상태는 원래 기능과 연결합니다.
- 키보드 포커스는 즉시 나타나는 2px 청록색 외곽선. 폼의 경계 두께는 상태마다 변하지 않습니다.
- 움직임은 버튼 누름으로 한정합니다. `prefers-reduced-motion`에서는 공간 이동을 없앱니다.
- 320, 375, 414, 768, 1440px에서 가로 넘침을 검사합니다.

## 적용 범위

| 파일 | 역할 |
| --- | --- |
| LandingPage / LandingHero | 사진 기반 시작 화면과 기록 선택 |
| LoginPage / SignupPage | 로그인, 계정·프로필 가입 단계 |
| MapPage | 지도, 검색, 모드, 그룹 선택, 핀 미리보기 |
| FeedPage / MyPostsPage / LikedPostsPage | 기록 목록과 반응 |
| PostDetailPage | 사진, 장소 상세, 댓글, 수정 폼 |
| GroupsPage / GroupDetailPage | 그룹 검색, 가입, 공동 기록 |
| PeoplePage / PersonProfilePage / ProfilePage | 사람 검색, 프로필, 핀 앨범 |
| ProfileSettingsPage | 프로필·계정·핀 테마 설정 |
| ChatListPage / ChatRoomPage | 대화 목록, 메시지, 미디어 |
| NotificationsPage / SupportPage | 알림과 고객지원 |
| PoliciesPage / OpenSourceLicensesPage | 정책 및 라이선스 문서 |
| AdminPage | 운영 도구 |
| Header / BottomNav / InstallPrompt | 공통 탐색과 설치 안내 |

공통 표현은 `src/styles/design-system.css`, 시작 화면은 `src/styles/landing.css`에서 관리합니다.
기존 `globals.css`와 각 기능의 CSS는 레이아웃·동작 규칙을 유지하며, 공통 표현만 덧씌웁니다.
지도의 공급자 UI, 소셜 로그인 브랜드 색, 사용자가 지정한 핀 색은 공통 팔레트의 예외입니다.

## 자산과 출처

- 디자인 방법: [Hallmark](https://github.com/Nutlope/hallmark), 개인 스킬로 설치.
- 글꼴: [Pretendard v1.3.9](https://github.com/orioncactus/pretendard), SIL Open Font License 1.1. 원문은 `public/fonts/OFL.txt`에 포함.
- 사진: 프로젝트에 기존 포함된 `src/assets/landing/*.webp` 재사용.
- 기존 로고와 제작자 표기를 유지합니다.

네트워크·인증·데이터 검증과 UI 테스트 데이터 렌더링을 구분해 기록합니다. 테스트 데이터는 실제 서비스에 저장하지 않습니다.

## 검증 기록 — 2026-10-14

- 공개 화면 7개 × 5개 너비, 로그인 상태 화면 13개 × 5개 너비를 브라우저에서 확인했습니다. 가로 넘침과 브라우저 실행 오류가 없었습니다.
- 로그인 상태 검증에는 브라우저에서만 동작하는 테스트 데이터를 사용했습니다. 실제 Firebase 로그인·쓰기 통합 검증을 의미하지 않습니다.
- 사진 선택(마우스·키보드), 시작하기 링크, 설치 안내 닫기 유지, 그룹 필터·만들기 창, 사람 검색, 게시물 수정 창, 게스트 피드 로그인 이동, 글꼴 라이선스 열기를 확인했습니다.
- 모바일 게시물 상세는 제목과 사진이 먼저 나오며, 주소와 지도는 본문 뒤에 표시됩니다.
- 주요 글자/배경 조합 5쌍의 명암비는 5.23:1–16.13:1입니다. 1280×800에서 첫 화면의 주요 버튼이 스크롤 없이 보입니다.
- `npm run build`, `npx eslint src`, 설치 안내·그룹 탐색·피드/채팅 도구·라이선스 관련 기존 테스트 27개가 통과했습니다.
- 전체 `npm run lint`는 기존 Figma 보조 파일 `design/spotit-hero/plugin-globals.d.ts:2`의 `no-explicit-any` 오류가 남아 있습니다. 이번 수정 범위 밖의 파일입니다.
- 빌드는 기존 앱·라이선스 청크의 500kB 초과 경고를 출력합니다.
