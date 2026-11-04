# 피노리 로고 파일

2026-11-04에 전달된 `public/app-icon-1024.png`(1024×1024, 흰 배경)와 `public/plnorl logo.png`(심벌 + 영문 PINORI 가로형, 투명 배경)를 원본으로 사용합니다.

| 파일 (`public/`) | 원본 / 용도 |
| --- | --- |
| `app-icon-1024.png` | 전달된 원본 앱 아이콘 |
| `plnorl logo.png` | 전달된 원본 가로형 로고 |
| `logo-wordmark.png` | `plnorl logo.png` 여백을 잘라 1010×256으로 축소. 상단·로그인·회원가입 화면 |
| `logo-mark.png` | 앱 아이콘의 흰 배경을 투명하게 바꾸고 심벌만 잘라 437×512로 축소. 관리자 화면 |
| `favicon-32.png`, `favicon-64.png` | 원본 축소. 브라우저 탭 |
| `apple-touch-icon.png` | 원본 180×180 축소. iOS 홈 화면 |
| `icon-192.png`, `icon-512.png` | 원본 축소. 설치 안내·홈 화면·푸시 알림·공유 미리보기 |
| `badge-96.png` | 심벌 모양의 흰색 실루엣(투명 배경). 안드로이드 알림 배지 |

아이콘 URL에는 `?v=20261104`를 붙이고 서비스 워커 캐시를 `spotit-shell-v6`로 갱신했습니다. 다음 교체 시에도 아이콘 URL 버전과 서비스 워커의 사전 캐시 목록을 함께 수정합니다.
