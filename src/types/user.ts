import type { Timestamp } from 'firebase/firestore'

export interface DaymarkUser {
  uid: string
  email: string
  nickname: string
  photoURL: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
