import { LocateFixed, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { KakaoMapView } from '../components/map/KakaoMapView'
import { MapPostPreview } from '../components/map/MapPostPreview'
import { PostFormModal, type PostFormSubmitPayload } from '../components/post/PostFormModal'
import { useAuth } from '../hooks/useAuth'
import { SEOUL_CITY_HALL, useCurrentLocation } from '../hooks/useCurrentLocation'
import type { LatLng } from '../lib/kakaoMap'
import { createPost, getVisiblePosts } from '../services/postService'
import type { Post, PostFormInput } from '../types/post'

export function MapPage() {
  const navigate = useNavigate()
  const { currentUser, profile, firebaseReady } = useAuth()
  const { loading: locationLoading, error: locationError, requestLocation } = useCurrentLocation()
  const [center, setCenter] = useState<LatLng>(SEOUL_CITY_HALL)
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)
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

  async function handleUseCurrentLocation() {
    const nextLocation = await requestLocation()
    setCenter(nextLocation)
  }

  function handleMapClick(location: LatLng) {
    setSelectedLocation(location)
    setSelectedPost(null)
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
        <KakaoMapView
          center={center}
          posts={posts}
          selectedLocation={selectedLocation}
          onMapClick={handleMapClick}
          onMarkerClick={setSelectedPost}
        />

        <div className="map-toolbar">
          <button className="button button-secondary" type="button" onClick={handleUseCurrentLocation}>
            <LocateFixed size={18} aria-hidden="true" />
            {locationLoading ? '확인 중' : '현재 위치'}
          </button>
          <span>{loadingPosts ? '기록 불러오는 중' : `${posts.length}개의 기록`}</span>
        </div>

        {(locationError || error) && <p className="map-error">{locationError || error}</p>}

        {selectedLocation && !isFormOpen && (
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
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreatePost}
      />
    </PageContainer>
  )
}
