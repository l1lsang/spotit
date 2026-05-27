import { LocateFixed, MapPin, Plus, Search, SendHorizonal, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { KakaoMapView } from '../components/map/KakaoMapView'
import { MapPostPreview } from '../components/map/MapPostPreview'
import { PostFormModal, type PostFormSubmitPayload } from '../components/post/PostFormModal'
import { useAuth } from '../hooks/useAuth'
import { SEOUL_CITY_HALL, useCurrentLocation } from '../hooks/useCurrentLocation'
import {
  searchKakaoPlacesByKeyword,
  type KakaoPlaceSearchResult,
  type LatLng,
} from '../lib/kakaoMap'
import {
  createLivePlaceStatus,
  subscribePlaceStatusUpdates,
} from '../services/mapFeatureService'
import { createPost, getVisiblePosts } from '../services/postService'
import {
  LIVE_PLACE_STATUS_OPTIONS,
  type LivePlaceStatusKey,
  type LivePlaceStatusUpdate,
} from '../types/mapFeature'
import {
  POST_PIN_GROUPS,
  getPostPinGroupColor,
  type Post,
  type PostFormInput,
} from '../types/post'

type MapMode = 'main' | 'live'
type PanelMessageType = 'success' | 'error'

interface SelectedPlacePrefill {
  placeId: string
  placeName: string
  address: string
  location: LatLng
}

interface TimestampLike {
  toMillis: () => number
}

const statusLabelById = new Map(
  LIVE_PLACE_STATUS_OPTIONS.map((option) => [option.id, option.label]),
)

function hasToMillis(value: unknown): value is TimestampLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  )
}

