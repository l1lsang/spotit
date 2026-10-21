import { Compass, LocateFixed, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GroupJoinButton } from '../components/group/GroupJoinButton'
import { PageContainer } from '../components/layout/PageContainer'
import { MapView } from '../components/map/MapView'
import { MapPlacePanel, type SelectedMapPlace } from '../components/map/MapPlacePanel'
import { MapPinList } from '../components/map/MapPinList'
import { MapPostPreview } from '../components/map/MapPostPreview'
import { PhotoCenterPin, PhotoRecordLauncher, PhotoRecordSheet, PhotoRecordTopBar } from '../components/map/PhotoRecordFlow'
import { PostFormModal, type PostFormSubmitPayload } from '../components/post/PostFormModal'
import { useAuth } from '../hooks/useAuth'
import { useGroups } from '../hooks/useGroups'
import { usePhotoRecordFlow, type PhotoRecordPrefill } from '../hooks/usePhotoRecordFlow'
import { getGroupMapUrl } from '../lib/groupNavigation'
import { SEOUL_CITY_HALL, useCurrentLocation } from '../hooks/useCurrentLocation'
import type { LatLng, PlaceSearchResult } from '../lib/mapLocation'
import { searchPlaces } from '../lib/placeSearch'
import { createPost, getVisiblePosts, subscribeGroupPosts } from '../services/postService'
import {
  DEFAULT_POST_PIN_COLOR,
  FOLLOWING_PIN_COLOR,
  type Post,
  type PostFormInput,
} from '../types/post'
import '../styles/mapGroups.css'

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
  const selectedGroupVisibility = selectedGroup?.visibility
  const joined = groupState.joinedIds.includes(groupId)
  const canCreatePin = !groupId || Boolean(selectedGroup && joined && !groupState.loading && !groupState.error)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const mapShellRef = useRef<HTMLDivElement>(null)
  const { location: currentLocation, loading: locationLoading, error: locationError, requestLocation } = useCurrentLocation()
  const [center, setCenter] = useState<LatLng>(SEOUL_CITY_HALL)
  const [centerRevision, setCenterRevision] = useState(0)
  const mapCenterRef = useRef<LatLng>(SEOUL_CITY_HALL)
  const photoSheetRef = useRef<HTMLElement>(null)
  const [photoPrefill, setPhotoPrefill] = useState<PhotoRecordPrefill | null>(null)
  const [initialLocationReady, setInitialLocationReady] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<SelectedMapPlace | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [clusterPosts, setClusterPosts] = useState<Post[]>([])
  const searchRequestRef = useRef(0)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [postsRevision, setPostsRevision] = useState(0)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([])
  const [searchingPlaces, setSearchingPlaces] = useState(false)
  const [placeSearchMessage, setPlaceSearchMessage] = useState('')
  const [error, setError] = useState('')
  const visiblePosts = (!groupId || (selectedGroup && (selectedGroupVisibility !== 'private' || joined))) ? posts : []
  const visibleSelectedPost = visiblePosts.find(post => post.id === selectedPost?.id)
  const visibleClusterPosts = clusterPosts.filter(post => visiblePosts.some(item => item.id === post.id))
  const focusMap = useCallback((location: LatLng) => {
    setCenter(location)
    setCenterRevision(value => value + 1)
  }, [])
  const photoRecord = usePhotoRecordFlow(focusMap)
  const photoFlow = photoRecord.flow
  const photoSheetOpen = Boolean(photoFlow) && !isFormOpen
  const photoPinLocation = photoFlow
    ? (isFormOpen ? photoPrefill?.location : photoFlow.step === 'confirm' ? photoFlow.summary?.location : null) ?? null
    : null
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
    setPosts([])
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
    }, () => { setPosts([]); setError('그룹 핀을 불러오지 못했습니다.'); setLoadingPosts(false) }, selectedGroupVisibility)
  }, [currentUser, firebaseReady, groupId, selectedGroupId, selectedGroupVisibility, postsRevision])

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

  // On phones the map shrinks above the sheet so the pin stays in the visible center.
  useEffect(() => {
    const sheet = photoSheetRef.current
    const shell = mapShellRef.current
    if (!photoSheetOpen || !sheet || !shell) return
    const measure = () => shell.style.setProperty('--photo-sheet-height', `${Math.ceil(sheet.getBoundingClientRect().height)}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(sheet)
    return () => {
      observer.disconnect()
      shell.style.removeProperty('--photo-sheet-height')
    }
  }, [photoSheetOpen])

  useEffect(() => {
    let active = true

    // Group maps can load their pins while the device location is being checked.
    if (groupId) setInitialLocationReady(true)

    async function centerOnCurrentLocation() {
      const nextLocation = await requestLocation(false)

      if (!active) {
        return
      }

      // Keep the group map centered on its pins when the device location arrives.
      if (!groupId) setCenter(nextLocation)
      setInitialLocationReady(true)
    }

    void centerOnCurrentLocation()

    return () => {
      active = false
    }
  }, [requestLocation, groupId])

  async function handleUseCurrentLocation() {
    const nextLocation = await requestLocation()
    setSelectedPost(null)
    setClusterPosts([])
    setSelectedLocation(null)
    setSelectedPlace(null)
    setCenter(nextLocation)
    setInitialLocationReady(true)
  }

  function handleMapClick(location: LatLng) {
    setSelectedLocation(location)
    setSelectedPlace(null)
    setSelectedPost(null)
    setClusterPosts([])
  }

  function handleDismissLocation() {
    setSelectedLocation(null)
    setSelectedPlace(null)
  }

  function handleSelectPost(post: Post) {
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
      const results = await searchPlaces(placeQuery, center)
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
    searchRequestRef.current += 1
    setSearchingPlaces(false)
    const location = place.location
    setClusterPosts([])

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

  function handleStartPhotoRecord(files: File[]) {
    handleClearSearch()
    setSelectedPost(null)
    setClusterPosts([])
    void photoRecord.start(files)
  }

  function closePhotoRecord() {
    photoRecord.close()
    setPhotoPrefill(null)
  }

  function openPhotoForm(location: LatLng, source: PhotoRecordPrefill['source']) {
    const prefill = photoRecord.buildPrefill(location, source)
    if (!prefill) return
    setPhotoPrefill(prefill)
    setIsFormOpen(true)
  }

  function handlePhotoBack() {
    if (photoFlow?.step === 'locate' && photoFlow.locateReason === 'adjust') photoRecord.returnToPhotoLocation()
    else closePhotoRecord()
  }

  async function handlePhotoUseCurrentLocation() {
    focusMap(await requestLocation())
  }

  function handleChangePhotoLocation() {
    if (!photoPrefill) return
    setIsFormOpen(false)
    photoRecord.locate(photoPrefill.source === 'photo' ? 'adjust' : 'missing')
    focusMap(photoPrefill.location)
    setPhotoPrefill(null)
  }

  function handleCloseForm() {
    setIsFormOpen(false)
    // A photo record returns to its location sheet with the selected photos kept.
    setPhotoPrefill(null)
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
    if (photoPrefill) {
      closePhotoRecord()
      focusMap({ lat: input.lat, lng: input.lng })
    }
    if (!selectedPlace) setSelectedLocation(null)
    if (input.groupId && input.groupId !== groupId) {
      navigate(getGroupMapUrl(input.groupId))
      return
    }
    await loadPosts()
  }

  return (
    <PageContainer fullBleed fillViewport className="map-page">
      <div ref={mapShellRef} className={`map-shell map-with-groups${photoFlow ? ' is-photo-flow' : ''}`} aria-busy={loadingPosts || Boolean(groupId && groupState.loading)}>
        {initialLocationReady ? (
          <MapView
            center={center}
            centerRevision={centerRevision}
            posts={visiblePosts}
            currentLocation={currentLocation}
            selectedLocation={photoFlow ? photoPinLocation : selectedLocation}
            selectedPhotoUrl={photoPinLocation ? photoFlow?.items[0]?.url : undefined}
            selectedPostId={visibleSelectedPost?.id}
            onMapClick={(location) => {
              if (!photoFlow) handleMapClick(location)
              else if (photoFlow.step === 'locate') focusMap(location)
            }}
            onMarkerClick={(post) => { if (photoFlow) return; setClusterPosts([]); handleSelectPost(post) }}
            onClusterClick={(group) => { if (!photoFlow) handleClusterClick(group) }}
            onCenterIdle={(location) => { mapCenterRef.current = location }}
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
              onChange={(event) => { searchRequestRef.current += 1; setSearchingPlaces(false); setPlaceResults([]); setPlaceSearchMessage(''); setPlaceQuery(event.target.value) }}
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

          {currentUser && <div className="map-scope-controls">
            <select aria-label="지도에 표시할 그룹" value={groupId} disabled={groupState.loading || Boolean(groupState.error)} onChange={event => navigate(getGroupMapUrl(event.target.value))}>
              <option value="">내 지도 · 나와 팔로잉</option>
              {groupState.groups.filter(group => groupState.joinedIds.includes(group.id) || group.id === groupId).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              {groupId && !selectedGroup && <option value={groupId}>{groupState.loading ? '그룹 불러오는 중…' : '그룹을 찾을 수 없습니다'}</option>}
            </select>
            {selectedGroup && <Link className="button button-secondary" to={`/groups/${selectedGroup.id}`}>그룹 홈</Link>}
            {selectedGroup && !joined && !groupState.loading && !groupState.error && <GroupJoinButton groupId={groupId} visibility={selectedGroup.visibility} joined={false} />}
          </div>}

          {groupState.error && <p className="map-group-notice" role="alert">{groupState.error} <button type="button" onClick={groupState.retry}>다시 시도</button>{groupId && <Link to="/map">내 지도로</Link>}</p>}
          {groupId && currentUser && !groupState.loading && !groupState.error && !selectedGroup && <p className="map-group-notice" role="alert">그룹을 찾을 수 없습니다. <Link to="/groups">그룹 둘러보기</Link></p>}

          {currentUser && (
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

        {!photoFlow && (placeResults.length > 0 || placeSearchMessage || searchingPlaces) && (
          <section className="map-place-results" aria-label="장소 검색 결과" aria-busy={searchingPlaces}>
            {searchingPlaces ? <p role="status">검색 중…</p>
              : placeSearchMessage ? <p role="status">{placeSearchMessage}</p>
              : <ul>{placeResults.map(place => <li key={place.id}>
                <button type="button" onClick={() => handleSelectPlace(place)}>
                  <strong>{place.name}</strong><span>{place.address}</span>
                </button>
              </li>)}</ul>}
          </section>
        )}

        {selectedPlace && !photoFlow && <MapPlacePanel key={selectedPlace.placeId} place={selectedPlace}
          groupId={groupId} canCreatePin={canCreatePin}
          hidden={isFormOpen || searchingPlaces || placeResults.length > 0 || Boolean(placeSearchMessage)}
          onCreatePin={() => setIsFormOpen(true)} onClose={handleDismissLocation} />}

        {(locationError || error) && <p className="map-error" role="alert">{locationError || error}{error && groupId && <button type="button" onClick={() => setPostsRevision(value => value + 1)}>다시 시도</button>}</p>}
        {!currentUser && !selectedPlace && (
          <div className="map-floating map-login-prompt">
            <p>
              {groupId ? '로그인하면 그룹 핀과 장소 리뷰를 남길 수 있습니다.' : '장소를 검색하고 핀과 리뷰를 함께 남겨보세요.'}
            </p>
            <button className="button button-primary" type="button" onClick={() => navigate('/login', { state: { from: getGroupMapUrl(groupId) } })}>
              로그인
            </button>
          </div>
        )}

        {selectedLocation && !selectedPlace && !isFormOpen && currentUser && canCreatePin && (
          <div className="map-floating map-record-floating" role="region" aria-label="선택한 위치에 기록하기"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                handleDismissLocation()
              }
            }}>
            <div className="map-record-heading">
              <button className="button-icon ghost map-record-close" type="button"
                onClick={handleDismissLocation} aria-label="선택한 위치 닫기" title="닫기">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={() => (currentUser ? setIsFormOpen(true) : navigate('/login'))}
            >
              <Plus size={18} aria-hidden="true" />
              {groupId ? '이곳에 그룹 핀 남기기' : '이곳에 핀 남기기'}
            </button>
          </div>
        )}

        {visibleClusterPosts.length > 1 && !visibleSelectedPost && <MapPinList posts={visibleClusterPosts} onSelect={handleSelectPost} onClose={() => setClusterPosts([])} />}
        {visibleSelectedPost && <MapPostPreview key={visibleSelectedPost.id} post={visibleSelectedPost}
          onClose={() => { setSelectedPost(null); setClusterPosts([]) }}
          onBack={visibleClusterPosts.length > 1 ? () => setSelectedPost(null) : undefined}
        />}

        {photoSheetOpen && photoFlow && (
          <>
            <PhotoRecordTopBar
              title={photoFlow.step === 'reading' ? '사진 정보 읽기'
                : photoFlow.step === 'confirm' ? '핀 위치 확인'
                : photoFlow.locateReason === 'adjust' ? '핀 위치 조정' : '위치 직접 지정'}
              step="1 / 2"
              backLabel={photoFlow.step === 'locate' && photoFlow.locateReason === 'adjust' ? '사진 위치 확인으로 돌아가기' : '사진으로 기록 닫기'}
              onBack={handlePhotoBack}
            />
            {photoFlow.step === 'locate' && <PhotoCenterPin />}
            <PhotoRecordSheet
              sheetRef={photoSheetRef}
              flow={photoFlow}
              notice={photoRecord.error}
              getSearchCenter={() => mapCenterRef.current}
              locating={locationLoading}
              onBack={handlePhotoBack}
              onConfirm={() => { if (photoFlow.summary?.location) openPhotoForm(photoFlow.summary.location, 'photo') }}
              onAdjust={() => photoRecord.locate('adjust')}
              onReturnToPhotoLocation={photoRecord.returnToPhotoLocation}
              onPlaceHere={() => openPhotoForm(mapCenterRef.current, 'manual')}
              onUseCurrentLocation={() => void handlePhotoUseCurrentLocation()}
              onSelectPlace={photoRecord.selectSearchedPlace}
            />
          </>
        )}

        {currentUser && firebaseReady && canCreatePin && initialLocationReady && !photoFlow && !isFormOpen && (
          <PhotoRecordLauncher
            error={photoRecord.error}
            hideTip={Boolean(selectedPlace || selectedLocation || visibleSelectedPost || visibleClusterPosts.length > 1
              || placeResults.length || searchingPlaces || placeSearchMessage)}
            onSelect={handleStartPhotoRecord}
          />
        )}

        {!photoFlow && <div className="map-bottom-controls" role="group" aria-label="지도 도구">
          <button className={`map-control-icon${locationLoading ? ' is-locating' : ''}`} type="button" onClick={handleUseCurrentLocation} disabled={locationLoading}
            aria-label={locationLoading ? '현재 위치 확인 중' : '현재 위치로 이동'} aria-busy={locationLoading} title="현재 위치로 이동">
            <LocateFixed size={21} aria-hidden="true" />
          </button>
        </div>}
      </div>

      <PostFormModal
        isOpen={isFormOpen && canCreatePin}
        mode="create"
        location={photoPrefill ? photoPrefill.location : selectedLocation}
        placePrefill={photoPrefill ? null : selectedPlace}
        photoPrefill={photoPrefill}
        initialGroupId={groupId}
        lockGroup={Boolean(groupId)}
        onClose={handleCloseForm}
        onChangeLocation={photoPrefill ? handleChangePhotoLocation : undefined}
        onSubmit={handleCreatePost}
      />
    </PageContainer>
  )
}
