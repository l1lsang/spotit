import {
  CalendarDays, Check, ChevronLeft, ImageIcon, ImagePlus, LoaderCircle, LocateFixed, MapPin, MapPinOff, Move,
  Search, ShieldCheck, Sparkles, Undo2, X,
} from 'lucide-react'
import { useRef, useState, type Ref } from 'react'
import { formatClockTime, formatDateKey, formatDateKeyWithWeekday } from '../../lib/date'
import { EDITABLE_IMAGE_TYPES } from '../../lib/imageEditing'
import type { LatLng, PlaceSearchResult } from '../../lib/mapLocation'
import type { PhotoTakenAt } from '../../lib/photoMetadata'
import { searchPlaces } from '../../lib/placeSearch'
import { useNearbyPlaces, type PhotoRecordFlowState } from '../../hooks/usePhotoRecordFlow'
import '../../styles/photoRecord.css'

const TIP_STORAGE_KEY = 'spotit:photo-record-tip-seen'

function readTipSeen(): boolean {
  try { return window.localStorage.getItem(TIP_STORAGE_KEY) === '1' } catch { return false }
}

function formatTakenAt(takenAt: PhotoTakenAt): string {
  return `${formatDateKeyWithWeekday(takenAt.dateKey)} ${formatClockTime(takenAt.time)}`
}

interface PhotoRecordLauncherProps {
  disabled?: boolean
  hideTip?: boolean
  error?: string
  onSelect: (files: File[]) => void
}

export function PhotoRecordLauncher({ disabled = false, hideTip = false, error = '', onSelect }: PhotoRecordLauncherProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [tipSeen, setTipSeen] = useState(readTipSeen)

  function openPicker() {
    inputRef.current?.click()
    if (tipSeen) return
    setTipSeen(true)
    try { window.localStorage.setItem(TIP_STORAGE_KEY, '1') } catch { /* The tip simply shows again next time. */ }
  }

  return (
    <div className="photo-record-launcher">
      {error ? <p className="photo-record-tip is-error" role="alert">{error}</p> : !tipSeen && !hideTip && (
        <p className="photo-record-tip"><Sparkles size={14} aria-hidden="true" />사진만 올리면 위치·날짜가 자동으로 채워져요</p>
      )}
      <button className="photo-record-fab" type="button" onClick={openPicker} disabled={disabled}>
        <ImagePlus size={19} aria-hidden="true" />사진으로 기록
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={EDITABLE_IMAGE_TYPES}
        multiple
        hidden
        aria-label="기록할 사진 선택"
        onChange={(event) => {
          const files = Array.from(event.target.files || [])
          event.target.value = ''
          if (files.length) onSelect(files)
        }}
      />
    </div>
  )
}

interface PhotoRecordTopBarProps {
  title: string
  step: string
  backLabel: string
  onBack: () => void
}

export function PhotoRecordTopBar({ title, step, backLabel, onBack }: PhotoRecordTopBarProps) {
  return (
    <div className="photo-record-topbar">
      <button type="button" onClick={onBack} aria-label={backLabel} title={backLabel}>
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      <p><strong>{title}</strong><span>{step}</span></p>
    </div>
  )
}

export function PhotoCenterPin() {
  return (
    <div className="photo-center-overlay" aria-hidden="true">
      <div className="photo-center-pin">
        <span className="photo-center-tip"><Move size={14} />지도를 움직여 핀 위치를 맞춰주세요</span>
        <svg width="40" height="50" viewBox="0 0 40 50">
          <path d="M20 0C9 0 0 8.7 0 19.5 0 33.5 20 50 20 50s20-16.5 20-30.5C40 8.7 31 0 20 0z" />
          <circle cx="20" cy="19.5" r="7" />
        </svg>
      </div>
    </div>
  )
}

interface PhotoRecordSheetProps {
  flow: PhotoRecordFlowState
  getSearchCenter: () => LatLng
  locating: boolean
  sheetRef?: Ref<HTMLElement>
  notice?: string
  onBack: () => void
  onConfirm: () => void
  onAdjust: () => void
  onReturnToPhotoLocation: () => void
  onPlaceHere: () => void
  onUseCurrentLocation: () => void
  onSelectPlace: (place: PlaceSearchResult) => void
}

export function PhotoRecordSheet({
  flow, getSearchCenter, locating, sheetRef, notice, onBack, onConfirm, onAdjust, onReturnToPhotoLocation, onPlaceHere,
  onUseCurrentLocation, onSelectPlace,
}: PhotoRecordSheetProps) {
  return (
    <aside ref={sheetRef} className="photo-record-sheet" aria-labelledby="photo-record-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onBack()
        }
      }}>
      <span className="photo-sheet-handle" aria-hidden="true" />
      {notice && <p className="form-error" role="alert">{notice}</p>}
      {flow.step === 'reading' && <ReadingContent flow={flow} />}
      {flow.step === 'confirm' && <ConfirmContent flow={flow} onAdjust={onAdjust} onConfirm={onConfirm} />}
      {flow.step === 'locate' && (
        <LocateContent key={flow.locateReason} flow={flow} getSearchCenter={getSearchCenter} locating={locating}
          onPlaceHere={onPlaceHere} onUseCurrentLocation={onUseCurrentLocation}
          onReturnToPhotoLocation={onReturnToPhotoLocation} onSelectPlace={onSelectPlace} />
      )}
    </aside>
  )
}

