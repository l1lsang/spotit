import { BellRing, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  enablePushNotifications,
  getPushPermissionStatus,
  type PushPermissionStatus,
} from '../../services/pushNotificationService'

const dismissedStorageKey = 'spotit-push-permission-prompt-dismissed-at'
const dismissCooldownMs = 1000 * 60 * 60 * 24 * 7

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function wasRecentlyDismissed(): boolean {
  const dismissedAt = Number(window.localStorage.getItem(dismissedStorageKey) || 0)

  return dismissedAt > 0 && Date.now() - dismissedAt < dismissCooldownMs
}

export function PushPermissionPrompt() {
  const { currentUser, firebaseReady } = useAuth()
  const [installedInSession, setInstalledInSession] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [status, setStatus] = useState<PushPermissionStatus>('prompt')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    function handleAppInstalled() {
      setInstalledInSession(true)
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    return () => window.removeEventListener('appinstalled', handleAppInstalled)
  }, [])

  useEffect(() => {
    if (!firebaseReady || !currentUser || wasRecentlyDismissed()) {
      return
    }

    if (!isStandaloneDisplay() && !installedInSession) {
      return
    }

    let canceled = false

    void getPushPermissionStatus().then((nextStatus) => {
      if (canceled) {
        return
      }

      setStatus(nextStatus)
      setShowPrompt(nextStatus === 'prompt')
    })

    return () => {
      canceled = true
    }
  }, [currentUser, firebaseReady, installedInSession])

  function handleDismiss() {
    window.localStorage.setItem(dismissedStorageKey, String(Date.now()))
    setShowPrompt(false)
  }

  async function handleEnable() {
    if (!currentUser) {
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      await enablePushNotifications(currentUser.uid)
      setStatus(await getPushPermissionStatus())
      setShowPrompt(false)
    } catch (pushError) {
      const nextStatus = await getPushPermissionStatus()
      setStatus(nextStatus)
      setMessage(pushError instanceof Error ? pushError.message : '푸시 알림 설정에 실패했습니다.')

      if (nextStatus === 'denied') {
        window.localStorage.setItem(dismissedStorageKey, String(Date.now()))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!showPrompt || status !== 'prompt') {
    return null
  }

  return (
    <div className="permission-backdrop" role="presentation">
      <section className="permission-modal" role="dialog" aria-modal="true" aria-labelledby="push-permission-title">
        <button className="button-icon ghost permission-close" type="button" onClick={handleDismiss} aria-label="닫기">
          <X size={17} aria-hidden="true" />
        </button>
        <span className="permission-icon" aria-hidden="true">
          <BellRing size={25} />
        </span>
        <div>
          <h2 id="push-permission-title">알림을 켜둘까요?</h2>
          <p>채팅 메시지와 새 소식을 홈 화면 앱에서도 바로 받을 수 있어요.</p>
        </div>
        {message && <p className="form-error">{message}</p>}
        <div className="permission-actions">
          <button className="button button-secondary" type="button" onClick={handleDismiss}>
            나중에
          </button>
          <button className="button button-primary" type="button" onClick={() => void handleEnable()} disabled={submitting}>
            <BellRing size={17} aria-hidden="true" />
            {submitting ? '설정 중' : '알림 켜기'}
          </button>
        </div>
      </section>
    </div>
  )
}
