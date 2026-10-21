import { Compass, LocateFixed, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { MapControlButton, MapPinLegend } from '../components/map/MapControls'
import { getMapScopeGroups } from '../components/map/mapHelpers'
import { MapView } from '../components/map/MapView'
import { MapPlacePanel, type SelectedMapPlace } from '../components/map/MapPlacePanel'
import { MapPlaceSearch, MapSelectedPlaceField } from '../components/map/MapPlaceSearch'
import { MapPinList } from '../components/map/MapPinList'
import { MapPostPreview } from '../components/map/MapPostPreview'
import { MapScopeChip, MapScopeSheet } from '../components/map/MapScopeSheet'
import { PhotoCenterPin, PhotoRecordLauncher, PhotoRecordSheet, PhotoRecordTopBar } from '../components/map/PhotoRecordFlow'
import { PostFormModal, type PostFormSubmitPayload } from '../components/post/PostFormModal'
import { useAuth } from '../hooks/useAuth'
import { useGroups } from '../hooks/useGroups'
import { usePhotoRecordFlow, type PhotoRecordPrefill } from '../hooks/usePhotoRecordFlow'
import { getGroupMapUrl } from '../lib/groupNavigation'
import { SEOUL_CITY_HALL, useCurrentLocation } from '../hooks/useCurrentLocation'
import type { LatLng, PlaceSearchResult } from '../lib/mapLocation'
import { createPost, getVisiblePosts, subscribeGroupPosts } from '../services/postService'
import { getPostMarkerColor, type Post, type PostFormInput } from '../types/post'
import '../styles/mapGroups.css'
import '../styles/mapControls.css'

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

// On phones the map shrinks above a bottom sheet so its pin stays in the visible center.
function useSheetHeightVariable(shellRef: RefObject<HTMLElement | null>, sheetRef: RefObject<HTMLElement | null>, active: boolean, name: string) {
  useEffect(() => {
    const sheet = sheetRef.current
    const shell = shellRef.current
    if (!active || !sheet || !shell) return
    const measure = () => shell.style.setProperty(name, `${Math.ceil(sheet.getBoundingClientRect().height)}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(sheet)
    return () => {
      observer.disconnect()
      shell.style.removeProperty(name)
    }
  }, [active, name, shellRef, sheetRef])
}

function focusLater(ref: RefObject<HTMLElement | null>) {
  window.requestAnimationFrame(() => ref.current?.focus())
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
  const mapShellRef = useRef<HTMLDivElement>(null)
  const searchControlRef = useRef<HTMLButtonElement>(null)
  const groupControlRef = useRef<HTMLButtonElement>(null)
  const selectedFieldRef = useRef<HTMLButtonElement>(null)
  const placeSheetRef = useRef<HTMLElement>(null)
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
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [postsRevision, setPostsRevision] = useState(0)
  const [placeQuery, setPlaceQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchCenter, setSearchCenter] = useState<LatLng>(SEOUL_CITY_HALL)
  const [groupSheetOpen, setGroupSheetOpen] = useState(false)
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
  const placeSheetOpen = Boolean(selectedPlace) && !photoFlow && !isFormOpen && !searchOpen
  const recordPromptOpen = Boolean(selectedLocation && !selectedPlace && !isFormOpen && currentUser && canCreatePin)
  const pinListOpen = visibleClusterPosts.length > 1 && !visibleSelectedPost
  // Floating controls step aside while a panel or flow owns the bottom of the map.
  const myPinColors = [...new Set(visiblePosts.filter(post => post.uid === currentUser?.uid)
    .map(post => getPostMarkerColor(post, currentUser?.uid, profile?.pinThemes)))]
  const controlsVisible = !photoFlow && !isFormOpen && !selectedPlace && !recordPromptOpen && !pinListOpen && !visibleSelectedPost
  const showLauncher = controlsVisible && Boolean(currentUser && firebaseReady && canCreatePin && initialLocationReady)
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

  useSheetHeightVariable(mapShellRef, photoSheetRef, photoSheetOpen, '--photo-sheet-height')
  useSheetHeightVariable(mapShellRef, placeSheetRef, placeSheetOpen, '--place-sheet-height')

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

  function openSearch() {
    setSearchCenter(mapCenterRef.current)
    setSearchOpen(true)
  }

  function closeSearch() {
    setSearchOpen(false)
    focusLater(selectedPlace ? selectedFieldRef : searchControlRef)
  }

  function handleSelectPlace(place: PlaceSearchResult, query: string) {
    const location = place.location
    setClusterPosts([])
    focusMap(location)
    setSelectedLocation(location)
    setSelectedPlace({
      placeId: place.id,
      placeName: place.name,
      address: place.address,
      location,
    })
    setSelectedPost(null)
    setPlaceQuery(query)
    setSearchOpen(false)
    focusLater(selectedFieldRef)
  }

  function handleClearSelectedPlace() {
    setSelectedPlace(null)
    setSelectedLocation(null)
    setPlaceQuery('')
    focusLater(searchControlRef)
  }

  function closeGroupSheet() {
    setGroupSheetOpen(false)
    focusLater(groupControlRef)
  }

  function handleSelectScope(nextGroupId: string) {
    setGroupSheetOpen(false)
    if (nextGroupId !== groupId) navigate(getGroupMapUrl(nextGroupId))
    else focusLater(groupControlRef)
  }

  function handleStartPhotoRecord(files: File[]) {
    setSelectedPlace(null)
    setSelectedLocation(null)
    setSelectedPost(null)
    setClusterPosts([])
    setGroupSheetOpen(false)
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
      <div ref={mapShellRef} className={`map-shell${photoFlow ? ' is-photo-flow' : ''}${placeSheetOpen ? ' has-place-sheet' : ''}`}
        aria-busy={loadingPosts || Boolean(groupId && groupState.loading)}>
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

        {!photoFlow && (
          <div className="map-status-stack">
            {groupId && (selectedGroup || groupState.loading) && (
              <MapScopeChip group={selectedGroup} loading={groupState.loading}
                canJoin={Boolean(currentUser && selectedGroup && !joined && !groupState.loading && !groupState.error)} />
            )}
            {currentUser && controlsVisible && <MapPinLegend mineColors={myPinColors} othersLabel={groupId ? '그룹 멤버' : '팔로잉'} />}
            {groupState.error && <p className="map-status-message is-error" role="alert">{groupState.error} <button type="button" onClick={groupState.retry}>다시 시도</button>{groupId && <Link to="/map">내 지도로</Link>}</p>}
            {groupId && currentUser && !groupState.loading && !groupState.error && !selectedGroup && <p className="map-status-message" role="alert">그룹을 찾을 수 없습니다. <Link to="/groups">그룹 둘러보기</Link><Link to="/map">내 지도로</Link></p>}
            {(locationError || error) && <p className="map-status-message is-error" role="alert">{locationError || error}{error && groupId && <button type="button" onClick={() => setPostsRevision(value => value + 1)}>다시 시도</button>}</p>}
          </div>
        )}

        {selectedPlace && !photoFlow && !isFormOpen && (
          <MapSelectedPlaceField name={selectedPlace.placeName} backRef={selectedFieldRef}
            onBack={openSearch} onClear={handleClearSelectedPlace} />
        )}

        {selectedPlace && !photoFlow && <MapPlacePanel key={selectedPlace.placeId} place={selectedPlace}
          groupId={groupId} canCreatePin={canCreatePin} sheetRef={placeSheetRef}
          hidden={isFormOpen || searchOpen}
          onCreatePin={() => setIsFormOpen(true)} onClose={handleDismissLocation} />}

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

        {recordPromptOpen && (
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

        {pinListOpen && <MapPinList posts={visibleClusterPosts} onSelect={handleSelectPost} onClose={() => setClusterPosts([])} />}
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

        {controlsVisible && (
          <>
            <MapControlButton icon={Search} label="검색" ariaLabel="장소 검색" className="map-search-control"
              buttonRef={searchControlRef} hasPopup="dialog" expanded={searchOpen} onClick={openSearch} />
            <div className={`map-control-rail${showLauncher ? ' above-fab' : ''}`} role="group" aria-label="지도 도구">
              {currentUser && (
                <MapControlButton icon={Compass} label="그룹" ariaLabel="지도에 표시할 그룹 선택" buttonRef={groupControlRef}
                  hasPopup="dialog" expanded={groupSheetOpen} onClick={() => setGroupSheetOpen(true)} />
              )}
              <MapControlButton icon={LocateFixed} label="내 위치" ariaLabel={locationLoading ? '현재 위치 확인 중' : '현재 위치로 이동'}
                busy={locationLoading} disabled={locationLoading} onClick={() => void handleUseCurrentLocation()} />
            </div>
          </>
        )}

        {showLauncher && (
          <PhotoRecordLauncher
            error={photoRecord.error}
            hideTip={groupSheetOpen}
            onSelect={handleStartPhotoRecord}
          />
        )}

        {groupSheetOpen && currentUser && controlsVisible && (
          <MapScopeSheet
            groups={getMapScopeGroups(groupState.groups, groupState.joinedIds, groupId)}
            currentGroupId={groupId}
            loading={groupState.loading}
            error={groupState.error}
            aboveFab={showLauncher}
            onRetry={groupState.retry}
            onSelect={handleSelectScope}
            onClose={closeGroupSheet}
          />
        )}
      </div>

      {searchOpen && (
        <MapPlaceSearch initialQuery={placeQuery} center={searchCenter}
          onClose={closeSearch} onSelect={handleSelectPlace} />
      )}

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
