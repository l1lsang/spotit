import { Compass, Layers, LocateFixed, MapPin, Plus, Search, SendHorizonal, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GroupJoinButton } from '../components/group/GroupJoinButton'
import { PageContainer } from '../components/layout/PageContainer'
import { MapView } from '../components/map/MapView'
import { MapPinList } from '../components/map/MapPinList'
import { MapPostPreview } from '../components/map/MapPostPreview'
import { PostFormModal, type PostFormSubmitPayload } from '../components/post/PostFormModal'
import { useAuth } from '../hooks/useAuth'
import { useGroups } from '../hooks/useGroups'
import { getGroupMapUrl } from '../lib/groupNavigation'
import { SEOUL_CITY_HALL, useCurrentLocation } from '../hooks/useCurrentLocation'
import { getMapProvider, type LatLng, type MapProvider, type PlaceSearchResult } from '../lib/mapLocation'
import { searchPlaces } from '../lib/placeSearch'
import {
  createLivePlaceStatus,
  subscribePlaceStatusUpdates,
} from '../services/mapFeatureService'
import { createPost, getVisiblePosts, subscribeGroupPosts } from '../services/postService'
import {
  LIVE_PLACE_STATUS_OPTIONS,
  type LivePlaceStatusKey,
  type LivePlaceStatusUpdate,
} from '../types/mapFeature'
import {
  DEFAULT_POST_PIN_COLOR,
  FOLLOWING_PIN_COLOR,
  type Post,
  type PostFormInput,
} from '../types/post'
import '../styles/mapGroups.css'

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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function MapPage() {
  const [searchParams] = useSearchParams()
  const { currentUser } = useAuth()
  const groupId = searchParams.get('group') || ''
  return <ScopedMapPage key={`${currentUser?.uid || 'guest'}:${groupId}`} groupId={groupId} />
}