function ReadingContent({ flow }: { flow: PhotoRecordFlowState }) {
  const done = flow.items.filter((item) => item.metadata).length
  return (
    <>
      <header className="photo-sheet-heading">
        <h2 id="photo-record-title">사진 정보를 읽고 있어요</h2>
        <p>사진 속 위치와 촬영 날짜를 찾는 중이에요.</p>
      </header>
      <div className="photo-read-progress">
        <span role="progressbar" aria-label="사진 정보 읽기" aria-valuemin={0} aria-valuemax={flow.items.length} aria-valuenow={done}>
          <i style={{ width: `${(done / flow.items.length) * 100}%` }} />
        </span>
        <small>{done} / {flow.items.length}</small>
      </div>
      <ul className="photo-read-list" aria-live="polite">
        {flow.items.map((item) => (
          <li key={item.id}>
            <img src={item.url} alt="" />
            <div>
              <strong>{item.file.name}</strong>
              {item.metadata ? (
                <small>
                  <span>{item.metadata.location ? <MapPin size={12} aria-hidden="true" /> : <MapPinOff size={12} aria-hidden="true" />}
                    {item.metadata.location ? '위치 있음' : '위치 없음'}</span>
                  <span><CalendarDays size={12} aria-hidden="true" />
                    {item.metadata.takenAt ? `${formatDateKey(item.metadata.takenAt.dateKey).slice(5)} ${formatClockTime(item.metadata.takenAt.time)}` : '날짜 없음'}</span>
                </small>
              ) : <small className="photo-read-pending">위치 · 날짜 읽는 중…</small>}
            </div>
            {item.metadata
              ? <span className="photo-read-done" aria-label="읽기 완료"><Check size={15} aria-hidden="true" /></span>
              : <LoaderCircle className="photo-read-spinner" size={20} aria-label="읽는 중" />}
          </li>
        ))}
      </ul>
      <p className="photo-privacy-note">
        <ShieldCheck size={16} aria-hidden="true" />
        사진 속 위치 정보는 핀을 찍는 데만 쓰여요. 사진을 올릴 때 원본의 위치 정보는 지워져요.
      </p>
    </>
  )
}

function ConfirmContent({ flow, onAdjust, onConfirm }: { flow: PhotoRecordFlowState; onAdjust: () => void; onConfirm: () => void }) {
  const summary = flow.summary
  const location = summary?.location ?? null
  const nearby = useNearbyPlaces(location)
  const nearest = nearby.places[0]
  const count = flow.items.length
  const photoNote = summary?.distantPhotoCount
    ? `${summary.distantPhotoCount}장은 다른 장소에서 찍은 사진이에요. 대표 사진 위치로 기록돼요.`
    : summary?.missingLocationCount
      ? `${summary.missingLocationCount}장은 위치 정보가 없어 대표 사진의 위치를 사용해요.`
      : count > 1 ? '모든 사진이 같은 장소에서 찍혔어요.' : '이 사진의 위치로 기록돼요.'

  return (
    <>
      <header className="photo-sheet-heading">
        <span className="photo-chip"><Sparkles size={12} aria-hidden="true" />사진에서 찾았어요</span>
        <h2 id="photo-record-title">이 장소에 핀을 찍을까요?</h2>
      </header>
      <ul className="photo-detected-list">
        <li>
          <span className="photo-detected-icon"><MapPin size={18} aria-hidden="true" /></span>
          <div aria-live="polite">
            <strong>{nearby.loading ? '주변 장소를 찾는 중…' : nearest?.name || '사진을 찍은 위치'}</strong>
            <small>{nearest?.address || (location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : '')}</small>
          </div>
        </li>
        <li>
          <span className="photo-detected-icon"><CalendarDays size={18} aria-hidden="true" /></span>
          <div>
            <strong>{summary?.takenAt ? formatTakenAt(summary.takenAt) : '촬영 날짜 정보 없음'}</strong>
            <small>{summary?.takenAt
              ? count > 1 ? '사진 촬영일 · 이 장소에서 가장 먼저 찍은 시간' : '사진 촬영일'
              : '오늘 날짜로 기록돼요. 기록 작성에서 바꿀 수 있어요.'}</small>
          </div>
        </li>
        <li>
          <span className="photo-detected-icon"><ImageIcon size={18} aria-hidden="true" /></span>
          <div>
            <strong>사진 {count}장</strong>
            <small>{photoNote}</small>
          </div>
          <span className="photo-thumb-stack" aria-hidden="true">
            {flow.items.slice(0, 3).map((item) => <img key={item.id} src={item.url} alt="" />)}
          </span>
        </li>
      </ul>
      <div className="photo-sheet-actions">
        <button className="button button-secondary" type="button" onClick={onAdjust}>
          <Move size={17} aria-hidden="true" />위치 조정
        </button>
        <button className="button button-primary" type="button" onClick={onConfirm}>
          <Check size={17} aria-hidden="true" />이 위치로 기록하기
        </button>
      </div>
    </>
  )
}

