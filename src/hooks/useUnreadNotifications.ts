import { useEffect, useState } from 'react'
import { subscribeToUnreadNotificationCount } from '../services/notificationService'

export function useUnreadNotifications(uid?: string) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!uid) {
      setUnreadCount(0)
      return undefined
    }

    return subscribeToUnreadNotificationCount(uid, setUnreadCount, () => setUnreadCount(0))
  }, [uid])

  return unreadCount
}
