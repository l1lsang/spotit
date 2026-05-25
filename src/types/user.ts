import type { Timestamp } from 'firebase/firestore'

export interface DaymarkUser {
  uid: string
  email: string
  nickname: string
  photoURL: string
  isPrivate?: boolean
  followerCount?: number
  followingCount?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
