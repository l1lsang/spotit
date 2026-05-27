import type { Timestamp } from 'firebase/firestore'

export type PostVisibility = 'followers' | 'private' | 'public'

export const POST_PIN_GROUPS = [
  { id: 'default', label: '기본', value: '#e8674f' },
  { id: 'cafe', label: '카페', value: '#2b756d' },
  { id: 'food', label: '맛집', value: '#bc7a1f' },
  { id: 'study', label: '공부', value: '#297e99' },
  { id: 'date', label: '데이트', value: '#c44b6a' },
  { id: 'solo', label: '혼밥', value: '#6d7f42' },
  { id: 'walk', label: '산책', value: '#4f5f9f' },
] as const

export type PostPinGroup = (typeof POST_PIN_GROUPS)[number]['id']

export const DEFAULT_POST_PIN_GROUP: PostPinGroup = 'default'

const postPinGroupIds = new Set<string>(POST_PIN_GROUPS.map((group) => group.id))

export function isPostPinGroup(value: string): value is PostPinGroup {
  return postPinGroupIds.has(value)
}

export function getPostPinGroupColor(pinGroup: PostPinGroup | string | undefined): string {
  return (
    POST_PIN_GROUPS.find((group) => group.id === pinGroup)?.value ||
    POST_PIN_GROUPS.find((group) => group.id === DEFAULT_POST_PIN_GROUP)?.value ||
    '#e8674f'
  )
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
  pinColor: PostPinGroup
  photoUrls: string[]
  likeCount: number
  commentCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PostFormInput {
  title: string
  content: string
  placeName: string
  address: string
  lat: number
  lng: number
  dateKey: string
  visibility: PostVisibility
  pinColor: PostPinGroup
}
