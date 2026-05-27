import type { Timestamp } from 'firebase/firestore'

export const LIVE_PLACE_STATUS_OPTIONS = [
  { id: 'crowded', label: '지금 붐빔' },
  { id: 'seats', label: '자리 많음' },
  { id: 'quiet', label: '조용함' },
  { id: 'waiting', label: '웨이팅 있음' },
  { id: 'outlets', label: '콘센트 있음' },
  { id: 'goodMood', label: '분위기 좋음' },
  { id: 'solo', label: '혼밥 가능' },
  { id: 'study', label: '공부 가능' },
] as const

export type LivePlaceStatusKey = (typeof LIVE_PLACE_STATUS_OPTIONS)[number]['id']

export const PROJECT_PIN_COLORS = [
  { id: 'coral', label: '코랄', value: '#e8674f' },
  { id: 'teal', label: '틸', value: '#2b756d' },
  { id: 'olive', label: '올리브', value: '#6d7f42' },
  { id: 'sky', label: '스카이', value: '#297e99' },
  { id: 'rose', label: '로즈', value: '#c44b6a' },
  { id: 'gold', label: '골드', value: '#bc7a1f' },
  { id: 'indigo', label: '인디고', value: '#4f5f9f' },
] as const

export type ProjectPinColor = (typeof PROJECT_PIN_COLORS)[number]['id']

export const DEFAULT_PROJECT_PIN_COLOR: ProjectPinColor = 'coral'

const livePlaceStatusIds = new Set<string>(LIVE_PLACE_STATUS_OPTIONS.map((option) => option.id))
const projectPinColorIds = new Set<string>(PROJECT_PIN_COLORS.map((color) => color.id))

export function isLivePlaceStatusKey(value: string): value is LivePlaceStatusKey {
  return livePlaceStatusIds.has(value)
}

export function isProjectPinColor(value: string): value is ProjectPinColor {
  return projectPinColorIds.has(value)
}

export function getProjectPinColorValue(color: ProjectPinColor | string | undefined): string {
  return (
    PROJECT_PIN_COLORS.find((pinColor) => pinColor.id === color)?.value ||
    PROJECT_PIN_COLORS.find((pinColor) => pinColor.id === DEFAULT_PROJECT_PIN_COLOR)?.value ||
    '#e8674f'
  )
}

export interface LivePlaceStatusUpdate {
  id: string
  placeId: string
  placeName: string
  address: string
  lat: number
  lng: number
  tags: LivePlaceStatusKey[]
  note: string
  uid: string
  authorNickname: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface LivePlaceStatusInput {
  placeId: string
  placeName: string
  address: string
  lat: number
  lng: number
  tags: LivePlaceStatusKey[]
  note: string
}

export interface PlaceProject {
  id: string
  name: string
  description: string
  pinColor: ProjectPinColor
  ownerUid: string
  ownerNickname: string
  memberUids: string[]
  memberEmails: string[]
  memberNicknames: string[]
  pinCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PlaceProjectInput {
  name: string
  description: string
  pinColor: ProjectPinColor
}

export interface ProjectPin {
  id: string
  projectId: string
  placeId: string
  placeName: string
  address: string
  lat: number
  lng: number
  note: string
  uid: string
  authorNickname: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ProjectPinInput {
  projectId: string
  placeId: string
  placeName: string
  address: string
  lat: number
  lng: number
  note: string
}

export interface ProjectPinMapMarker extends ProjectPin {
  projectName: string
  pinColor: ProjectPinColor
}
