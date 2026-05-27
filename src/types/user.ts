import type { Timestamp } from 'firebase/firestore'
import type { PostPinGroup } from './post'

export interface DaymarkUser {
  uid: string
  email: string
  nickname: string
  photoURL: string
  pinGroupNames?: Partial<Record<PostPinGroup, string>>
  isPrivate?: boolean
  followerCount?: number
  followingCount?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
