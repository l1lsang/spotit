import type { Timestamp } from 'firebase/firestore'

export type PostVisibility = 'followers' | 'private' | 'public' | 'group'

export interface PinTheme {
  id: string
  name: string
  color: string
}

export const DEFAULT_POST_PIN_COLOR = '#e8674f'
export const FOLLOWING_PIN_COLOR = '#e03b2f'
export const PIN_THEME_NAME_MAX_LENGTH = 18

export const PIN_COLOR_PALETTE = [
  { name: '피치 코랄', color: '#e88c78' },
  { name: '더스티 로즈', color: '#c9758b' },
  { name: '라벤더', color: '#9380c4' },
  { name: '페리윙클', color: '#7e91ca' },
  { name: '클라우드 블루', color: '#6f9fbd' },
  { name: '오션 틸', color: '#4c9895' },
  { name: '세이지', color: '#8aa88b' },
  { name: '올리브', color: '#969b65' },
  { name: '허니 골드', color: '#d4aa58' },
  { name: '살구', color: '#dda074' },
  { name: '모카', color: '#a18478' },
  { name: '슬레이트', color: '#788797' },
] as const

export function parsePinColorCode(value: string): string | null {
  const hex = value.trim().replace(/^#/, '')
  if (/^[\da-f]{6}$/i.test(hex)) return `#${hex.toLowerCase()}`
  if (/^[\da-f]{3}$/i.test(hex)) return `#${[...hex.toLowerCase()].map(char => char + char).join('')}`
  return null
}

// Preserve colors on records saved before custom themes were introduced.
const legacyPinColors: Record<string, string> = {
  default: DEFAULT_POST_PIN_COLOR, cafe: '#2b756d', food: '#bc7a1f',
  study: '#297e99', date: '#c44b6a', solo: '#6d7f42', walk: '#4f5f9f',
}

export function normalizePinColor(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_POST_PIN_COLOR
  const color = parsePinColorCode(value)
  if (color) return color
  return Object.hasOwn(legacyPinColors, value) ? legacyPinColors[value] : DEFAULT_POST_PIN_COLOR
}

export function getPinThemeError(theme: PinTheme): string {
  if (!/^[\w-]{1,80}$/.test(theme.id)) return '핀 테마 정보를 확인해 주세요.'
  if (!theme.name.trim() || theme.name.trim().length > PIN_THEME_NAME_MAX_LENGTH) return `테마 이름은 1~${PIN_THEME_NAME_MAX_LENGTH}자로 입력해 주세요.`
  if (!/^#[\da-f]{6}$/i.test(theme.color)) return '핀 색상을 선택해 주세요.'
  return ''
}

export function getPostPinColor(post: Pick<Post, 'pinColor' | 'pinThemeId'>, themes: PinTheme[] = []): string {
  const theme = themes.find((item) => item.id === post.pinThemeId)
  return normalizePinColor(theme?.color || post.pinColor)
}

export function getPostMarkerColor(post: Pick<Post, 'uid' | 'pinColor' | 'pinThemeId'>, currentUid?: string, themes: PinTheme[] = []): string {
  return currentUid && post.uid === currentUid ? getPostPinColor(post, themes) : FOLLOWING_PIN_COLOR
}

export interface Post {
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
  visibility: PostVisibility
  pinColor: string
  pinThemeId?: string
  photoUrls: string[]
  groupId?: string
  likeCount: number
  commentCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PostFormInput {
  groupId?: string
  title: string
  content: string
  placeName: string
  address: string
  lat: number
  lng: number
  dateKey: string
  visibility: PostVisibility
  pinColor: string
  pinThemeId?: string
}
