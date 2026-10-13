import { ArrowUpRight, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { createInstallGuidePreference, INSTALL_GUIDE_SEEN_KEY } from '../../lib/installGuide'

const preference = createInstallGuidePreference(() => window.localStorage)
const appStores = [
  { name: '안드로이드', url: import.meta.env.VITE_ANDROID_APP_URL?.trim() },
  { name: 'iOS', url: import.meta.env.VITE_IOS_APP_URL?.trim() || 'https://apps.apple.com/app/id6811809433' },
]

function isStandaloneDisplay(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function InstallPrompt() {
  const { pathname } = useLocation()
  const [eligible, setEligible] = useState(() => !isStandaloneDisplay() && !preference.hasSeen())
  const [showPrompt, setShowPrompt] = useState(false)
  const quietPage = pathname.startsWith('/admin') || pathname.startsWith('/chats/')

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    function displayChanged() {
      if (isStandaloneDisplay()) { setEligible(false); setShowPrompt(false) }
    }
    function storageChanged(event: StorageEvent) {
      if (event.key === INSTALL_GUIDE_SEEN_KEY && preference.hasSeen()) { setEligible(false); setShowPrompt(false) }
    }
    // Suppress automatic web app installation promotion, including after dismissal.
    function preventWebInstall(event: Event) { event.preventDefault() }
    window.addEventListener('beforeinstallprompt', preventWebInstall)
    window.addEventListener('storage', storageChanged)
    displayMode.addEventListener('change', displayChanged)
    return () => {
      window.removeEventListener('beforeinstallprompt', preventWebInstall)
      window.removeEventListener('storage', storageChanged)
      displayMode.removeEventListener('change', displayChanged)
    }
  }, [])

  useEffect(() => {
    if (!eligible || quietPage || showPrompt) return
    const timer = window.setTimeout(() => {
      if (isStandaloneDisplay() || preference.hasSeen()) return
      preference.remember()
      setShowPrompt(true)
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [eligible, quietPage, showPrompt])

  function dismiss() {
    preference.remember()
    setShowPrompt(false)
    setEligible(false)
  }

  if (!eligible || !showPrompt || quietPage) return null

  return <aside className="install-prompt" aria-labelledby="install-prompt-title">
    <button className="button-icon ghost install-close" type="button" onClick={dismiss} aria-label="설치 안내 닫기">
      <X size={17} aria-hidden="true" />
    </button>
    <img src="/logo-512.png" alt="" aria-hidden="true" width="512" height="512" />
    <div className="install-copy">
      <strong id="install-prompt-title">다음 산책도, 스팟잇과 함께.</strong>
      <p>앱에서 오늘의 장소를 간편하게 남겨보세요.</p>
    </div>
    <div className="install-actions">
      {appStores.map(({ name, url }) => url
        ? <a key={name} className="button button-primary install-action" href={url} target="_blank" rel="noopener noreferrer" onClick={dismiss}>
          {name} 앱 <ArrowUpRight size={16} aria-hidden="true" />
        </a>
        : <button key={name} className="button button-primary install-action" type="button" disabled>
          {name} 앱 <ArrowUpRight size={16} aria-hidden="true" /> <span className="install-coming-soon">준비 중</span>
        </button>)}
      <button className="install-dismiss" type="button" onClick={dismiss}>
        웹에서 계속하기
      </button>
    </div>
  </aside>
}
