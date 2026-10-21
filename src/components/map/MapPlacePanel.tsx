import { MapPin, MessageCircle, SendHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { LatLng } from '../../lib/mapLocation'
import { createLivePlaceStatus, subscribePlaceStatusUpdates } from '../../services/mapFeatureService'
import { LIVE_PLACE_STATUS_OPTIONS, type LivePlaceStatusKey, type LivePlaceStatusUpdate } from '../../types/mapFeature'

export interface SelectedMapPlace {
  placeId: string
  placeName: string
  address: string
  location: LatLng
}

interface MapPlacePanelProps {
  place: SelectedMapPlace
  canCreatePin: boolean
  groupId: string
  hidden?: boolean
  sheetRef?: Ref<HTMLElement>
  onCreatePin: () => void
  onClose: () => void
}

function relativeTime(value: LivePlaceStatusUpdate['createdAt']) {
  const minutes = Math.max(0, Math.floor((Date.now() - (value?.toMillis?.() || Date.now())) / 60000))
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`
  return `${Math.floor(minutes / 1440)}일 전`
}

const statusLabels = new Map(LIVE_PLACE_STATUS_OPTIONS.map(option => [option.id, option.label]))

// The parent keys this panel by place ID so drafts and subscriptions belong to one place.
export function MapPlacePanel({ place, canCreatePin, groupId, hidden, sheetRef, onCreatePin, onClose }: MapPlacePanelProps) {
  const { currentUser, profile, firebaseReady } = useAuth()
  const viewerUid = currentUser?.uid
  const route = useLocation()
  const [updates, setUpdates] = useState<LivePlaceStatusUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [writing, setWriting] = useState(false)
  const [tags, setTags] = useState<LivePlaceStatusKey[]>([])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [submitError, setSubmitError] = useState('')
  const pending = useRef(false)
  const reviewButton = useRef<HTMLButtonElement>(null)
  const firstTag = useRef<HTMLInputElement>(null)
  const counts = useMemo(() => LIVE_PLACE_STATUS_OPTIONS.map(option => ({
    ...option, count: updates.filter(update => update.tags.includes(option.id)).length,
  })).filter(option => option.count > 0), [updates])

  useEffect(() => {
    if (!firebaseReady || !viewerUid) { setUpdates([]); setLoading(false); return }
    let active = true
    setLoading(true)
    setLoadError('')
    const unsubscribe = subscribePlaceStatusUpdates(place.placeId, next => {
      if (active) { setUpdates(next); setLoading(false) }
    }, () => {
      if (active) { setLoadError('리뷰를 불러오지 못했습니다. 다시 시도해 주세요.'); setLoading(false) }
    })
    return () => { active = false; unsubscribe() }
  }, [place.placeId, viewerUid, firebaseReady, revision])

  useEffect(() => { if (writing) firstTag.current?.focus({ preventScroll: true }) }, [writing])

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || !currentUser || !profile || !firebaseReady) return
    if (!tags.length) { setSubmitError('장소 상태를 하나 이상 선택해 주세요.'); return }
    pending.current = true
    setSubmitting(true)
    setSubmitError('')
    setMessage('')
    try {
      await createLivePlaceStatus({
        placeId: place.placeId, placeName: place.placeName, address: place.address,
        lat: place.location.lat, lng: place.location.lng, tags, note,
      }, { uid: currentUser.uid, nickname: profile.nickname })
      setTags([])
      setNote('')
      setWriting(false)
      setMessage('리뷰를 남겼습니다.')
      reviewButton.current?.focus({ preventScroll: true })
    } catch {
      setSubmitError('리뷰를 올리지 못했습니다. 내용을 확인하고 다시 시도해 주세요.')
    } finally {
      pending.current = false
      setSubmitting(false)
    }
  }

  // A bottom sheet on phones and a floating panel on wider screens.
  return <aside ref={sheetRef} className="place-sheet" aria-labelledby="selected-place-title" hidden={hidden}
    onKeyDown={event => { if (event.key === 'Escape' && !submitting) { event.stopPropagation(); onClose() } }}>
    <span className="place-sheet-handle" aria-hidden="true" />
    <header className="place-sheet-header">
      <div>
        <h2 id="selected-place-title">{place.placeName}</h2>
        <p>{place.address || '주소 정보 없음'}</p>
      </div>
      <button className="button-icon ghost" type="button" onClick={onClose} aria-label="선택한 장소 닫기"><X size={20} aria-hidden="true" /></button>
    </header>

    {currentUser ? <>
      <div className="place-sheet-actions" role="group" aria-label="이 장소에서 할 일">
        <button className="button button-primary" type="button" onClick={onCreatePin} disabled={!canCreatePin || !firebaseReady}>
          <MapPin size={17} aria-hidden="true" />{groupId ? '그룹 핀 남기기' : '핀 남기기'}
        </button>
        <button ref={reviewButton} className="button button-secondary" type="button" aria-expanded={writing} aria-controls="place-review-form"
          disabled={!firebaseReady || !profile || submitting} onClick={() => { setWriting(value => !value); setMessage('') }}>
          <MessageCircle size={17} aria-hidden="true" />{writing ? '작성 접기' : '리뷰 남기기'}
        </button>
      </div>
      {!canCreatePin && <p className="place-sheet-help">그룹 정보를 확인하고 가입한 뒤 핀을 남길 수 있어요.</p>}
      {!firebaseReady && <p className="place-sheet-help" role="status">연결을 확인한 뒤 핀과 리뷰를 남길 수 있어요.</p>}

      {writing && <form id="place-review-form" className="place-review-form" onSubmit={submitReview} aria-busy={submitting}>
        <fieldset disabled={submitting}>
          <legend>지금 이곳은 어떤가요?</legend>
          <ul className="place-status-options">
            {LIVE_PLACE_STATUS_OPTIONS.map((option, index) => <li key={option.id}>
              <label><input ref={index === 0 ? firstTag : undefined} type="checkbox" checked={tags.includes(option.id)}
                onChange={() => setTags(previous => previous.includes(option.id) ? previous.filter(tag => tag !== option.id) : [...previous, option.id])} />
                <span>{option.label}</span>
              </label>
            </li>)}
          </ul>
        </fieldset>
        <label className="field compact-field"><span>한줄 리뷰 <small>선택</small></span>
          <textarea value={note} disabled={submitting} onChange={event => setNote(event.target.value)} placeholder="예: 2층 창가에 자리가 있어요" rows={3} />
        </label>
        {submitError && <p className="form-error" role="alert">{submitError}</p>}
        <button className="button button-primary" type="submit" disabled={submitting || !tags.length}>
          <SendHorizontal size={17} aria-hidden="true" />{submitting ? '올리는 중…' : '리뷰 올리기'}
        </button>
      </form>}
      {message && <p className="place-review-success" role="status">{message}</p>}

      <section className="place-sheet-reviews" aria-labelledby="place-reviews-title" aria-busy={loading}>
        <div className="place-sheet-reviews-heading">
          <h3 id="place-reviews-title">실시간 리뷰</h3>
          {!loading && !loadError && updates.length > 0 && <span className="place-sheet-count">{updates.length}</span>}
        </div>
        {loading ? <p className="place-sheet-state" role="status">리뷰를 불러오는 중…</p>
          : loadError ? <p className="form-error" role="alert">{loadError} <button className="text-action" type="button" onClick={() => setRevision(value => value + 1)}>다시 시도</button></p>
          : !firebaseReady ? <p className="place-sheet-state">연결을 확인해 주세요.</p>
          : updates.length ? <>
            <ul className="place-sheet-summary" aria-label="장소 상태 요약">{counts.map(option => <li key={option.id}>{option.label} <span>{option.count}</span></li>)}</ul>
            <ol className="place-sheet-feed">{updates.slice(0, 6).map(update => <li key={update.id}>
              <header><strong>{update.authorNickname}</strong><time>{relativeTime(update.createdAt)}</time></header>
              <p className="review-status-labels">{update.tags.map(tag => statusLabels.get(tag) || tag).join(' · ')}</p>
              {update.note && <p>{update.note}</p>}
            </li>)}</ol>
          </> : <p className="place-sheet-state">아직 리뷰가 없어요. 이곳의 첫 리뷰를 남겨보세요.</p>}
      </section>
      <p className="place-sheet-footnote">리뷰는 그룹과 관계없이 모든 사용자에게 공개돼요.</p>
    </> : <section className="place-login-message">
      <p>로그인하고 이 장소에 핀과 리뷰를 남겨보세요.</p>
      <Link className="button button-primary" to="/login" state={{ from: route.pathname + route.search }}>로그인</Link>
    </section>}
  </aside>
}
