// Content, media and screens for the landing page's cinematic showcase.
// - App screenshots: public/pinori-showcase (945×2048 JPG) + web/*-640.webp (resized copies)
// - Scene media: public/showcase (web copies; originals are kept outside public in design/showcase-media)
// Before publishing, review docs/showcase-release-checklist.md (names, locations, faces, plates, media licences).

export interface ShowcaseScreen {
  id: string
  /** File name without extension in public/pinori-showcase. */
  file: string
  alt: string
}

export const screens = {
  home: { id: 'home', file: '01-home-map', alt: '피노리 앱 지도 홈 화면. 내 핀과 팔로잉 핀이 색깔별로 지도 위에 찍혀 있다.' },
  photo: { id: 'photo', file: '02-photo-location', alt: '사진에서 찾은 장소를 지도에 보여주고 이 위치로 기록할지 묻는 화면.' },
  pin: { id: 'pin', file: '03-pin-customize', alt: '핀 색상과 밝기를 고르고 메모를 적는 기록 작성 화면.' },
  details: { id: 'details', file: '04-record-details', alt: '기록 제목, 장소 이름, 날짜, 공개 범위와 핀 색상을 정하는 화면.' },
  feed: { id: 'feed', file: '05-feed-post', alt: '노을 진 캠퍼스 사진이 올라간 피드 기록 화면.' },
  groups: { id: 'groups', file: '06-groups', alt: '그룹을 찾아 가입하거나 초대코드로 들어가는 그룹 화면.' },
  reviews: { id: 'reviews', file: '07-reviews', alt: '장소 상세와 자리, 조용함, 콘센트 같은 항목으로 남긴 실시간 리뷰 화면.' },
} satisfies Record<string, ShowcaseScreen>

export function screenSrc(file: string) {
  return {
    src: `/pinori-showcase/web/${file}-640.webp`,
    srcSet: `/pinori-showcase/web/${file}-640.webp 640w, /pinori-showcase/${file}.jpg 945w`,
  }
}

/** Where things sit inside the 945×2048 captures, as fractions of the screen. */
export const screenSpots = {
  /** The sunset photo in 05-feed-post (a centred square crop of the original). */
  feedPhoto: { top: 395 / 2048, height: 945 / 2048 },
  /** Highlights drawn over real UI, never a copy of it: centre x/y and size as a share of the width. */
  homePin: { x: 524 / 945, y: 1050 / 2048, size: 0.16, round: true },
  photoMarker: { x: 475 / 945, y: 530 / 2048, size: 0.17, round: false },
}

export interface MediaAsset {
  type: 'image' | 'video'
  src: string
  poster?: string
  /** CSS object-position: the focal point kept on screen when the media is cropped by cover. */
  objectPosition?: string
  /** Intrinsic size, needed where the layout is computed (the sunset expansion). */
  width?: number
  height?: number
}

export type SceneId = 'beginning' | 'place' | 'moment' | 'yours'

export interface ShowcaseScene {
  id: SceneId
  title: string[]
  description?: string[]
  /** Screens the phone shows during the scene, in order. */
  phoneScreens: ShowcaseScreen[]
  background: MediaAsset
  mobileBackground?: MediaAsset
  /** Darkening over the background so white copy stays readable (0–1). */
  overlayOpacity: number
}

export const showcaseScenes: ShowcaseScene[] = [
  {
    id: 'beginning',
    title: ['당신의 순간이,', '하나의 지도가 되다.'],
    description: ['지나온 장소에 이야기를 남기고,', '소중한 순간들을 다시 만나보세요.'],
    phoneScreens: [],
    background: { type: 'video', src: '/showcase/scene1-city.mp4', poster: '/showcase/scene1-city-poster.webp', objectPosition: '50% 50%' },
    mobileBackground: { type: 'video', src: '/showcase/scene1-city-mobile.mp4', poster: '/showcase/scene1-city-mobile-poster.webp' },
    overlayOpacity: 0.52,
  },
  {
    id: 'place',
    title: ['우리가 지나온 모든 장소에는', '저마다의 이야기가 있습니다.'],
    phoneScreens: [screens.home],
    background: { type: 'video', src: '/showcase/scene2-place.mp4', poster: '/showcase/scene2-place-poster.webp', objectPosition: '50% 50%' },
    mobileBackground: { type: 'video', src: '/showcase/scene2-place-mobile.mp4', poster: '/showcase/scene2-place-mobile-poster.webp' },
    overlayOpacity: 0.5,
  },
  {
    id: 'moment',
    title: ['그날의 하늘도,', '그때의 마음도.'],
    description: ['기억하고 싶은 순간을', '피노리에 남겨보세요.'],
    phoneScreens: [screens.photo, screens.feed],
    // The original photo of the sunset post in 05-feed-post. Portrait 9:16: cover keeps the pink sky on a wide screen.
    background: { type: 'image', src: '/showcase/scene3-sunset.webp', objectPosition: '50% 28%', width: 2252, height: 4000 },
    mobileBackground: { type: 'image', src: '/showcase/scene3-sunset-mobile.webp', objectPosition: '50% 45%', width: 2252, height: 4000 },
    overlayOpacity: 0.3,
  },
  {
    id: 'yours',
    title: ['나만의 색으로,', '나만의 이야기를.'],
    description: ['사진과 감정, 그리고 장소를', '하나의 기록으로 남겨보세요.'],
    phoneScreens: [screens.details, screens.pin],
    background: { type: 'image', src: '/showcase/scene4-cafe.webp', objectPosition: '62% 50%', width: 5400, height: 3600 },
    mobileBackground: { type: 'image', src: '/showcase/scene4-cafe-mobile.webp', objectPosition: '66% 50%', width: 5400, height: 3600 },
    // The phone UI leads here: a darker veil keeps the photo quiet behind it.
    overlayOpacity: 0.58,
  },
]

export const showcaseScene = (id: SceneId) => showcaseScenes.find(scene => scene.id === id)!

export const features = [
  {
    id: 'feed',
    title: '기록이 이야기로 남는 피드',
    body: '사진과 메모를 남기면 피드에 한 편의 이야기로 쌓여요. 팔로우한 사람과 좋아요, 댓글로 기록을 나눠요.',
    screen: screens.feed,
  },
  {
    id: 'groups',
    title: '취향을 함께 모으는 그룹',
    body: '러닝 크루, 동네 맛집처럼 취향이 닮은 사람들과 한 지도에 핀을 모아요. 공개 그룹은 바로, 비공개 그룹은 초대코드로 가입해요.',
    screen: screens.groups,
  },
  {
    id: 'reviews',
    title: '지금 그 장소의 실시간 리뷰',
    body: '자리, 조용함, 콘센트처럼 지금 가면 알 수 있는 것만 골라 남겨요. 리뷰는 그룹과 관계없이 모든 사용자에게 보여요.',
    screen: screens.reviews,
  },
]
