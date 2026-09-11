import { LocateFixed, RefreshCw, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { PostCard } from '../components/post/PostCard'
import { useAuth } from '../hooks/useAuth'
import { SEOUL_CITY_HALL, useCurrentLocation } from '../hooks/useCurrentLocation'
import { useSearchKeyword } from '../hooks/useSearchKeyword'
import type { LatLng } from '../lib/kakaoMap'
import { filterFeedPosts } from '../lib/feedSearch'
import { filterNearbyPosts, getVisiblePostPage, type PostPageCursor } from '../services/postService'
import { invalidateAppReads } from '../lib/readCache'
import type { Post } from '../types/post'

export function FeedPage() {
  const { currentUser, firebaseReady } = useAuth()
  const { loading: locationLoading, error: locationError, requestLocation } = useCurrentLocation()
  const [center, setCenter] = useState<LatLng>(SEOUL_CITY_HALL)
  const [initialLocationReady, setInitialLocationReady] = useState(false)
  const [radiusKm, setRadiusKm] = useState(10)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [nextCursor, setNextCursor] = useState<PostPageCursor | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestVersion = useRef(0)
  const morePending = useRef(false)
  const { keyword, inputValue, inputProps, clearKeyword } = useSearchKeyword()
  const viewerUid = currentUser?.uid
  const filteredPosts = useMemo(() => filterFeedPosts(filterNearbyPosts(posts, center, radiusKm), keyword), [posts, center, radiusKm, keyword])

  useEffect(() => {
    const version = ++requestVersion.current
    morePending.current = false
    setLoadingMore(false)
    setNextCursor(null)
    if (!firebaseReady || !viewerUid) {
      setPosts([])
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    void getVisiblePostPage(viewerUid).then(page => {
      if (active && version === requestVersion.current) { setPosts(page.posts); setNextCursor(page.nextCursor) }
    }).catch(loadError => {
      if (active) setError(loadError instanceof Error ? loadError.message : '피드를 불러오지 못했습니다.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; requestVersion.current += 1 }
  }, [viewerUid, firebaseReady, revision])

  async function loadMore() {
    if (!viewerUid || !nextCursor || morePending.current) return
    const version = requestVersion.current
    morePending.current = true
    setLoadingMore(true)
    setError('')
    try {
      const page = await getVisiblePostPage(viewerUid, nextCursor)
      if (version !== requestVersion.current) return
      setPosts(previous => [...new Map([...previous, ...page.posts].map(post => [post.id, post])).values()])
      setNextCursor(page.nextCursor)
    } catch {
      if (version === requestVersion.current) setError('이전 기록을 불러오지 못했습니다. 다시 시도해 주세요.')
    } finally {
      if (version === requestVersion.current) { morePending.current = false; setLoadingMore(false) }
    }
  }

  useEffect(() => {
    let active = true

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
  }, [requestLocation])

  async function handleUseCurrentLocation() {
    const nextLocation = await requestLocation()
    setCenter(nextLocation)
    setInitialLocationReady(true)
  }

  const waitingForLocation = !initialLocationReady || locationLoading

  return (
    <PageContainer className="content-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Recent daymarks</p>
          <h1>피드</h1>
          <p>내 위치 근처의 내 기록과 팔로우한 사람들의 기록만 모아봅니다.</p>
        </div>
        <div className="feed-controls" role="group" aria-label="피드 위치와 반경 설정">
          <label>
            <span>반경</span>
            <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
              <option value={3}>3km</option>
              <option value={10}>10km</option>
              <option value={30}>30km</option>
            </select>
          </label>
          <button className="button-icon feed-control-button" type="button" onClick={handleUseCurrentLocation}
            disabled={locationLoading} aria-label={locationLoading ? '현재 위치 확인 중' : '현재 위치로 이동'} aria-busy={locationLoading} title="현재 위치">
            <LocateFixed size={16} aria-hidden="true" />
          </button>
          <button className="button-icon feed-control-button" type="button" disabled={loading} onClick={() => { invalidateAppReads(); setRevision(value => value + 1) }}
            aria-label={loading ? '피드 새로고침 중' : '피드 새로고침'} aria-busy={loading} title="새로고침">
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      {currentUser && <section className="feed-search-section" aria-label="피드 검색">
        <div className="people-search feed-search" role="search">
          <Search size={18} aria-hidden="true" />
          <input type="search" {...inputProps}
            placeholder="제목, 장소, 내용, 작성자 검색" aria-label="피드 검색" />
          {inputValue && <button className="button-icon subtle" type="button" onClick={clearKeyword} aria-label="검색어 지우기"><X size={18} aria-hidden="true" /></button>}
        </div>
        <p className="feed-search-summary" role="status">{waitingForLocation || loading ? '주변 기록을 확인하고 있어요.'
          : `불러온 기록 중 반경 ${radiusKm}km 안 ${keyword.trim() ? '검색 결과' : '기록'} ${filteredPosts.length}개`}</p>
      </section>}

      {(error || locationError) && <p className="form-error">{error || locationError}</p>}
      {!currentUser && <p className="empty-text">로그인하면 팔로우한 사람들의 인근 기록을 볼 수 있습니다.</p>}
      {waitingForLocation && <p className="empty-text">현재 위치를 확인하는 중입니다.</p>}
      {loading && <p className="empty-text">기록을 불러오는 중입니다.</p>}

      {currentUser && !waitingForLocation && !loading && (!error || posts.length > 0) && (
        filteredPosts.length === 0 ? (
          <div className="empty-text feed-search-empty"><p>{nextCursor ? '불러온 최근 기록에는 일치하는 장소가 없습니다. 이전 기록도 확인해 보세요.' : keyword.trim() ? '검색어와 일치하는 기록이 없습니다.' : '아직 볼 수 있는 기록이 없습니다.'}</p>
            {keyword.trim() && <button className="button button-secondary" type="button" onClick={clearKeyword}>검색 초기화</button>}
          </div>
        ) : (
          <div className="post-grid">
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} showVisibility={post.uid === currentUser?.uid} />
            ))}
          </div>
        )
      )}
      {currentUser && !loading && nextCursor && <button className="button button-secondary" type="button" disabled={loadingMore} onClick={() => void loadMore()}>
        {loadingMore ? '기록을 불러오는 중…' : '이전 기록 더 보기'}
      </button>}
    </PageContainer>
  )
}
