import { Bell, BellRing, BellOff, CheckCheck, MessageCircle, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { formatTimestamp } from '../lib/date'
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToNotifications,
} from '../services/notificationService'
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushPermissionStatus,
  type PushPermissionStatus,
} from '../services/pushNotificationService'
import type { DaymarkNotification } from '../types/notification'

function getNotificationIcon(type: DaymarkNotification['type']) {
  if (type === 'follow') {
    return UserPlus
  }

  if (type === 'chat' || type === 'comment' || type === 'reply') {
    return MessageCircle
  }

  return Bell
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const { currentUser, firebaseReady } = useAuth()
  const [notifications, setNotifications] = useState<DaymarkNotification[]>([])
  const [pushStatus, setPushStatus] = useState<PushPermissionStatus>('prompt')
  const [pushMessage, setPushMessage] = useState('')
  const [pushSubmitting, setPushSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!firebaseReady || !currentUser) {
      setLoading(false)
      return undefined
    }

    setLoading(true)

    return subscribeToNotifications(
      currentUser.uid,
      (nextNotifications) => {
        setNotifications(nextNotifications)
        setLoading(false)
      },
      (subscribeError) => {
        setError(subscribeError instanceof Error ? subscribeError.message : '알림을 불러오지 못했습니다.')
        setLoading(false)
      },
    )
  }, [currentUser, firebaseReady])

  useEffect(() => {
    void getPushPermissionStatus().then(setPushStatus)
  }, [])

  async function handleOpenNotification(notification: DaymarkNotification) {
    if (!currentUser) {
      return
    }

    if (!notification.readAt) {
      await markNotificationAsRead(currentUser.uid, notification.id)
    }

    navigate(notification.href)
  }

  async function handleReadAll() {
    if (!currentUser) {
      return
    }

    await markAllNotificationsAsRead(currentUser.uid)
  }

  async function handleEnablePush() {
    if (!currentUser) {
      return
    }

    setPushSubmitting(true)
    setPushMessage('')

    try {
      await enablePushNotifications(currentUser.uid)
      setPushStatus(await getPushPermissionStatus())
      setPushMessage('휴대폰 푸시 알림이 켜졌습니다.')
    } catch (pushError) {
      setPushStatus(await getPushPermissionStatus())
      setPushMessage(pushError instanceof Error ? pushError.message : '푸시 알림 설정에 실패했습니다.')
    } finally {
      setPushSubmitting(false)
    }
  }

  async function handleDisablePush() {
    if (!currentUser) {
      return
    }

    setPushSubmitting(true)
    setPushMessage('')

    try {
      await disablePushNotifications(currentUser.uid)
      setPushMessage('이 기기의 푸시 알림을 껐습니다.')
    } catch (pushError) {
      setPushMessage(pushError instanceof Error ? pushError.message : '푸시 알림 해제에 실패했습니다.')
    } finally {
      setPushSubmitting(false)
    }
  }

  return (
    <PageContainer className="content-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1>알림</h1>
          <p>채팅, 팔로우, 좋아요, 댓글 소식을 모아봅니다.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void handleReadAll()}>
          <CheckCheck size={17} aria-hidden="true" />
          모두 읽음
        </button>
      </section>

      {error && <p className="form-error">{error}</p>}
      <section className="push-panel">
        <div>
          <strong>휴대폰 푸시 알림</strong>
          <p>
            {pushStatus === 'granted'
              ? '이 기기에서 푸시 알림을 받을 수 있습니다.'
              : pushStatus === 'denied'
                ? '브라우저 설정에서 알림 권한을 허용해야 합니다.'
                : pushStatus === 'not-configured'
                  ? 'Firebase Web Push 인증서 키가 필요합니다.'
                  : pushStatus === 'unsupported'
                    ? '이 브라우저는 웹 푸시를 지원하지 않습니다.'
                    : '채팅, 팔로우, 댓글 알림을 휴대폰에서도 받아보세요.'}
          </p>
        </div>
        {pushStatus === 'granted' ? (
          <button className="button button-secondary" type="button" onClick={() => void handleDisablePush()} disabled={pushSubmitting}>
            <BellOff size={17} aria-hidden="true" />
            이 기기 끄기
          </button>
        ) : (
          <button
            className="button button-primary"
            type="button"
            onClick={() => void handleEnablePush()}
            disabled={pushSubmitting || pushStatus === 'unsupported' || pushStatus === 'not-configured'}
          >
            <BellRing size={17} aria-hidden="true" />
            {pushSubmitting ? '설정 중' : '푸시 켜기'}
          </button>
        )}
      </section>
      {pushMessage && <p className={pushStatus === 'granted' ? 'form-success' : 'form-error'}>{pushMessage}</p>}
      {loading && <p className="empty-text">알림을 불러오는 중입니다.</p>}

      {!loading && notifications.length === 0 ? (
        <p className="empty-text">아직 알림이 없습니다.</p>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => {
            const Icon = getNotificationIcon(notification.type)
            const isUnread = !notification.readAt

            return (
              <button
                className={`notification-row ${isUnread ? 'unread' : ''}`}
                key={notification.id}
                type="button"
                onClick={() => void handleOpenNotification(notification)}
              >
                {notification.actorPhotoURL ? (
                  <img className="chat-avatar" src={notification.actorPhotoURL} alt={`${notification.actorNickname} 프로필`} />
                ) : (
                  <span className="notification-icon">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                )}
                <span className="notification-main">
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <time>{formatTimestamp(notification.createdAt)}</time>
                </span>
                {isUnread && <i aria-label="읽지 않은 알림" />}
              </button>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
