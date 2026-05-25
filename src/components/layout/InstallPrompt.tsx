import { Download, Share, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const dismissedStorageKey = 'spotit-install-prompt-dismissed-at'
const dismissCooldownMs = 1000 * 60 * 60 * 24 * 7

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isIosDevice(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

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

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const isIos = useMemo(() => isIosDevice(), [])

  useEffect(() => {
    if (!isMobileDevice() || isStandaloneDisplay() || wasRecentlyDismissed()) {
      return undefined
    }

    if (isIos) {
      const timer = window.setTimeout(() => setShowPrompt(true), 1200)

      return () => window.clearTimeout(timer)
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [isIos])

  useEffect(() => {
    function handleAppInstalled() {
      setInstallEvent(null)
      setShowPrompt(false)
      window.localStorage.setItem(dismissedStorageKey, String(Date.now()))
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    return () => window.removeEventListener('appinstalled', handleAppInstalled)
  }, [])

  function handleDismiss() {
    window.localStorage.setItem(dismissedStorageKey, String(Date.now()))
    setShowPrompt(false)
  }

  async function handleInstall() {
    if (!installEvent) {
      return
    }

    await installEvent.prompt()
    const choice = await installEvent.userChoice

    if (choice.outcome === 'accepted' || choice.outcome === 'dismissed') {
      window.localStorage.setItem(dismissedStorageKey, String(Date.now()))
    }

    setInstallEvent(null)
    setShowPrompt(false)
  }

  if (!showPrompt) {
    return null
  }

  return (
    <aside className="install-prompt" aria-label="앱 설치 안내">
      <button className="button-icon ghost install-close" type="button" onClick={handleDismiss} aria-label="닫기">
        <X size={16} aria-hidden="true" />
      </button>
      <img src="/logo.png" alt="" aria-hidden="true" />
      <div>
        <strong>스팟온을 홈 화면에 추가</strong>
        {isIos ? (
          <p>
            Safari 공유 버튼을 누른 뒤 <Share size={13} aria-hidden="true" /> 홈 화면에 추가를 선택하세요.
          </p>
        ) : (
          <p>앱처럼 바로 열고 사용할 수 있어요.</p>
        )}
      </div>
      {!isIos && installEvent && (
        <button className="button button-primary install-action" type="button" onClick={() => void handleInstall()}>
          <Download size={16} aria-hidden="true" />
          설치
        </button>
      )}
    </aside>
  )
}
