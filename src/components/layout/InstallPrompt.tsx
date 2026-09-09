import { Download, Info, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { createInstallGuidePreference, getInstallPlatform, INSTALL_GUIDE_SEEN_KEY, INSTALL_GUIDE_STEPS } from '../../lib/installGuide'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<unknown>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const preference = createInstallGuidePreference(() => window.localStorage)

function isStandaloneDisplay(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function InstallPrompt() {
  const { pathname } = useLocation()
  const [eligible, setEligible] = useState(() => !isStandaloneDisplay() && !preference.hasSeen())
  const [showPrompt, setShowPrompt] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState('')
  const [platform] = useState(() => getInstallPlatform(navigator.userAgent, navigator.maxTouchPoints))
  const installEvent = useRef<BeforeInstallPromptEvent | null>(null)
  const actionLock = useRef(false)
  const active = useRef(true)
  const quietPage = pathname.startsWith('/admin') || pathname.startsWith('/chats/')

  useEffect(() => {
    active.current = true
    const displayMode = window.matchMedia('(display-mode: standalone)')
    function installed() {
      preference.remember()
      installEvent.current = null
      setEligible(false)
      setShowPrompt(false)
      setCanInstall(false)
    }
    function displayChanged() { if (isStandaloneDisplay()) installed() }
    function storageChanged(event: StorageEvent) {
      if (event.key === INSTALL_GUIDE_SEEN_KEY && preference.hasSeen()) { setEligible(false); setShowPrompt(false) }
    }
    if (isStandaloneDisplay()) installed()
    window.addEventListener('appinstalled', installed)
    window.addEventListener('storage', storageChanged)
    displayMode.addEventListener('change', displayChanged)
    return () => {
      active.current = false
      window.removeEventListener('appinstalled', installed)
      window.removeEventListener('storage', storageChanged)
      displayMode.removeEventListener('change', displayChanged)
    }
  }, [])

  useEffect(() => {
    if (!eligible) return
    function beforeInstall(event: Event) {
      event.preventDefault()
      installEvent.current = event as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', beforeInstall)
  }, [eligible])

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
    installEvent.current = null
  }

  async function install() {
    if (actionLock.current) return
    const event = installEvent.current
    if (!event) { setShowGuide(value => !value); return }
    actionLock.current = true
    installEvent.current = null
    setInstalling(true)
    setError('')
    try {
      // Browsers allow a captured install event to be prompted only once.
      await event.prompt()
      await event.userChoice
      if (active.current) dismiss()
    } catch {
      if (active.current) {
        setCanInstall(false)
        setShowGuide(true)
        setError('설치 창을 열지 못했어요. 아래 방법으로 설치해 주세요.')
      }
    } finally {
      actionLock.current = false
      if (active.current) setInstalling(false)
    }
  }

  if (!eligible || !showPrompt || quietPage) return null

  return <aside className="install-prompt" aria-labelledby="install-prompt-title">
    <button className="button-icon ghost install-close" type="button" onClick={dismiss} aria-label="설치 안내 닫기" disabled={installing}>
      <X size={17} aria-hidden="true" />
    </button>
    <img src="/icon-192.png" alt="" aria-hidden="true" />
    <div className="install-copy">
      <strong id="install-prompt-title">스팟잇을 앱처럼 사용해 보세요</strong>
      <p>홈 화면이나 컴퓨터에 설치하면 아이콘을 눌러 바로 열 수 있어요.</p>
    </div>
    <div className="install-actions">
      <button className="button button-primary install-action" type="button" onClick={() => void install()} disabled={installing}
        aria-expanded={!canInstall ? showGuide : undefined} aria-controls={!canInstall ? 'install-guide' : undefined}>
        {canInstall ? <Download size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}
        {installing ? '설치 확인 중…' : canInstall ? '앱 설치' : showGuide ? '안내 접기' : '설치 방법'}
      </button>
      <button className="install-dismiss" type="button" onClick={dismiss} disabled={installing}>브라우저로 계속</button>
    </div>
    {showGuide && <div className="install-guide" id="install-guide">
      {error && <p className="form-error" role="alert">{error}</p>}
      <ol>{INSTALL_GUIDE_STEPS[platform].map(step => <li key={step}>{step}</li>)}</ol>
      <p>설치 항목이 없다면 Safari, Chrome 또는 Edge에서 다시 열어 주세요.</p>
    </div>}
  </aside>
}
