import type { Timestamp } from 'firebase/firestore'

export type PostVisibility = 'public' | 'private'

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
}
