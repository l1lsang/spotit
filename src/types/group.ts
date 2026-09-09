import type { Timestamp } from 'firebase/firestore'

export interface PinGroup {
  id: string
  name: string
  description: string
  ownerUid: string
  memberCount: number
  createdAt: Timestamp
}

export interface GroupInput {
  name: string
  description: string
}

export function getGroupInputError(input: GroupInput): string {
  if (input.name.trim().length < 2 || input.name.trim().length > 40) return '그룹 이름은 2~40자로 입력해 주세요.'
  if (input.description.trim().length > 240) return '그룹 소개는 240자 이내로 입력해 주세요.'
  return ''
}
