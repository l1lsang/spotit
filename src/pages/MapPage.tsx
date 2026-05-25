import { LocateFixed, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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
import { createPost, getVisiblePosts } from '../services/postService'
import type { Post, PostFormInput } from '../types/post'

interface SelectedPlacePrefill {
  placeName: string
  address: string
  location: LatLng
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
      setError(loadError instanceof Error ? loadError.message : '기록을 불러오지 못했습니다.')
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

  async function handleUseCurrentLocation() {
    const nextLocation = await requestLocation()
    setCenter(nextLocation)
    setInitialLocationReady(true)
  }

  function handleMapClick(location: LatLng) {
    setSelectedLocation(location)
    setSelectedPlace(null)
    setSelectedPost(null)
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
      setPlaceSearchMessage(
        searchError instanceof Error ? searchError.message : '장소 검색에 실패했습니다.',
      )
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
      placeName: place.place_name,
      address: place.road_address_name || place.address_name,
      location,
    })
    setSelectedPost(null)
    setPlaceQuery(place.place_name)
    setPlaceResults([])
    setPlaceSearchMessage('')
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
                onClick={() => {
                  setPlaceQuery('')
                  setPlaceResults([])
                  setPlaceSearchMessage('')
                }}
                aria-label="검색어 지우기"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
            <button className="button-icon map-search-submit" type="submit" aria-label="검색">
              <Search size={17} aria-hidden="true" />
            </button>
          </form>
          <button className="button button-secondary" type="button" onClick={handleUseCurrentLocation}>
            <LocateFixed size={18} aria-hidden="true" />
            {locationLoading ? '확인 중' : '현재 위치'}
          </button>
          <span>{loadingPosts ? '기록 불러오는 중' : `팔로우 기반 ${posts.length}개의 기록`}</span>
          {currentUser && (
            <span className="map-legend">
              <i className="mine" />
              내 기록
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
                <button key={place.id} type="button" onClick={() => handleSelectPlace(place)}>
                  <strong>{place.place_name}</strong>
                  <span>{place.road_address_name || place.address_name}</span>
                  {place.distance && <small>{Number(place.distance).toLocaleString()}m</small>}
                </button>
              ))
            )}
          </div>
        )}

        {(locationError || error) && <p className="map-error">{locationError || error}</p>}
        {!currentUser && (
          <div className="map-floating map-login-prompt">
            <p>로그인하면 팔로우한 사람들의 핀 위치가 지도에 표시됩니다.</p>
            <button className="button button-primary" type="button" onClick={() => navigate('/login')}>
              로그인
            </button>
          </div>
        )}

        {selectedLocation && !isFormOpen && currentUser && (
          <div className="map-floating">
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

        {selectedPost && (
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