function formatRelativeTime(value: unknown): string {
  const millis = hasToMillis(value) ? value.toMillis() : 0

  if (!millis) {
    return '방금 전'
  }

  const minutes = Math.max(0, Math.floor((Date.now() - millis) / 60000))

  if (minutes < 1) {
    return '방금 전'
  }

  if (minutes < 60) {
    return `${minutes}분 전`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}시간 전`
  }

  return `${Math.floor(hours / 24)}일 전`
}

function getStatusLabel(statusKey: LivePlaceStatusKey): string {
  return statusLabelById.get(statusKey) || statusKey
}

function getPlaceId(place: KakaoPlaceSearchResult): string {
  return place.id || `${place.place_name}-${place.x}-${place.y}`
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function MapPage() {
  const navigate = useNavigate()
  const { currentUser, profile, firebaseReady } = useAuth()
  const { loading: locationLoading, error: locationError, requestLocation } = useCurrentLocation()
  const [center, setCenter] = useState<LatLng>(SEOUL_CITY_HALL)
  const [initialLocationReady, setInitialLocationReady] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlacePrefill | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<KakaoPlaceSearchResult[]>([])
  const [searchingPlaces, setSearchingPlaces] = useState(false)
  const [placeSearchMessage, setPlaceSearchMessage] = useState('')
  const [error, setError] = useState('')
  const [mapMode, setMapMode] = useState<MapMode>('main')
  const [statusUpdates, setStatusUpdates] = useState<LivePlaceStatusUpdate[]>([])
  const [selectedStatusTags, setSelectedStatusTags] = useState<LivePlaceStatusKey[]>([])
  const [statusNote, setStatusNote] = useState('')
  const [loadingStatusUpdates, setLoadingStatusUpdates] = useState(false)
  const [submittingStatus, setSubmittingStatus] = useState(false)
  const [statusPanelMessage, setStatusPanelMessage] = useState('')
  const [statusPanelMessageType, setStatusPanelMessageType] =
    useState<PanelMessageType>('success')

  const visiblePosts = mapMode === 'main' ? posts : []
  const statusCounts = useMemo(
    () =>
      LIVE_PLACE_STATUS_OPTIONS.map((option) => ({
        ...option,
        count: statusUpdates.filter((update) => update.tags.includes(option.id)).length,
      })).filter((option) => option.count > 0),
    [statusUpdates],
  )

  const loadPosts = useCallback(async () => {
    if (!firebaseReady) {
      setPosts([])
      return
    }

    setLoadingPosts(true)
    setError('')

    try {
      const nextPosts = await getVisiblePosts(currentUser?.uid)
      setPosts(nextPosts)
    } catch (loadError) {
      setError(getErrorMessage(loadError, '기록을 불러오지 못했습니다.'))
    } finally {
      setLoadingPosts(false)
    }
  }, [currentUser?.uid, firebaseReady])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  useEffect(() => {
    let active = true

    async function centerOnCurrentLocation() {
      const nextLocation = await requestLocation()

      if (!active) {
        return
      }

      setCenter(nextLocation)
      setInitialLocationReady(true)
    }

    void centerOnCurrentLocation()

    return () => {
      active = false
    }
  }, [requestLocation])

  useEffect(() => {
    setStatusPanelMessage('')

    if (!firebaseReady || !selectedPlace) {
      setStatusUpdates([])
      setLoadingStatusUpdates(false)
      return undefined
    }

    setLoadingStatusUpdates(true)

    return subscribePlaceStatusUpdates(
      selectedPlace.placeId,
      (updates) => {
        setStatusUpdates(updates)
        setLoadingStatusUpdates(false)
      },
      (statusError) => {
        setStatusPanelMessageType('error')
        setStatusPanelMessage(getErrorMessage(statusError, '실시간 리뷰를 불러오지 못했습니다.'))
        setLoadingStatusUpdates(false)
      },
    )
  }, [firebaseReady, selectedPlace])

  async function handleUseCurrentLocation() {
    const nextLocation = await requestLocation()
    setCenter(nextLocation)
    setInitialLocationReady(true)
  }

  function handleModeChange(nextMode: MapMode) {
    setMapMode(nextMode)

    if (nextMode !== 'main') {
      setSelectedPost(null)
    }
  }

  function handleMapClick(location: LatLng) {
    setSelectedLocation(location)
    setSelectedPlace(null)
    setSelectedPost(null)
  }

  function handleClearSearch() {
    setPlaceQuery('')
    setPlaceResults([])
    setPlaceSearchMessage('')
    setSelectedPlace(null)
    setSelectedLocation(null)
  }

  async function handlePlaceSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!placeQuery.trim()) {
      setPlaceResults([])
      setPlaceSearchMessage('')
      return
    }

    setSearchingPlaces(true)
    setPlaceSearchMessage('')

    try {
      const results = await searchKakaoPlacesByKeyword(placeQuery, center)
      setPlaceResults(results)
      setPlaceSearchMessage(results.length === 0 ? '검색 결과가 없습니다.' : '')
    } catch (searchError) {
      setPlaceResults([])
      setPlaceSearchMessage(getErrorMessage(searchError, '장소 검색에 실패했습니다.'))
    } finally {
      setSearchingPlaces(false)
    }
  }

  function handleSelectPlace(place: KakaoPlaceSearchResult) {
    const location = {
      lat: Number(place.y),
      lng: Number(place.x),
    }

    setCenter(location)
    setSelectedLocation(location)
    setSelectedPlace({
      placeId: getPlaceId(place),
      placeName: place.place_name,
      address: place.road_address_name || place.address_name,
      location,
    })
    setSelectedPost(null)
    setPlaceQuery(place.place_name)
    setPlaceResults([])
    setPlaceSearchMessage('')
  }

  function toggleStatusTag(statusKey: LivePlaceStatusKey) {
    setSelectedStatusTags((currentTags) =>
      currentTags.includes(statusKey)
        ? currentTags.filter((tag) => tag !== statusKey)
        : [...currentTags, statusKey],
    )
  }

  async function handleSubmitPlaceStatus() {
    if (!selectedPlace) {
      setStatusPanelMessageType('error')
      setStatusPanelMessage('장소를 먼저 선택해 주세요.')
      return
    }

    if (!currentUser || !profile) {
      navigate('/login')
      return
    }

    if (selectedStatusTags.length === 0) {
      setStatusPanelMessageType('error')
      setStatusPanelMessage('상태를 하나 이상 선택해 주세요.')
      return
    }

    setSubmittingStatus(true)
    setStatusPanelMessage('')

    try {
      await createLivePlaceStatus(
        {
          placeId: selectedPlace.placeId,
          placeName: selectedPlace.placeName,
          address: selectedPlace.address,
          lat: selectedPlace.location.lat,
          lng: selectedPlace.location.lng,
          tags: selectedStatusTags,
          note: statusNote,
        },
        {
          uid: currentUser.uid,
          nickname: profile.nickname,
        },
      )
      setSelectedStatusTags([])
      setStatusNote('')
      setStatusPanelMessageType('success')
      setStatusPanelMessage('모든 사용자에게 공유되는 실시간 리뷰를 올렸습니다.')
    } catch (submitError) {
      setStatusPanelMessageType('error')
      setStatusPanelMessage(getErrorMessage(submitError, '실시간 리뷰를 올리지 못했습니다.'))
    } finally {
      setSubmittingStatus(false)
    }
  }

  async function handleCreatePost(payload: PostFormSubmitPayload) {
    if (!currentUser || !profile) {
      navigate('/login')
      return
    }

    const input: PostFormInput = {
      title: payload.title,
      content: payload.content,
      placeName: payload.placeName,
      address: payload.address,
      lat: payload.lat,
      lng: payload.lng,
      dateKey: payload.dateKey,
      visibility: payload.visibility,
      pinColor: payload.pinColor,
    }

    await createPost(input, payload.files, {
      uid: currentUser.uid,
      nickname: profile.nickname,
    })
    setIsFormOpen(false)
    setSelectedLocation(null)
    await loadPosts()
  }

  return (
    <PageContainer fullBleed className="map-page">
      <div className="map-shell">
        {initialLocationReady ? (
          <KakaoMapView
            center={center}
            posts={visiblePosts}
            selectedLocation={selectedLocation}
            onMapClick={handleMapClick}
            onMarkerClick={setSelectedPost}
            currentUserUid={currentUser?.uid}
          />
        ) : (
          <section className="kakao-map" aria-label="장소 기록 지도">
            <div className="map-state">
              <strong>현재 위치를 확인하는 중입니다.</strong>
              <p>잠시 후 내 위치를 중심으로 지도를 표시합니다.</p>
            </div>
          </section>
        )}

        <div className="map-toolbar">
          <form className="map-search-form" onSubmit={handlePlaceSearch}>
            <Search size={18} aria-hidden="true" />
            <input
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              placeholder="장소 검색"
            />
            {placeQuery && (
              <button
                className="button-icon ghost"
                type="button"
                onClick={handleClearSearch}
                aria-label="검색어 지우기"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
            <button className="button-icon map-search-submit" type="submit" aria-label="검색">
              <Search size={17} aria-hidden="true" />
            </button>
          </form>

          <div className="map-mode-tabs" role="tablist" aria-label="지도 모드">
            <button
              className={mapMode === 'main' ? 'active' : ''}
              type="button"
              onClick={() => handleModeChange('main')}
            >
              기본 지도
            </button>
            <button
              className={mapMode === 'live' ? 'active' : ''}
              type="button"
              onClick={() => handleModeChange('live')}
            >
              실시간 리뷰
            </button>
          </div>

          <button className="button button-secondary" type="button" onClick={handleUseCurrentLocation}>
            <LocateFixed size={18} aria-hidden="true" />
            {locationLoading ? '확인 중' : '현재 위치'}
          </button>
          <span>
            {mapMode === 'live'
              ? selectedPlace
                ? `공유 리뷰 ${statusUpdates.length}개`
                : '전체 사용자 공유 리뷰'
              : loadingPosts
                ? '기록 불러오는 중'
                : `팔로우 기반 ${posts.length}개의 기록`}
          </span>
          {currentUser && mapMode === 'main' && (
            <span className="map-legend pin-group-legend">
              {POST_PIN_GROUPS.slice(0, 4).map((group) => (
                <i
                  key={group.id}
                  title={group.label}
                  style={{ backgroundColor: getPostPinGroupColor(group.id) }}
                />
              ))}
              내 그룹
              <i className="other" />
              팔로잉
            </span>
          )}
        </div>

        {(placeResults.length > 0 || placeSearchMessage || searchingPlaces) && (
          <div className="map-place-results">
            {searchingPlaces ? (
              <p>검색 중</p>
            ) : placeSearchMessage ? (
              <p>{placeSearchMessage}</p>
            ) : (
              placeResults.map((place) => (
                <button key={getPlaceId(place)} type="button" onClick={() => handleSelectPlace(place)}>
                  <strong>{place.place_name}</strong>
                  <span>{place.road_address_name || place.address_name}</span>
                  {place.distance && <small>{Number(place.distance).toLocaleString()}m</small>}
                </button>
              ))
            )}
          </div>
        )}

        {mapMode === 'live' && (
          <aside className="map-side-panel" aria-label="실시간 리뷰">
            <div className="map-panel-header">
              <div>
                <p className="eyebrow">실시간 리뷰</p>
                <h2>이 장소를 쓰는 모두가 보는 지금 분위기</h2>
              </div>
              <MapPin size={22} aria-hidden="true" />
            </div>

            {selectedPlace ? (
              <>
                <div className="selected-place-card">
                  <strong>{selectedPlace.placeName}</strong>
                  <span>{selectedPlace.address || '주소 정보 없음'}</span>
                </div>

                <div className="status-chip-grid">
                  {LIVE_PLACE_STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      className={`status-chip ${
                        selectedStatusTags.includes(option.id) ? 'active' : ''
                      }`}
                      type="button"
                      onClick={() => toggleStatusTag(option.id)}
                      aria-pressed={selectedStatusTags.includes(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <label className="field compact-field">
                  <span>한줄 리뷰</span>
                  <textarea
                    value={statusNote}
                    onChange={(event) => setStatusNote(event.target.value)}
                    placeholder="예: 2층 창가 자리 여유 있어요"
                  />
                </label>

                <button
                  className="button button-primary wide"
                  type="button"
                  onClick={handleSubmitPlaceStatus}
                  disabled={submittingStatus}
                >
                  <SendHorizonal size={18} aria-hidden="true" />
                  {submittingStatus ? '올리는 중' : '공유 리뷰 올리기'}
                </button>

                {statusPanelMessage && (
                  <p className={`panel-message ${statusPanelMessageType}`}>
                    {statusPanelMessage}
                  </p>
                )}

                <section className="status-panel-section">
                  <h3>지금 많이 찍힌 상태</h3>
                  {loadingStatusUpdates ? (
                    <p className="status-feed-empty">불러오는 중</p>
                  ) : statusCounts.length > 0 ? (
                    <div className="live-status-summary">
                      {statusCounts.map((option) => (
                        <div key={option.id} className="status-meter-row">
                          <span>{option.label}</span>
                          <strong>{option.count}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="status-feed-empty">아직 올라온 리뷰가 없습니다.</p>
                  )}
                </section>

                <section className="status-panel-section">
                  <h3>최근 공유 리뷰</h3>
                  {statusUpdates.length > 0 ? (
                    <ol className="status-feed">
                      {statusUpdates.slice(0, 6).map((update) => (
                        <li key={update.id}>
                          <div>
                            <strong>{update.authorNickname}</strong>
                            <time>{formatRelativeTime(update.createdAt)}</time>
                          </div>
                          <p>
                            {update.tags.map(getStatusLabel).join(' · ')}
                            {update.note ? ` · ${update.note}` : ''}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="status-feed-empty">첫 공유 리뷰를 남겨보세요.</p>
                  )}
                </section>
              </>
            ) : (
              <div className="map-panel-empty">
                <strong>검색한 장소를 선택하면 모두가 보는 실시간 리뷰가 열립니다.</strong>
                <p>붐빔, 자리, 조용함, 웨이팅 같은 즉시 정보를 앱 사용자 전체와 공유합니다.</p>
              </div>
            )}
          </aside>
        )}

        {(locationError || error) && <p className="map-error">{locationError || error}</p>}
        {!currentUser && (
          <div className="map-floating map-login-prompt">
            <p>
              {mapMode === 'main'
                ? '로그인하면 팔로우한 사람들의 핀 위치가 지도에 표시됩니다.'
                : '로그인하면 모두가 보는 실시간 리뷰를 남길 수 있습니다.'}
            </p>
            <button className="button button-primary" type="button" onClick={() => navigate('/login')}>
              로그인
            </button>
          </div>
        )}

        {selectedLocation && mapMode === 'main' && !isFormOpen && currentUser && (
          <div className="map-floating map-record-floating">
            {selectedPlace ? (
              <p>
                <strong>{selectedPlace.placeName}</strong>
                <span>{selectedPlace.address || '주소 정보 없음'}</span>
              </p>
            ) : (
              <p>
                선택한 좌표 {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
              </p>
            )}
            <button
              className="button button-primary"
              type="button"
              onClick={() => (currentUser ? setIsFormOpen(true) : navigate('/login'))}
            >
              <Plus size={18} aria-hidden="true" />
              {selectedPlace ? '이 장소 기록하기' : '이곳에 기록하기'}
            </button>
          </div>
        )}

        {selectedPost && <MapPostPreview post={selectedPost} onClose={() => setSelectedPost(null)} />}
      </div>

      <PostFormModal
        isOpen={isFormOpen}
        mode="create"
        location={selectedLocation}
        placePrefill={selectedPlace}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreatePost}
      />
    </PageContainer>
  )
}
