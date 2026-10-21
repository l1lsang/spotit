import { ChevronLeft, MapPin, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type Ref } from 'react'
import type { LatLng, PlaceSearchResult } from '../../lib/mapLocation'
import { getDistanceMeters } from '../../lib/photoMetadata'
import { searchPlaces } from '../../lib/placeSearch'
import { formatDistance, splitQueryMatch } from './mapHelpers'

const SEARCH_DELAY_MS = 300

interface MapPlaceSearchProps {
  initialQuery: string
  center: LatLng
  onClose: () => void
  onSelect: (place: PlaceSearchResult, query: string) => void
}

export function MapPlaceSearch({ initialQuery, center, onClose, onSelect }: MapPlaceSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<PlaceSearchResult[]>([])
  const [status, setStatus] = useState<'idle' | 'searching' | 'done' | 'error'>(() => initialQuery.trim() ? 'searching' : 'idle')
  const [message, setMessage] = useState('')
  const { lat, lng } = center

  const runSearch = useCallback(async (text: string) => {
    const requestId = ++requestRef.current
    setStatus('searching')
    setMessage('')
    try {
      const places = await searchPlaces(text, { lat, lng })
      if (requestId !== requestRef.current) return
      setResults(places)
      setStatus('done')
    } catch (searchError) {
      if (requestId !== requestRef.current) return
      setResults([])
      setStatus('error')
      setMessage(searchError instanceof Error ? searchError.message : '장소 검색에 실패했습니다.')
    }
  }, [lat, lng])

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      requestRef.current += 1
      setResults([])
      setStatus('idle')
      setMessage('')
      return
    }
    const timer = window.setTimeout(() => void runSearch(trimmed), SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [query, runSearch])

  return (
    <div className="map-search-overlay" role="dialog" aria-modal="true" aria-label="장소 검색"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}>
      <div className="map-search-panel">
        <form className="map-search-bar" role="search" onSubmit={(event) => {
          event.preventDefault()
          if (query.trim()) void runSearch(query.trim())
        }}>
          <button className="map-search-back" type="button" onClick={onClose} aria-label="지도로 돌아가기">
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <label className="map-search-input">
            <Search size={18} aria-hidden="true" />
            <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="장소 이름이나 주소로 검색" aria-label="장소 검색어" enterKeyHint="search" autoComplete="off" />
            {query && (
              <button className="map-search-clear" type="button" aria-label="검색어 지우기"
                onClick={() => { setQuery(''); inputRef.current?.focus() }}>
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </label>
        </form>
        <div className="map-search-body" aria-live="polite" aria-busy={status === 'searching'}>
          {status === 'idle' && <p className="map-search-status">장소 이름이나 주소로 찾아보세요.</p>}
          {status === 'searching' && results.length === 0 && <p className="map-search-status" role="status">검색 중…</p>}
          {status === 'error' && <p className="map-search-status is-error" role="alert">{message}</p>}
          {status === 'done' && results.length === 0 && <p className="map-search-status" role="status">검색 결과가 없어요.</p>}
          {results.length > 0 && (
            <>
              <p className="map-search-status">검색 결과 {results.length}</p>
              <ul className="map-search-results">
                {results.map((place) => {
                  const { before, match, after } = splitQueryMatch(place.name, query)
                  return (
                    <li key={place.id}>
                      <button type="button" onClick={() => onSelect(place, query.trim())}>
                        <span className="map-search-icon"><MapPin size={20} aria-hidden="true" /></span>
                        <span className="map-search-text">
                          <strong>{before}{match && <mark>{match}</mark>}{after}</strong>
                          {place.address && <small>{place.address}</small>}
                        </span>
                        <span className="map-search-distance">{formatDistance(getDistanceMeters(center, place.location))}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          <p className="map-search-hint">찾는 곳이 없다면 지도를 눌러 원하는 위치에 바로 핀을 남길 수 있어요.</p>
        </div>
      </div>
    </div>
  )
}

interface MapSelectedPlaceFieldProps {
  name: string
  backRef?: Ref<HTMLButtonElement>
  onBack: () => void
  onClear: () => void
}

export function MapSelectedPlaceField({ name, backRef, onBack, onClear }: MapSelectedPlaceFieldProps) {
  return (
    <div className="map-selected-place" role="group" aria-label="선택한 장소">
      <button ref={backRef} type="button" onClick={onBack} aria-label="검색으로 돌아가기">
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <strong>{name}</strong>
      <button type="button" onClick={onClear} aria-label="선택한 장소 지우기">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
