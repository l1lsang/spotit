import {
  LocateFixed,
  MapPin,
  Palette,
  Plus,
  Save,
  Search,
  SendHorizonal,
  UsersRound,
  X,
} from 'lucide-react'
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
  addProjectPin,
  createLivePlaceStatus,
  createPlaceProject,
  invitePlaceProjectMember,
  subscribePlaceProjectsForUser,
  subscribePlaceStatusUpdates,
  subscribeProjectPins,
  updatePlaceProjectColor,
} from '../services/mapFeatureService'
import { createPost, getVisiblePosts } from '../services/postService'
import {
  DEFAULT_PROJECT_PIN_COLOR,
  LIVE_PLACE_STATUS_OPTIONS,
  PROJECT_PIN_COLORS,
  getProjectPinColorValue,
  type LivePlaceStatusKey,
  type LivePlaceStatusUpdate,
  type PlaceProject,
  type ProjectPin,
  type ProjectPinColor,
  type ProjectPinMapMarker,
} from '../types/mapFeature'
import type { Post, PostFormInput } from '../types/post'

type MapMode = 'live' | 'projects'
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
  const [selectedProjectPin, setSelectedProjectPin] = useState<ProjectPinMapMarker | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<KakaoPlaceSearchResult[]>([])
  const [searchingPlaces, setSearchingPlaces] = useState(false)
  const [placeSearchMessage, setPlaceSearchMessage] = useState('')
  const [error, setError] = useState('')
  const [mapMode, setMapMode] = useState<MapMode>('live')
  const [statusUpdates, setStatusUpdates] = useState<LivePlaceStatusUpdate[]>([])
  const [selectedStatusTags, setSelectedStatusTags] = useState<LivePlaceStatusKey[]>([])
  const [statusNote, setStatusNote] = useState('')
  const [loadingStatusUpdates, setLoadingStatusUpdates] = useState(false)
  const [submittingStatus, setSubmittingStatus] = useState(false)
  const [statusPanelMessage, setStatusPanelMessage] = useState('')
  const [statusPanelMessageType, setStatusPanelMessageType] =
    useState<PanelMessageType>('success')
  const [projects, setProjects] = useState<PlaceProject[]>([])
  const [projectPins, setProjectPins] = useState<ProjectPin[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [newProjectColor, setNewProjectColor] =
    useState<ProjectPinColor>(DEFAULT_PROJECT_PIN_COLOR)
  const [projectPinNote, setProjectPinNote] = useState('')
  const [inviteValue, setInviteValue] = useState('')
  const [projectBusy, setProjectBusy] = useState(false)
  const [projectPanelMessage, setProjectPanelMessage] = useState('')
  const [projectPanelMessageType, setProjectPanelMessageType] =
    useState<PanelMessageType>('success')

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

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  )
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects])
  const projectMetaById = useMemo(
    () =>
      new Map(
        projects.map((project) => [
          project.id,
          { name: project.name, pinColor: project.pinColor },
        ]),
      ),
    [projects],
  )
  const mapProjectPins = useMemo<ProjectPinMapMarker[]>(
    () =>
      projectPins.map((pin) => {
        const projectMeta = projectMetaById.get(pin.projectId)

        return {
          ...pin,
          projectName: projectMeta?.name || '친구 지도',
          pinColor: projectMeta?.pinColor || DEFAULT_PROJECT_PIN_COLOR,
        }
      }),
    [projectMetaById, projectPins],
  )
  const selectedProjectPins = useMemo(
    () => projectPins.filter((pin) => pin.projectId === selectedProjectId),
    [projectPins, selectedProjectId],
  )
  const statusCounts = useMemo(
    () =>
      LIVE_PLACE_STATUS_OPTIONS.map((option) => ({
        ...option,
        count: statusUpdates.filter((update) => update.tags.includes(option.id)).length,
      })).filter((option) => option.count > 0),
    [statusUpdates],
  )
  const canEditSelectedProject = Boolean(
    currentUser && selectedProject && selectedProject.ownerUid === currentUser.uid,
  )

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
        setStatusPanelMessage(getErrorMessage(statusError, '실시간 상태를 불러오지 못했습니다.'))
        setLoadingStatusUpdates(false)
      },
    )
  }, [firebaseReady, selectedPlace])

  useEffect(() => {
    const uid = currentUser?.uid

    if (!firebaseReady || !uid) {
      setProjects([])
      setProjectPins([])
      setSelectedProjectId('')
      return undefined
    }

    return subscribePlaceProjectsForUser(
      uid,
      currentUser.email,
      (nextProjects) => {
        setProjects(nextProjects)
      },
      (projectError) => {
        setProjectPanelMessageType('error')
        setProjectPanelMessage(getErrorMessage(projectError, '친구 지도를 불러오지 못했습니다.'))
      },
    )
  }, [currentUser?.email, currentUser?.uid, firebaseReady])

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId('')
      return
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id)
    }
  }, [projects, selectedProjectId])

  useEffect(() => {
    if (!firebaseReady || projectIds.length === 0) {
      setProjectPins([])
      return undefined
    }

    return subscribeProjectPins(
      projectIds,
      setProjectPins,
      (pinError) => {
        setProjectPanelMessageType('error')
        setProjectPanelMessage(getErrorMessage(pinError, '프로젝트 핀을 불러오지 못했습니다.'))
      },
    )
  }, [firebaseReady, projectIds])

  async function handleUseCurrentLocation() {
    const nextLocation = await requestLocation()
    setCenter(nextLocation)
    setInitialLocationReady(true)
  }

  function handleMapClick(location: LatLng) {
    setSelectedLocation(location)
    setSelectedPlace(null)
    setSelectedPost(null)
    setSelectedProjectPin(null)
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
    setSelectedProjectPin(null)
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
          email: currentUser.email || '',
        },
      )
      setSelectedStatusTags([])
      setStatusNote('')
      setStatusPanelMessageType('success')
      setStatusPanelMessage('방금 상태를 올렸습니다.')
    } catch (submitError) {
      setStatusPanelMessageType('error')
      setStatusPanelMessage(getErrorMessage(submitError, '상태를 올리지 못했습니다.'))
    } finally {
      setSubmittingStatus(false)
    }
  }

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentUser || !profile) {
      navigate('/login')
      return
    }

    if (!newProjectName.trim()) {
      setProjectPanelMessageType('error')
      setProjectPanelMessage('프로젝트 이름을 입력해 주세요.')
      return
    }

    setProjectBusy(true)
    setProjectPanelMessage('')

    try {
      const projectId = await createPlaceProject(
        {
          name: newProjectName,
          description: newProjectDescription,
          pinColor: newProjectColor,
        },
        {
          uid: currentUser.uid,
          nickname: profile.nickname,
          email: currentUser.email || '',
        },
      )

      setNewProjectName('')
      setNewProjectDescription('')
      setNewProjectColor(DEFAULT_PROJECT_PIN_COLOR)
      setSelectedProjectId(projectId)
      setMapMode('projects')
      setProjectPanelMessageType('success')
      setProjectPanelMessage('프로젝트를 만들었습니다.')
    } catch (projectError) {
      setProjectPanelMessageType('error')
      setProjectPanelMessage(getErrorMessage(projectError, '프로젝트를 만들지 못했습니다.'))
    } finally {
      setProjectBusy(false)
    }
  }

  async function handleInviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProject || !currentUser) {
      return
    }

    setProjectBusy(true)
    setProjectPanelMessage('')

    try {
      await invitePlaceProjectMember(selectedProject.id, inviteValue, {
        uid: currentUser.uid,
        nickname: profile?.nickname || currentUser.email?.split('@')[0] || 'spotter',
        email: currentUser.email || '',
      })
      setInviteValue('')
      setProjectPanelMessageType('success')
      setProjectPanelMessage('초대가 반영되었습니다.')
    } catch (inviteError) {
      setProjectPanelMessageType('error')
      setProjectPanelMessage(getErrorMessage(inviteError, '친구를 초대하지 못했습니다.'))
    } finally {
      setProjectBusy(false)
    }
  }

  async function handleProjectColorChange(pinColor: ProjectPinColor) {
    if (!selectedProject || !currentUser || selectedProject.pinColor === pinColor) {
      return
    }

    setProjectBusy(true)
    setProjectPanelMessage('')

    try {
      await updatePlaceProjectColor(selectedProject.id, pinColor, currentUser.uid)
      setProjectPanelMessageType('success')
      setProjectPanelMessage('핀 색을 바꿨습니다.')
    } catch (colorError) {
      setProjectPanelMessageType('error')
      setProjectPanelMessage(getErrorMessage(colorError, '핀 색을 바꾸지 못했습니다.'))
    } finally {
      setProjectBusy(false)
    }
  }

  async function handleAddProjectPin() {
    if (!currentUser || !profile) {
      navigate('/login')
      return
    }

    if (!selectedProject) {
      setProjectPanelMessageType('error')
      setProjectPanelMessage('프로젝트를 먼저 선택해 주세요.')
      return
    }

    if (!selectedPlace) {
      setProjectPanelMessageType('error')
      setProjectPanelMessage('장소를 먼저 선택해 주세요.')
      return
    }

    setProjectBusy(true)
    setProjectPanelMessage('')

    try {
      await addProjectPin(
        {
          projectId: selectedProject.id,
          placeId: selectedPlace.placeId,
          placeName: selectedPlace.placeName,
          address: selectedPlace.address,
          lat: selectedPlace.location.lat,
          lng: selectedPlace.location.lng,
          note: projectPinNote,
        },
        {
          uid: currentUser.uid,
          nickname: profile.nickname,
          email: currentUser.email || '',
        },
      )
      setProjectPinNote('')
      setMapMode('projects')
      setProjectPanelMessageType('success')
      setProjectPanelMessage('프로젝트 지도에 저장했습니다.')
    } catch (pinError) {
      setProjectPanelMessageType('error')
      setProjectPanelMessage(getErrorMessage(pinError, '핀을 저장하지 못했습니다.'))
    } finally {
      setProjectBusy(false)
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
            posts={posts}
            projectPins={mapProjectPins}
            selectedLocation={selectedLocation}
            onMapClick={handleMapClick}
            onMarkerClick={(post) => {
              setSelectedProjectPin(null)
              setSelectedPost(post)
            }}
            onProjectPinClick={(pin) => {
              setSelectedPost(null)
              setSelectedProjectPin(pin)
            }}
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
              className={mapMode === 'live' ? 'active' : ''}
              type="button"
              onClick={() => setMapMode('live')}
            >
              실시간 상태
            </button>
            <button
              className={mapMode === 'projects' ? 'active' : ''}
              type="button"
              onClick={() => setMapMode('projects')}
            >
              친구 지도
            </button>
          </div>

          <button className="button button-secondary" type="button" onClick={handleUseCurrentLocation}>
            <LocateFixed size={18} aria-hidden="true" />
            {locationLoading ? '확인 중' : '현재 위치'}
          </button>
          <span>
            {mapMode === 'projects'
              ? `프로젝트 핀 ${mapProjectPins.length}개`
              : loadingPosts
                ? '기록 불러오는 중'
                : `팔로우 기반 ${posts.length}개의 기록`}
          </span>
          {currentUser && (
            <span className="map-legend">
              <i className="mine" />
              내 기록
              <i
                className="project"
                style={{
                  backgroundColor: getProjectPinColorValue(
                    selectedProject?.pinColor || DEFAULT_PROJECT_PIN_COLOR,
                  ),
                }}
              />
              프로젝트
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

        <aside className="map-side-panel" aria-label={mapMode === 'live' ? '실시간 장소 상태' : '친구 지도'}>
          {mapMode === 'live' ? (
            <>
              <div className="map-panel-header">
                <div>
                  <p className="eyebrow">실시간 장소 상태</p>
                  <h2>리뷰 말고, 지금 여기 분위기</h2>
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
                    <span>한줄 메모</span>
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
                    {submittingStatus ? '올리는 중' : '상태 올리기'}
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
                      <p className="status-feed-empty">아직 올라온 상태가 없습니다.</p>
                    )}
                  </section>

                  <section className="status-panel-section">
                    <h3>최근 업데이트</h3>
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
                      <p className="status-feed-empty">첫 상태를 남겨보세요.</p>
                    )}
                  </section>
                </>
              ) : (
                <div className="map-panel-empty">
                  <strong>검색한 장소를 선택하면 지금 상태가 열립니다.</strong>
                  <p>붐빔, 자리, 조용함, 웨이팅 같은 즉시 정보를 남길 수 있습니다.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="map-panel-header">
                <div>
                  <p className="eyebrow">친구 지도</p>
                  <h2>모르는 사람 리뷰보다 친구가 찍은 장소</h2>
                </div>
                <UsersRound size={22} aria-hidden="true" />
              </div>

              {!currentUser ? (
                <div className="map-panel-empty">
                  <strong>로그인하면 친구 지도를 만들 수 있습니다.</strong>
                  <button className="button button-primary wide" type="button" onClick={() => navigate('/login')}>
                    로그인
                  </button>
                </div>
              ) : (
                <>
                  <form className="project-create-form" onSubmit={handleCreateProject}>
                    <label className="field compact-field">
                      <span>프로젝트 이름</span>
                      <input
                        value={newProjectName}
                        onChange={(event) => setNewProjectName(event.target.value)}
                        placeholder="예: 한성대 공부 스팟"
                      />
                    </label>
                    <label className="field compact-field">
                      <span>설명</span>
                      <input
                        value={newProjectDescription}
                        onChange={(event) => setNewProjectDescription(event.target.value)}
                        placeholder="친구들과 같이 채우는 지도"
                      />
                    </label>
                    <div className="project-color-palette" aria-label="프로젝트 핀 색상">
                      {PROJECT_PIN_COLORS.map((pinColor) => (
                        <button
                          key={pinColor.id}
                          className={`color-swatch-button ${
                            newProjectColor === pinColor.id ? 'active' : ''
                          }`}
                          type="button"
                          onClick={() => setNewProjectColor(pinColor.id)}
                          aria-pressed={newProjectColor === pinColor.id}
                        >
                          <i style={{ backgroundColor: pinColor.value }} />
                          {pinColor.label}
                        </button>
                      ))}
                    </div>
                    <button className="button button-secondary wide" type="submit" disabled={projectBusy}>
                      <Plus size={18} aria-hidden="true" />
                      프로젝트 만들기
                    </button>
                  </form>

                  {projects.length > 0 && (
                    <div className="project-list" aria-label="내 친구 지도 프로젝트">
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          className={`project-row ${
                            selectedProjectId === project.id ? 'active' : ''
                          }`}
                          type="button"
                          onClick={() => setSelectedProjectId(project.id)}
                        >
                          <i
                            style={{ backgroundColor: getProjectPinColorValue(project.pinColor) }}
                          />
                          <span>
                            <strong>{project.name}</strong>
                            <small>
                              핀 {project.pinCount || 0}개 · 멤버 {project.memberUids.length}명
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedProject && (
                    <section className="project-detail">
                      <div className="project-detail-heading">
                        <div>
                          <h3>{selectedProject.name}</h3>
                          {selectedProject.description && <p>{selectedProject.description}</p>}
                        </div>
                        <span
                          className="project-pin-count"
                          style={{
                            borderColor: getProjectPinColorValue(selectedProject.pinColor),
                            color: getProjectPinColorValue(selectedProject.pinColor),
                          }}
                        >
                          {selectedProjectPins.length}
                        </span>
                      </div>

                      <div className="project-meta">
                        <UsersRound size={16} aria-hidden="true" />
                        {selectedProject.memberNicknames.join(', ') || selectedProject.ownerNickname}
                      </div>

                      <div className="project-color-panel">
                        <span>
                          <Palette size={16} aria-hidden="true" />
                          프로젝트 핀 색
                        </span>
                        <div className="project-color-palette compact">
                          {PROJECT_PIN_COLORS.map((pinColor) => (
                            <button
                              key={pinColor.id}
                              className={`color-swatch-button ${
                                selectedProject.pinColor === pinColor.id ? 'active' : ''
                              }`}
                              type="button"
                              onClick={() => handleProjectColorChange(pinColor.id)}
                              disabled={!canEditSelectedProject || projectBusy}
                              aria-pressed={selectedProject.pinColor === pinColor.id}
                            >
                              <i style={{ backgroundColor: pinColor.value }} />
                              {pinColor.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <form className="project-invite-form" onSubmit={handleInviteMember}>
                        <input
                          value={inviteValue}
                          onChange={(event) => setInviteValue(event.target.value)}
                          placeholder="친구 이메일 또는 닉네임"
                        />
                        <button className="button-icon" type="submit" disabled={projectBusy} aria-label="친구 초대">
                          <SendHorizonal size={17} aria-hidden="true" />
                        </button>
                      </form>

                      <div className="project-save-card">
                        {selectedPlace ? (
                          <>
                            <strong>{selectedPlace.placeName}</strong>
                            <span>{selectedPlace.address || '주소 정보 없음'}</span>
                            <textarea
                              value={projectPinNote}
                              onChange={(event) => setProjectPinNote(event.target.value)}
                              placeholder="예: 창가 자리 좋음"
                            />
                            <button
                              className="button button-primary wide"
                              type="button"
                              onClick={handleAddProjectPin}
                              disabled={projectBusy}
                            >
                              <Save size={18} aria-hidden="true" />
                              이 장소 저장
                            </button>
                          </>
                        ) : (
                          <p>검색한 장소를 프로젝트 핀으로 저장할 수 있습니다.</p>
                        )}
                      </div>

                      {selectedProjectPins.length > 0 && (
                        <div className="project-pin-list">
                          {selectedProjectPins.slice(0, 6).map((pin) => (
                            <button
                              key={pin.id}
                              className="project-pin-row"
                              type="button"
                              onClick={() => {
                                const projectMeta = projectMetaById.get(pin.projectId)
                                setSelectedProjectPin({
                                  ...pin,
                                  projectName: projectMeta?.name || selectedProject.name,
                                  pinColor: projectMeta?.pinColor || selectedProject.pinColor,
                                })
                                setCenter({ lat: pin.lat, lng: pin.lng })
                              }}
                            >
                              <i
                                style={{
                                  backgroundColor: getProjectPinColorValue(selectedProject.pinColor),
                                }}
                              />
                              <span>
                                <strong>{pin.placeName}</strong>
                                <small>{pin.note || pin.address}</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {projectPanelMessage && (
                    <p className={`panel-message ${projectPanelMessageType}`}>
                      {projectPanelMessage}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </aside>

        {(locationError || error) && <p className="map-error">{locationError || error}</p>}
        {!currentUser && mapMode === 'live' && (
          <div className="map-floating map-login-prompt">
            <p>로그인하면 장소 상태와 친구 지도를 함께 남길 수 있습니다.</p>
            <button className="button button-primary" type="button" onClick={() => navigate('/login')}>
              로그인
            </button>
          </div>
        )}

        {selectedLocation && !selectedPlace && !isFormOpen && currentUser && (
          <div className="map-floating map-record-floating">
            <p>
              선택한 좌표 {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
            </p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => (currentUser ? setIsFormOpen(true) : navigate('/login'))}
            >
              <Plus size={18} aria-hidden="true" />
              이곳에 기록하기
            </button>
          </div>
        )}

        {selectedProjectPin && (
          <article className="map-preview project-pin-preview" aria-label="선택한 프로젝트 핀">
            <button
              className="button-icon ghost"
              type="button"
              onClick={() => setSelectedProjectPin(null)}
              aria-label="프로젝트 핀 닫기"
            >
              <X size={17} aria-hidden="true" />
            </button>
            <h2>{selectedProjectPin.placeName}</h2>
            <p className="preview-place">
              <MapPin size={16} aria-hidden="true" />
              {selectedProjectPin.projectName}
            </p>
            {selectedProjectPin.note && <p>{selectedProjectPin.note}</p>}
            <div className="preview-meta">
              <span>{selectedProjectPin.authorNickname}</span>
              <span>{formatRelativeTime(selectedProjectPin.createdAt)}</span>
            </div>
          </article>
        )}

        {selectedPost && !selectedProjectPin && (
          <MapPostPreview post={selectedPost} onClose={() => setSelectedPost(null)} />
        )}
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
