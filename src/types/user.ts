import type { Timestamp } from 'firebase/firestore'
import type { PostPinGroup } from './post'

export interface DaymarkUser {
  uid: string
  email: string
  nickname: string
  username?: string
  bio?: string
  onboardingComplete?: boolean
  photoURL: string
  pinGroupNames?: Partial<Record<PostPinGroup, string>>
  isPrivate?: boolean
  followerCount?: number
  followingCount?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