interface LocateContentProps {
  flow: PhotoRecordFlowState
  getSearchCenter: () => LatLng
  locating: boolean
  onPlaceHere: () => void
  onUseCurrentLocation: () => void
  onReturnToPhotoLocation: () => void
  onSelectPlace: (place: PlaceSearchResult) => void
}

function LocateContent({
  flow, getSearchCenter, locating, onPlaceHere, onUseCurrentLocation, onReturnToPhotoLocation, onSelectPlace,
}: LocateContentProps) {
  const missing = flow.locateReason === 'missing'
  const takenAt = flow.summary?.takenAt
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceSearchResult[]>([])
  const [message, setMessage] = useState('')
  const [searching, setSearching] = useState(false)
  const requestRef = useRef(0)

  function resetResults() {
    requestRef.current += 1
    setResults([])
    setMessage('')
    setSearching(false)
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const requestId = ++requestRef.current
    if (!query.trim()) {
      resetResults()
      return
    }
    setSearching(true)
    setMessage('')
    try {
      const places = await searchPlaces(query, getSearchCenter())
      if (requestId !== requestRef.current) return
      setResults(places.slice(0, 5))
      setMessage(places.length ? '' : '검색 결과가 없습니다.')
    } catch (searchError) {
      if (requestId !== requestRef.current) return
      setResults([])
      setMessage(searchError instanceof Error ? searchError.message : '장소 검색에 실패했습니다.')
    } finally {
      if (requestId === requestRef.current) setSearching(false)
    }
  }

  return (
    <>
      {missing ? (
        <header className="photo-sheet-heading photo-missing-heading">
          <img src={flow.items[0].url} alt="" />
          <div>
            <span className="photo-chip warning"><MapPinOff size={12} aria-hidden="true" />위치 정보 없음</span>
            <h2 id="photo-record-title">{flow.items.length > 1 ? '사진에 위치 정보가 없어요' : '이 사진엔 위치 정보가 없어요'}</h2>
          </div>
        </header>
      ) : (
        <header className="photo-sheet-heading">
          <h2 id="photo-record-title">핀 위치를 맞춰주세요</h2>
        </header>
      )}
      <p className="photo-sheet-description">
        {missing
          ? '메신저로 받은 사진이나 캡처 이미지는 위치 정보가 지워져 있을 수 있어요. 장소를 검색하거나 지도를 움직여 핀을 찍어주세요.'
          : '지도를 움직여 핀을 정확한 위치에 맞추거나 장소를 검색해 주세요.'}
      </p>
      <form className="photo-place-search" onSubmit={handleSearch} role="search">
        <Search size={18} aria-hidden="true" />
        <input value={query} onChange={(event) => { resetResults(); setQuery(event.target.value) }}
          placeholder="장소 이름이나 주소로 검색" aria-label="장소 이름이나 주소로 검색" />
        {query && (
          <button className="button-icon ghost" type="button" aria-label="검색어 지우기" onClick={() => { resetResults(); setQuery('') }}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </form>
      {(searching || message || results.length > 0) && (
        <div className="photo-place-results" aria-live="polite">
          {searching ? <p role="status">검색 중…</p>
            : message ? <p role="status">{message}</p>
            : <ul>{results.map((place) => (
              <li key={place.id}>
                <button type="button" onClick={() => { resetResults(); setQuery(place.name); onSelectPlace(place) }}>
                  <strong>{place.name}</strong><span>{place.address}</span>
                </button>
              </li>
            ))}</ul>}
        </div>
      )}
      {missing && (
        <p className="photo-date-note">
          <CalendarDays size={18} aria-hidden="true" />
          <span>
            <strong>{takenAt ? '날짜는 사진 촬영일로 입력돼요' : '사진에 촬영 날짜가 없어요'}</strong>
            <small>{takenAt ? formatTakenAt(takenAt) : '오늘 날짜로 입력되고, 기록 작성에서 바꿀 수 있어요.'}</small>
          </span>
        </p>
      )}
      <div className="photo-sheet-actions">
        {missing ? (
          <button className="button button-secondary" type="button" onClick={onUseCurrentLocation} disabled={locating} aria-busy={locating}>
            <LocateFixed size={17} aria-hidden="true" />{locating ? '확인 중…' : '현재 위치'}
          </button>
        ) : (
          <button className="button button-secondary" type="button" onClick={onReturnToPhotoLocation}>
            <Undo2 size={17} aria-hidden="true" />사진 위치로
          </button>
        )}
        <button className="button button-primary" type="button" onClick={onPlaceHere}>
          <MapPin size={17} aria-hidden="true" />여기에 핀 찍기
        </button>
      </div>
    </>
  )
}
