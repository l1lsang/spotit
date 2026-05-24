import type { Timestamp } from 'firebase/firestore'

export interface PostComment {
  id: string
  uid: string
  authorNickname: string
  content: string
  createdAt: Timestamp
}
