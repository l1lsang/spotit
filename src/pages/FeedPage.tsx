import { LocateFixed, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { PostCard } from '../components/post/PostCard'
import { useAuth } from '../hooks/useAuth'
import { SEOUL_CITY_HALL, useCurrentLocation } from '../hooks/useCurrentLocation'
import type { LatLng } from '../lib/kakaoMap'
import { getNearbyVisiblePosts } from '../services/postService'
import type { Post } from '../types/post'

export function FeedPage() {
  const { currentUser, firebaseReady } = useAuth()
  const { loading: locationLoading, error: locationError, requestLocation } = useCurrentLocation()
  const [center, setCenter] = useState<LatLng>(SEOUL_CITY_HALL)
  const [radiusKm, setRadiusKm] = useState(10)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadPosts = useCallback(async () => {
    if (!firebaseReady || !currentUser) {
      setPosts([])
      return
    }

    setLoading(true)
    setError('')

    try {
      setPosts(await getNearbyVisiblePosts(currentUser.uid, center, radiusKm))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '피드를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [center, currentUser, firebaseReady, radiusKm])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  async function handleUseCurrentLocation() {
    const nextLocation = await requestLocation()
    setCenter(nextLocation)
  }

  return (
    <PageContainer className="content-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Recent daymarks</p>
          <h1>피드</h1>
          <p>내 위치 근처의 내 기록과 팔로우한 사람들의 기록만 모아봅니다.</p>
        </div>
        <div className="feed-controls">
          <label>
            <span>반경</span>
            <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
              <option value={3}>3km</option>
              <option value={10}>10km</option>
              <option value={30}>30km</option>
            </select>
          </label>
          <button className="button button-secondary" type="button" onClick={handleUseCurrentLocation}>
            <LocateFixed size={17} aria-hidden="true" />
            {locationLoading ? '확인 중' : '현재 위치'}
          </button>
          <button className="button button-secondary" type="button" onClick={() => void loadPosts()}>
            <RefreshCw size={17} aria-hidden="true" />
            새로고침
          </button>
        </div>
      </section>

      {(error || locationError) && <p className="form-error">{error || locationError}</p>}
      {!currentUser && <p className="empty-text">로그인하면 팔로우한 사람들의 인근 기록을 볼 수 있습니다.</p>}
      {loading && <p className="empty-text">기록을 불러오는 중입니다.</p>}

      {!loading && posts.length === 0 ? (
        <p className="empty-text">아직 볼 수 있는 기록이 없습니다.</p>
      ) : (
        <div className="post-grid">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} showVisibility={post.uid === currentUser?.uid} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
