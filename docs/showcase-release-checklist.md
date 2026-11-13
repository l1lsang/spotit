# 공식 홈페이지 스크린샷 공개 전 체크리스트

홈페이지(`/`, `/company`)는 `public/pinori-showcase/`의 실제 앱 캡처를 사용합니다. 이 캡처들은 비식별 처리하지 않은 원본 사본이므로, 배포 전에 아래 항목을 확인하세요.

## 캡처별 노출 정보

| 파일 | 사용 위치 | 확인할 내용 |
| --- | --- | --- |
| `01-home-map.jpg` | 랜딩 스토리(지도 홈), Company 제품 | 내 위치(파란 점)와 핀이 한성대학교 주변에 찍혀 있어 생활 반경이 드러남 |
| `02-photo-location.jpg` | 랜딩 스토리(장소 찾기) | 한성대학교 주소, 사진 촬영 일시(2026-11-09 12:46), 사진 썸네일 |
| `03-pin-customize.jpg` | 랜딩 스토리(기록 작성), 모바일 단계 | **정밀 좌표 `37.58463, 127.03127`가 화면 하단에 그대로 보임** — 가리거나 다른 캡처로 교체 권장 |
| `04-record-details.jpg` | 랜딩 스토리, Company 제품 | 기록 제목·장소 이름(공덕역 인근) |
| `05-feed-post.jpg` | 랜딩 스토리(다시 보기) | **작성자 실명 "장경민"**, 프로필 이미지, 캠퍼스 사진, 소모임 이름 |
| `06-groups.jpg` | 기능 카드(그룹) | 특이 사항 낮음 |
| `07-reviews.jpg` | 기능 카드(리뷰), Company 제품 | **리뷰 작성자 실명 "장경민"**, 상태바 알림에 개인 텍스트("성경") |

## 배경 영상·사진 (Scene 01–04)

원본은 `design/showcase-media/`(배포·git 제외), 웹용 사본은 `public/showcase/`에 있습니다.

| 원본 | 웹용 파일 | 장면 | 확인할 내용 |
| --- | --- | --- | --- |
| `1. 도시 풍경.mp4` (4K, 16초) | `scene1-city(.mp4 / -mobile.mp4 / -poster.webp)` | 01 오프닝 | Pexels 영상 (아래 표). 전광판 광고 화면이 보임 |
| `2.장소 발견.mp4` (4K, 8.7초) | `scene2-place(...)` | 02 장소 | Pexels 영상 (아래 표). 행인 얼굴(약 4초)·자동차 번호판(약 6–7초)이 보임 — 사이트 라이선스의 인물 사용 조건 확인 |
| `3. 나의 추억이 펼쳐진다.jpg` | `scene3-sunset(.webp / -mobile.webp)` | 03 노을 | 05 피드 게시물의 원본 사진. 촬영자 게시 동의 확인 (사람 얼굴 없음) |
| `4. 순간 기록.jpg` (5400×3600) | `scene4-cafe(.webp / -mobile.webp)` | 04 카페 | Unsplash 사진 (아래 표). 실내 인물은 흐릿하게 보임 |

### 무료 스톡 영상 출처 기록

무료 라이선스라도 나중에 문의가 오면 받은 곳과 그때의 조건을 보여줄 수 있어야 합니다. 다운로드 페이지 주소와 라이선스 페이지를 저장해 두세요 (라이선스 문구는 바뀔 수 있으니 받은 날짜 기준 캡처 권장).

원본 파일의 다운로드 기록(Windows `Zone.Identifier`)에서 확인한 출처입니다. 제작자 이름은 각 페이지에서 확인해 채우세요.

| 파일 | 사이트 | 페이지 URL | 원본 파일 | 제작자 | 라이선스 |
| --- | --- | --- | --- | --- | --- |
| `1. 도시 풍경.mp4` | Pexels | <https://www.pexels.com/video/37971708/> | `16112996_3840_2160_30fps.mp4` | (페이지에서 확인) | Pexels License |
| `2.장소 발견.mp4` | Pexels | <https://www.pexels.com/video/29354419/> | `12650366_3840_2160_24fps.mp4` | (페이지에서 확인) | Pexels License |
| `4. 순간 기록.jpg` | Unsplash | <https://unsplash.com/photos/zlABb6Gke24> | `clem-onojeghuo-zlABb6Gke24-unsplash.jpg` | Clem Onojeghuo | Unsplash License |

