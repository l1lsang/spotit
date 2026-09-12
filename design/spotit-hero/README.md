# Spotit · 장소에 남긴 순간

680 × 560 Hero Visual. 사진 기록 3장, 원형 장소 핀 3개, 옅은 도로와 곡선 경로로 구성했습니다.

## 미리보기

- `hero-preview.png`: Hero 단독, 2배 해상도.
- `landing-preview.png`: 첨부된 랜딩페이지 오른쪽에 배치한 미리보기. 왼쪽은 원본을 그대로 사용했습니다.
- `hero-visual.svg`: 사진 3장과 텍스트·벡터가 포함된 독립 SVG. 웹 적용/빠른 확인용입니다.

## Figma에서 편집 가능한 레이어 생성

이번 작업 중 Figma Starter 플랜의 MCP 호출 한도가 소진되어, Figma 캔버스에 직접 쓰기와 Figma 내부 렌더링 검증을 완료하지 못했습니다. 아래 플러그인은 같은 디자인 사양에서 **실제 Figma 오브젝트**를 생성합니다. PNG/SVG 한 장으로 flatten하지 않습니다.

1. ZIP을 압축 해제합니다.
2. Figma **데스크톱 앱**에서 디자인 파일을 엽니다.
3. 캔버스 우클릭 → **Plugins → Development → Import plugin from manifest…**에서 `figma-plugin/manifest.json`을 선택합니다.
4. **Plugins → Development → Spotit · 장소에 남긴 순간**을 실행합니다.
5. 생성된 **Hero Visual** 프레임만 복사해 기존 랜딩페이지 오른쪽 영역에 배치합니다.

Figma 플러그인 가져오기는 [Figma 공식 안내](https://help.figma.com/hc/en-us/articles/38457121114263-Create-a-Figma-Design-plugin-with-the-Figma-MCP-server-and-agentic-tools)의 절차를 따릅니다. 플러그인 ID 관련 오류가 표시되면 Development → New plugin에서 생성한 로컬 플러그인의 manifest ID를 이 패키지의 manifest ID에 넣어 사용하세요. 외부 네트워크나 API 키는 사용하지 않습니다.

Noto Sans KR을 우선 사용합니다. 글꼴 오류가 나면 `assets/NotoSansKR.ttf`를 설치하고 Figma를 다시 여세요. 로컬에 있는 Malgun Gothic을 사용할 수 있으면 대체할 수 있습니다. 원본 이미지와 미리보기의 글꼴 렌더링은 Figma 실행 환경에 따라 미세하게 달라질 수 있습니다.

## 수정 방법

- **사진**: Post Card 인스턴스 안의 `Photo` Rectangle을 선택 → Fill에서 이미지 교체.
- **글**: 인스턴스의 Location title / Caption / Place / Time 속성 수정. 각 Text 레이어에서도 수정 가능.
- **크기**: Post Card의 Size variant에서 Small / Medium / Large 선택.
- **핀**: Location Pin의 Color variant에서 teal / coral / olive 선택.
- **지도**: `Map Background`의 Road와 Route는 각각 Vector. 점 편집 및 곡률·선 두께·투명도 변경 가능.
- **컬러**: `Spotit · Hero / Tokens` 변수에서 변경.
- **그림자**: `Spotit / Post Card · Soft`, `Spotit / Location Pin · Soft` Effect Style에서 변경.

## 생성되는 레이어

```text
Spotit · Editable Hero Package
├ Hero Visual  [680 × 560 Frame]
│ ├ Map Background
│ │ ├ Road 01 … Road 07  [Vector]
│ │ ├ Dotted Lane  [Vector]
│ │ ├ Route  [Vector]
│ │ ├ Map Dots  [Ellipse]
│ │ └ Connection 01 … 03  [Vector]
│ ├ Post Card 02  [Instance · Small]
│ ├ Post Card 03  [Instance · Medium]
│ ├ Post Card 01  [Instance · Large]
│ │ ├ Photo  [Rectangle + Image Fill]
│ │ └ Content  [Auto Layout]
│ │   ├ Location  [Text]
│ │   ├ Caption  [Text]
│ │   └ Metadata  [Auto Layout]
│ │     ├ Place and Time  [Icon + Text + Text]
│ │     └ Action  [Vector + Text]
│ ├ Pin 01 … 03  [Instance]
│ └ Journal Notes  [Text]
└ Components
  ├ Post Card  [Component Set · 3 size variants]
  ├ Location Pin  [Component Set · 3 color variants]
  └ Editing Guide
```

카드와 핀의 위치는 콜라주를 위해 절대 좌표를 사용하고, 카드 내부 및 핀 내부는 Auto Layout을 사용합니다. 플러그인은 기존 객체를 삭제하거나 수정하지 않고 빈 공간에 추가합니다.

## 검증 상태

- 브라우저에서 한글 웹폰트 로딩과 680×560 / 원본 2598×1276 배치 렌더링을 확인했습니다.
- 사진 3개, 게시물 3개, 핀 3개를 확인했습니다.
- 제목·본문·시간·아이콘이 다른 카드에 가려지지 않도록 겹침을 조정했습니다.
- 플러그인 JavaScript 구문 검사와 제공된 Figma API 타입 검사를 수행했습니다.
- **Figma 실제 실행 및 Figma 렌더링 검증은 호출 한도 때문에 미완료입니다.**

## 사진과 폰트

사진은 built-in image_gen으로 만든 예시 이미지이며 실제 특정 장소를 촬영한 기록은 아닙니다. 개별 원본 PNG와 배치용 JPG를 `assets/`에 포함했습니다. 프롬프트 원문은 `photo-prompts.json`에 있습니다.

Noto Sans KR: Google Fonts, SIL Open Font License. 라이선스는 `assets/FONT-LICENSE.txt`에 있습니다.

개발 소스의 `LandingPage.tsx`와 CSS는 수정하지 않았습니다. 이 결과물은 Figma 제작물/디자인 전달 패키지입니다.
