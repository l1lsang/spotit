import { Download, Globe, X } from 'lucide-react'
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
      <strong id="install-prompt-title">스팟잇을 앱으로 만나보세요</strong>
      <p>안드로이드·iOS 앱을 설치하거나 브라우저에서 이용할 수 있어요.</p>
    </div>
    <div className="install-actions">
      {appStores.map(({ name, url }) => url
        ? <a key={name} className="button button-primary install-action" href={url} target="_blank" rel="noopener noreferrer" onClick={dismiss}>
          <Download size={16} aria-hidden="true" />
          {name} 앱 설치하기
        </a>
        : <button key={name} className="button button-primary install-action" type="button" disabled>
          <Download size={16} aria-hidden="true" />
          {name} 앱 설치하기 <span className="install-coming-soon">출시 준비 중</span>
        </button>)}
      <button className="install-dismiss" type="button" onClick={dismiss}>
        <Globe size={16} aria-hidden="true" />브라우저에서 열기
      </button>
    </div>
  </aside>
}
