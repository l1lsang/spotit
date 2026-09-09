import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { useAuth } from '../hooks/useAuth'
import { auth } from '../lib/firebase'
import { hasLocationConsent, saveLocationConsent } from '../services/consentService'
import { LocationConsentContext } from './locationConsentCore'

export function LocationConsentProvider({ children }: PropsWithChildren) {
  const { currentUser } = useAuth()
  const uid = currentUser?.uid
  const [pendingUid, setPendingUid] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const waiters = useRef<((accepted: boolean) => void)[]>([])

  const finish = useCallback((accepted: boolean) => {
    waiters.current.splice(0).forEach(resolve => resolve(accepted))
    setPendingUid(null)
  }, [])

  useEffect(() => () => { waiters.current.splice(0).forEach(resolve => resolve(false)) }, [uid])
  useEffect(() => {
    if (pendingUid && pendingUid === uid) dialog.current?.showModal()
    else dialog.current?.close()
  }, [pendingUid, uid])

  const ensureConsent = useCallback(async (prompt: boolean): Promise<boolean> => {
    if (!uid) return false
    if (await hasLocationConsent(uid)) return auth?.currentUser?.uid === uid
    if (!prompt || auth?.currentUser?.uid !== uid) return false
    return new Promise(resolve => {
      waiters.current.push(resolve)
      setError('')
      setPendingUid(uid)
    })
  }, [uid])

  async function accept() {
    if (!pendingUid || pendingUid !== auth?.currentUser?.uid || saving) return
    setSaving(true)
    setError('')
    try {
      await saveLocationConsent(pendingUid, true)
      finish(auth?.currentUser?.uid === pendingUid)
    } catch {
      setError('동의를 저장하지 못했습니다. 다시 시도해 주세요.')
    } finally { setSaving(false) }
  }

  return <LocationConsentContext.Provider value={ensureConsent}>
    {children}
    <dialog className="location-consent-dialog" ref={dialog} aria-labelledby="location-consent-title"
      onCancel={event => { event.preventDefault(); if (!saving) finish(false) }}>
      <h2 id="location-consent-title">위치기반서비스 이용 동의</h2>
      <p>현재 위치 또는 선택한 장소의 위도·경도를 지도 표시, 주변 검색과 장소 기록에 사용합니다. 현재 위치는 해당 기능을 처리하는 동안 이용하며, 기록에 저장한 위치는 기록 삭제 또는 회원 탈퇴 시까지 보관합니다.</p>
      <p><a href="/policies/location" target="_blank" rel="noopener noreferrer">위치기반서비스 이용약관 보기</a></p>
      <p>동의하지 않아도 지도 이동과 장소 검색 등 다른 기능을 이용할 수 있습니다. 기기의 현재 위치를 이용할 때에는 브라우저 위치 권한을 별도로 요청합니다.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="location-consent-actions">
        <button type="button" className="button button-secondary" disabled={saving} onClick={() => finish(false)}>나중에</button>
        <button type="button" className="button button-primary" disabled={saving} onClick={() => void accept()}>
          {saving ? '저장 중' : '약관에 동의하고 이용'}
        </button>
      </div>
    </dialog>
  </LocationConsentContext.Provider>
}
