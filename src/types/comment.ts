import type { Timestamp } from 'firebase/firestore'

export interface PostComment {
  id: string
  uid: string
  authorNickname: string
  content: string
  replyCount?: number
  replies: PostReply[]
  createdAt: Timestamp
}

export interface PostReply {
  id: string
  commentId: string
  uid: string
  authorNickname: string
  content: string
  createdAt: Timestamp
}
