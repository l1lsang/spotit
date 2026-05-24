import type { Timestamp } from 'firebase/firestore'

export interface ChatParticipant {
  uid: string
  nickname: string
  photoURL: string
}

export interface DaymarkChat {
  id: string
  participantIds: string[]
  participants: Record<string, ChatParticipant>
  lastMessage: string
  lastMessageUid?: string
  lastMessageAt?: Timestamp
  readAtBy?: Record<string, Timestamp>
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface ChatMessage {
  id: string
  chatId: string
  uid: string
  authorNickname: string
  content: string
  createdAt?: Timestamp
}