두 라이선스 모두 상업적 이용·수정이 가능하고 출처 표기는 의무가 아닙니다(권장). 라이선스 원문: <https://www.pexels.com/license/> , <https://unsplash.com/license>

대부분의 무료 스톡 라이선스(Pexels, Pixabay 등)에서 공통으로 확인할 조건:

- [ ] 상업적 이용·수정 허용 여부 (홈페이지 배경으로 자르고 다시 인코딩함)
- [ ] 출처 표기 의무 여부 (의무라면 푸터나 `/licenses`에 표기 추가)
- [ ] 알아볼 수 있는 인물이 제품·브랜드를 보증하는 것처럼 보이게 쓰지 않기 — 2번 영상의 행인은 배경으로만 지나가고, 그 위에 앱 홍보 문구가 얹힘
- [ ] 영상 속 전광판·간판 등 다른 브랜드 노출이 피노리와 관련 있어 보이지 않는지

## 공통 확인

- [ ] 실명 노출: 05, 07의 이름을 공개해도 되는지 본인 동의 확인 (안 되면 데모 계정으로 다시 캡처)
- [ ] 위치 노출: 01, 02, 03의 실제 생활 반경·좌표 공개 여부 결정 (03 좌표는 교체 권장)
- [ ] 사진 게시 동의: 05 피드 사진과 02 썸네일의 촬영자·피사체 동의 (현재 사람 얼굴은 보이지 않음)
- [ ] 상태바: 통신사, 카카오톡·인스타그램·Gmail 알림 아이콘, 07의 알림 텍스트 — 깨끗한 상태바로 다시 캡처 권장
- [ ] Google 지도 로고·저작권 표시: 이미지를 잘라내거나 덮지 않기 (현재 레이아웃은 01·02·07 모두 Google 표시가 보이도록 맞춤)
- [ ] 채팅 화면, 개인정보가 많은 프로필 화면은 사용하지 않음 (현재 미사용)

## 캡처를 교체할 때

같은 파일 이름(945×2048 세로 JPG)으로 `public/pinori-showcase/`에 덮어쓴 뒤, 웹용 축소본을 다시 만듭니다.

```bash
cd public/pinori-showcase
python -c "from PIL import Image;import glob,os;[Image.open(f).convert('RGB').resize((640,round(Image.open(f).height*640/Image.open(f).width)),Image.LANCZOS).save('web/'+os.path.splitext(f)[0]+'-640.webp','WEBP',quality=82,method=6) for f in glob.glob('*.jpg')]"
```

배경 영상·사진을 바꿀 때는 원본을 `design/showcase-media/`에 두고 같은 설정으로 다시 인코딩합니다 (ffmpeg 필요).

```bash
# 데스크톱 1600px / 모바일 세로 720×1280 크롭, 오디오 제거, faststart
ffmpeg -i "1. 도시 풍경.mp4" -vf "scale=1600:-2" -an -c:v libx264 -preset slow -crf 29 -maxrate 2.6M -bufsize 6M -pix_fmt yuv420p -movflags +faststart public/showcase/scene1-city.mp4
ffmpeg -i "1. 도시 풍경.mp4" -vf "crop=ih*9/16:ih,scale=720:1280" -an -c:v libx264 -preset slow -crf 28 -maxrate 2M -bufsize 8M -pix_fmt yuv420p -movflags +faststart public/showcase/scene1-city-mobile.mp4
ffmpeg -ss 0.2 -i public/showcase/scene1-city.mp4 -frames:v 1 -c:v libwebp -quality 78 public/showcase/scene1-city-poster.webp
```

장면 순서, 문구, 배경, 초점(`objectPosition`), 오버레이 농도는 `src/data/showcase.ts`에서 바꿉니다.
