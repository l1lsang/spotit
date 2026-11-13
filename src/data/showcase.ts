// Copy, screens and scroll timing for the landing page's phone story.
// Screenshots: public/pinori-showcase (original 945×2048 JPG) + web/*-640.webp (resized copies).
// Before publishing, review docs/showcase-release-checklist.md (names, locations, photos in the captures).

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

export const heroCopy = {
  title: ['당신의 순간이,', '하나의 지도가 되다.'],
  lead: '피노리는 사진과 메모를 지도 위 핀으로 남기는 기록 SNS예요. 지나온 장소에 이야기를 남기고, 소중한 순간들을 다시 만나보세요.',
}

export type StoryStepId = 'find' | 'record' | 'revisit'

export interface StoryStep {
  id: StoryStepId
  label: string
  title: string
  body: string
}

export const storySteps: StoryStep[] = [
  {
    id: 'find',
    label: '장소 찾기',
    title: '사진 속 장소를 찾고',
    body: '사진을 고르면 촬영 위치와 날짜를 읽어 핀을 찍을 장소를 먼저 보여줘요. 위치가 다르면 직접 옮길 수 있어요.',
  },
  {
    id: 'record',
    label: '기록 남기기',
    title: '나만의 색으로 순간을 남기고',
    body: '핀 색상과 밝기를 고르고 제목과 메모를 적어요. 팔로워, 전체, 비공개 중 누가 볼지도 정해요.',
  },
  {
    id: 'revisit',
    label: '다시 보기',
    title: '시간이 지나도, 그곳의 이야기는 남으니까',
    body: '남긴 기록은 사진과 함께 피드와 지도에 쌓여요. 팔로우한 사람의 기록도 같은 지도에서 만나요.',
  },
]

/**
 * What the phone shows along the pinned story, by scroll progress (0 at the page top, 1 when the
 * story section unpins). `until` is the progress where the next layer takes over.
 * 'splash' is a brand intro (the PINORI mark, lit once on load), not an app screenshot.
 */
export interface StoryLayer {
  id: string
  until: number
  screen?: ShowcaseScreen
  /** Which copy block is shown on the left: the hero or a story step. */
  copy: 'hero' | StoryStepId
}

export const storyLayers: StoryLayer[] = [
  { id: 'splash', until: 0.12, copy: 'hero' },
  { id: 'home', until: 0.27, screen: screens.home, copy: 'hero' },
  { id: 'photo', until: 0.45, screen: screens.photo, copy: 'find' },
  { id: 'pin', until: 0.6, screen: screens.pin, copy: 'record' },
  { id: 'details', until: 0.75, screen: screens.details, copy: 'record' },
  { id: 'feed', until: Infinity, screen: screens.feed, copy: 'revisit' },
]

/** Progress at which the phone has finished rising into place. */
export const PHONE_RISE_END = 0.1

/** The phone screen used for each step in the static (phone / reduced-motion) layout. */
export const staticStepScreens: Record<StoryStepId, ShowcaseScreen> = {
  find: screens.photo,
  record: screens.pin,
  revisit: screens.feed,
}

export const features = [
  {
    id: 'groups',
    title: '그룹으로 함께 모으는 장소',
    body: '러닝 크루, 동네 맛집처럼 취향이 닮은 사람들과 한 지도에 핀을 모아요. 공개 그룹은 바로, 비공개 그룹은 초대코드로 가입해요.',
    screen: screens.groups,
  },
  {
    id: 'reviews',
    title: '장소마다 쌓이는 실시간 리뷰',
    body: '자리, 조용함, 콘센트처럼 지금 가면 알 수 있는 것만 골라 남겨요. 리뷰는 그룹과 관계없이 모든 사용자에게 보여요.',
    screen: screens.reviews,
  },
]