function ScopedMapPage({ groupId }: { groupId: string }) {
  const navigate = useNavigate()
  const { currentUser, profile, firebaseReady } = useAuth()
  const groupState = useGroups()
  const selectedGroup = groupState.groups.find(group => group.id === groupId)
  const selectedGroupId = selectedGroup?.id
  const joined = groupState.joinedIds.includes(groupId)
  const canCreatePin = !groupId || Boolean(selectedGroup && joined && !groupState.loading && !groupState.error)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const mapShellRef = useRef<HTMLDivElement>(null)
  const { loading: locationLoading, error: locationError, requestLocation } = useCurrentLocation()
  const [center, setCenter] = useState<LatLng>(SEOUL_CITY_HALL)
  const [initialLocationReady, setInitialLocationReady] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlacePrefill | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [clusterPosts, setClusterPosts] = useState<Post[]>([])
  const [providerOverride, setProviderOverride] = useState<MapProvider | 'auto'>('auto')
  const provider = providerOverride === 'auto' ? getMapProvider(center) : providerOverride
  const searchRequestRef = useRef(0)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [postsRevision, setPostsRevision] = useState(0)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([])
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

  const visiblePosts = mapMode === 'main' && (!groupId || selectedGroup) ? posts : []
  const statusCounts = useMemo(
    () =>
      LIVE_PLACE_STATUS_OPTIONS.map((option) => ({
        ...option,
        count: statusUpdates.filter((update) => update.tags.includes(option.id)).length,
      })).filter((option) => option.count > 0),
    [statusUpdates],
  )

  const loadPosts = useCallback(async () => {
    if (groupId) return
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
  }, [currentUser?.uid, firebaseReady, groupId])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  useEffect(() => {
    if (!groupId || !selectedGroupId || !currentUser || !firebaseReady) return
    let first = true
    setLoadingPosts(true)
    setError('')
    return subscribeGroupPosts(selectedGroupId, next => {
      setPosts(next)
      setLoadingPosts(false)
      setSelectedPost(previous => next.find(post => post.id === previous?.id) || null)
      setClusterPosts(previous => next.filter(post => previous.some(item => item.id === post.id)))
      if (first && next[0]) setCenter({ lat: next[0].lat, lng: next[0].lng })
      first = false
    }, () => { setError('그룹 핀을 불러오지 못했습니다.'); setLoadingPosts(false) })
  }, [currentUser, firebaseReady, groupId, selectedGroupId, postsRevision])

  useEffect(() => {
    const toolbar = toolbarRef.current
    const shell = mapShellRef.current
    if (!toolbar || !shell) return
    const measure = () => shell.style.setProperty('--map-toolbar-height', `${toolbar.getBoundingClientRect().height}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true

    // A group opens at its first pin; a pending device location must not move it away again.
    if (groupId) { setInitialLocationReady(true); return }

    async function centerOnCurrentLocation() {
      const nextLocation = await requestLocation(false)

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
  }, [requestLocation, groupId])

  useEffect(() => {
    setStatusPanelMessage('')

    if (!firebaseReady || !currentUser || !selectedPlace || mapMode !== 'live') {
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
  }, [firebaseReady, selectedPlace, currentUser, mapMode])

  async function handleUseCurrentLocation() {
    const nextLocation = await requestLocation()
    setProviderOverride('auto')
    setSelectedPost(null)
    setClusterPosts([])
    setSelectedLocation(null)
    setSelectedPlace(null)
    setCenter(nextLocation)
    setInitialLocationReady(true)
  }

  function handleModeChange(nextMode: MapMode) {
    setMapMode(nextMode)
    setClusterPosts([])

    if (nextMode !== 'main') {
      setSelectedPost(null)
    }
  }

  function handleMapClick(location: LatLng) {
    setSelectedLocation(location)
    setSelectedPlace(null)
    setSelectedPost(null)
    setClusterPosts([])
  }

  function handleSelectPost(post: Post) {
    setProviderOverride('auto')
    setSelectedPost(post)
    setSelectedLocation(null)
    setSelectedPlace(null)
    setCenter({ lat: post.lat, lng: post.lng })
  }

  function handleClusterClick(group: Post[]) {
    setClusterPosts(group)
    setSelectedPost(null)
    setSelectedLocation(null)
    setSelectedPlace(null)
  }

  function handleClearSearch() {
    searchRequestRef.current += 1
    setSearchingPlaces(false)
    setPlaceQuery('')
    setPlaceResults([])
    setPlaceSearchMessage('')
    setSelectedPlace(null)
    setSelectedLocation(null)
  }

  async function handlePlaceSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const requestId = ++searchRequestRef.current

    if (!placeQuery.trim()) {
      setPlaceResults([])
      setPlaceSearchMessage('')
      setSearchingPlaces(false)
      return
    }

    setSearchingPlaces(true)
    setPlaceSearchMessage('')

    try {
      const results = await searchPlaces(placeQuery, center, provider)
      if (requestId !== searchRequestRef.current) return
      setPlaceResults(results)
      setPlaceSearchMessage(results.length === 0 ? '검색 결과가 없습니다.' : '')
    } catch (searchError) {
      if (requestId !== searchRequestRef.current) return
      setPlaceResults([])
      setPlaceSearchMessage(getErrorMessage(searchError, '장소 검색에 실패했습니다.'))
    } finally {
      if (requestId === searchRequestRef.current) setSearchingPlaces(false)
    }
  }

  function handleSelectPlace(place: PlaceSearchResult) {
    const location = place.location
    setClusterPosts([])
    setProviderOverride(place.provider)

    setCenter(location)
    setSelectedLocation(location)
    setSelectedPlace({
      placeId: place.id,
      placeName: place.name,
      address: place.address,
      location,
    })
    setSelectedPost(null)
    setPlaceQuery(place.name)
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

    if (!canCreatePin) throw new Error('그룹에 가입한 뒤 핀을 남겨 주세요.')

    const input: PostFormInput = {
      title: payload.title,
      content: payload.content,
      placeName: payload.placeName,
      address: payload.address,
      lat: payload.lat,
      lng: payload.lng,
      dateKey: payload.dateKey,
      visibility: groupId ? 'public' : payload.visibility,
      pinColor: payload.pinColor,
      pinThemeId: payload.pinThemeId || '',
      groupId: groupId || payload.groupId || '',
    }

    await createPost(input, payload.files, {
      uid: currentUser.uid,
      nickname: profile.nickname,
    })
    setIsFormOpen(false)
    setSelectedLocation(null)
    if (input.groupId && input.groupId !== groupId) {
      navigate(getGroupMapUrl(input.groupId))
      return
    }
    await loadPosts()
  }

  return (
    <PageContainer fullBleed className="map-page">
      <div ref={mapShellRef} className="map-shell map-with-groups" aria-busy={loadingPosts || Boolean(groupId && groupState.loading)}>
        {initialLocationReady ? (
          <MapView
            center={center}
            provider={provider}
            posts={visiblePosts}
            selectedLocation={selectedLocation}
            selectedPostId={selectedPost?.id}
            onMapClick={handleMapClick}
            onMarkerClick={(post) => { setClusterPosts([]); handleSelectPost(post) }}
            onClusterClick={handleClusterClick}
            currentUserUid={currentUser?.uid}
            pinThemes={profile?.pinThemes}
          />
        ) : (
          <section className="location-map" aria-label="장소 기록 지도">
            <div className="map-state">
              <strong>현재 위치를 확인하는 중입니다.</strong>
              <p>잠시 후 내 위치를 중심으로 지도를 표시합니다.</p>
            </div>
          </section>
        )}

        <div ref={toolbarRef} className="map-toolbar">
          <div className="map-search-row">
          <form className="map-search-form" onSubmit={handlePlaceSearch}>
            <Search size={18} aria-hidden="true" />
            <input
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              placeholder="장소 검색"
              aria-label="장소 검색"
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
            <button className="button-icon map-search-submit" type="submit" aria-label="검색" disabled={searchingPlaces || !initialLocationReady}>
              <Search size={17} aria-hidden="true" />
            </button>
          </form>
            <Link className="map-groups-link" to="/groups" aria-label="그룹 페이지 열기" title="그룹 둘러보기 · 내 그룹">
              <Compass size={22} aria-hidden="true" />
              <span>그룹</span>
            </Link>
          </div>

          {mapMode === 'main' && currentUser && <div className="map-scope-controls">
            <select aria-label="지도에 표시할 그룹" value={groupId} disabled={groupState.loading || Boolean(groupState.error)} onChange={event => navigate(getGroupMapUrl(event.target.value))}>
              <option value="">내 지도 · 나와 팔로잉</option>
              {groupState.groups.filter(group => groupState.joinedIds.includes(group.id) || group.id === groupId).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              {groupId && !selectedGroup && <option value={groupId}>{groupState.loading ? '그룹 불러오는 중…' : '그룹을 찾을 수 없습니다'}</option>}
            </select>
            {selectedGroup && <Link className="button button-secondary" to={`/groups/${selectedGroup.id}`}>그룹 홈</Link>}
            {selectedGroup && !joined && !groupState.loading && !groupState.error && <GroupJoinButton groupId={groupId} joined={false} />}
          </div>}

          {groupState.error && <p className="map-group-notice" role="alert">{groupState.error} <button type="button" onClick={groupState.retry}>다시 시도</button>{groupId && <Link to="/map">내 지도로</Link>}</p>}
          {groupId && currentUser && !groupState.loading && !groupState.error && !selectedGroup && <p className="map-group-notice" role="alert">그룹을 찾을 수 없습니다. <Link to="/groups">그룹 둘러보기</Link></p>}

          <div className="map-mode-tabs" role="tablist" aria-label="지도 모드">
            <button
              className={mapMode === 'main' ? 'active' : ''}
              type="button"
              onClick={() => handleModeChange('main')}
            >
              {groupId ? '그룹 지도' : '기본 지도'}
            </button>
            <button
              className={mapMode === 'live' ? 'active' : ''}
              type="button"
              onClick={() => handleModeChange('live')}
            >
              실시간 리뷰
            </button>
          </div>

          {currentUser && mapMode === 'main' && (
            <span className="map-legend pin-group-legend">
              <i style={{ backgroundColor: DEFAULT_POST_PIN_COLOR }} />
              {profile?.pinThemes?.slice(0, 3).map((theme) => (
                <i
                  key={theme.id}
                  title={theme.name}
                  style={{ backgroundColor: theme.color }}
                />
              ))}
              내 핀
              <i className="other" style={{ backgroundColor: FOLLOWING_PIN_COLOR }} />
              {groupId ? '그룹 멤버' : '팔로잉'}
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
                <button key={place.id} type="button" onClick={() => handleSelectPlace(place)}>
                  <strong>{place.name}</strong>
                  <span>{place.address}</span>
                  {place.distanceMeters !== undefined && <small>{place.distanceMeters.toLocaleString()}m</small>}
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

        {(locationError || error) && <p className="map-error" role="alert">{locationError || error}{error && groupId && <button type="button" onClick={() => setPostsRevision(value => value + 1)}>다시 시도</button>}</p>}
        {!currentUser && (
          <div className="map-floating map-login-prompt">
            <p>
              {mapMode === 'main'
                ? groupId ? '로그인하면 이 그룹의 핀을 보고 함께 참여할 수 있습니다.' : '로그인하면 팔로우한 사람들의 핀 위치가 지도에 표시됩니다.'
                : '로그인하면 모두가 보는 실시간 리뷰를 남길 수 있습니다.'}
            </p>
            <button className="button button-primary" type="button" onClick={() => navigate('/login', { state: { from: getGroupMapUrl(groupId) } })}>
              로그인
            </button>
          </div>
        )}

        {selectedLocation && mapMode === 'main' && !isFormOpen && currentUser && canCreatePin && (
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
              {groupId ? '이곳에 그룹 핀 남기기' : selectedPlace ? '이 장소 기록하기' : '이곳에 기록하기'}
            </button>
          </div>
        )}

        {clusterPosts.length > 1 && !selectedPost && <MapPinList posts={clusterPosts} onSelect={handleSelectPost} onClose={() => setClusterPosts([])} />}
        {selectedPost && <MapPostPreview key={selectedPost.id} post={selectedPost}
          onClose={() => { setSelectedPost(null); setClusterPosts([]) }}
          onBack={clusterPosts.length > 1 ? () => setSelectedPost(null) : undefined}
        />}

        <div className="map-bottom-controls" role="group" aria-label="지도 도구">
          <label className="map-control-icon map-provider-control" title={`지도 선택 · ${providerOverride === 'auto' ? '자동 · ' : ''}${provider === 'kakao' ? '카카오맵' : 'Google Maps'}`}>
            <Layers size={21} aria-hidden="true" />
            <select className="map-provider-icon-select" aria-label="지도 제공자 선택" value={providerOverride} onChange={(event) => {
              setProviderOverride(event.target.value as MapProvider | 'auto')
              searchRequestRef.current += 1
              setSearchingPlaces(false)
              setPlaceResults([])
              setPlaceSearchMessage('')
            }}>
              <option value="auto">자동 · {getMapProvider(center) === 'kakao' ? '카카오맵' : 'Google Maps'}</option>
              <option value="kakao">카카오맵</option>
              <option value="google">Google Maps</option>
            </select>
          </label>
          <button className={`map-control-icon${locationLoading ? ' is-locating' : ''}`} type="button" onClick={handleUseCurrentLocation} disabled={locationLoading}
            aria-label={locationLoading ? '현재 위치 확인 중' : '현재 위치로 이동'} aria-busy={locationLoading} title="현재 위치로 이동">
            <LocateFixed size={21} aria-hidden="true" />
          </button>
        </div>
      </div>

      <PostFormModal
        isOpen={isFormOpen && canCreatePin}
        mode="create"
        location={selectedLocation}
        placePrefill={selectedPlace}
        initialGroupId={groupId}
        lockGroup={Boolean(groupId)}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreatePost}
      />
    </PageContainer>
  )
}
