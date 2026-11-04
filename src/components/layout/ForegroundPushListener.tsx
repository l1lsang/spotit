import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'

// Firebase Messaging loads only for signed-in users who already granted notifications.
const loadPushService = () => import('../../services/pushNotificationService')

export function ForegroundPushListener() {
  const { currentUser } = useAuth()

  useEffect(() => {
    if (!currentUser || !('Notification' in window) || Notification.permission !== 'granted') {
      return undefined
    }

    let unsubscribe: (() => void) | undefined
    let canceled = false

    void loadPushService().then(({ subscribeToForegroundPushMessages }) => subscribeToForegroundPushMessages((payload) => {
      if (canceled || Notification.permission !== 'granted') {
        return
      }

      const title = payload.data?.title || payload.notification?.title || '피노리'
      const body = payload.data?.body || payload.notification?.body || ''
      const href = payload.data?.href || '/notifications'
      const notification = new Notification(title, {
        body,
        icon: '/icon-512.png',
        badge: '/badge-96.png',
        data: { href },
      })

      notification.onclick = () => {
        window.focus()
        window.location.assign(href)
      }
    })).then((nextUnsubscribe) => {
      unsubscribe = nextUnsubscribe
    })

    return () => {
      canceled = true
      unsubscribe?.()
    }
  }, [currentUser])

  return null
}
