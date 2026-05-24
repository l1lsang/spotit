import type { Timestamp } from 'firebase/firestore'

export function getTodayDateKey(): string {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60_000

  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

export function formatDateKey(dateKey: string): string {
  return dateKey.replaceAll('-', '.')
}

export function formatTimestamp(timestamp?: Timestamp): string {
  if (!timestamp) {
    return ''
  }

  return timestamp.toDate().toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
