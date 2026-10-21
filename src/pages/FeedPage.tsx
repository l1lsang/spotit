import { ArrowRight, ChevronDown, LocateFixed, MapPin, RefreshCw, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getFeedDetailHref, getFeedTone, rememberFeedPosts } from '../components/feed/feedPosts'
import { PageContainer } from '../components/layout/PageContainer'
import { PinAlbumGrid } from '../components/profile/PinAlbumGrid'
import { useAuth } from '../hooks/useAuth'
import { SEOUL_CITY_HALL, useCurrentLocation } from '../hooks/useCurrentLocation'
import { useSearchKeyword } from '../hooks/useSearchKeyword'
import type { LatLng } from '../lib/mapLocation'
import { filterFeedPosts } from '../lib/feedSearch'
import { filterNearbyPosts, getVisiblePostPage, type PostPageCursor } from '../services/postService'
import { invalidateAppReads } from '../lib/readCache'
import type { Post } from '../types/post'
import '../styles/feed.css'

const RADIUS_OPTIONS = [3, 10, 30]

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

  // The detail feed continues from the tapped tile in this exact order.
  useEffect(() => {
    if (viewerUid) rememberFeedPosts(viewerUid, filteredPosts)
  }, [viewerUid, filteredPosts])

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
    <PageContainer className="content-page feed-page feed-grid-page">
      <h1 className="sr-only">피드</h1>

      {currentUser && <section className="feed-toolbar" aria-label="피드 검색과 반경">
        <div className="feed-search-field" role="search">
          <Search size={18} aria-hidden="true" />
          <input type="search" {...inputProps}
            placeholder="제목, 장소, 내용, 작성자 검색" aria-label="피드 검색" />
          {inputValue && <button className="feed-search-clear" type="button" onClick={clearKeyword} aria-label="검색어 지우기"><X size={14} aria-hidden="true" /></button>}
        </div>
        <div className="feed-filter-row">
          <label className="feed-radius-chip">
            <MapPin size={14} aria-hidden="true" />
            <span className="sr-only">피드 반경</span>
            <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
              {RADIUS_OPTIONS.map(radius => <option key={radius} value={radius}>내 주변 {radius}km</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
          <button className="feed-icon-button" type="button" onClick={handleUseCurrentLocation}
            disabled={locationLoading} aria-label={locationLoading ? '현재 위치 확인 중' : '현재 위치로 이동'} aria-busy={locationLoading} title="현재 위치">
            <LocateFixed size={17} aria-hidden="true" />
          </button>
          <button className="feed-icon-button" type="button" disabled={loading} onClick={() => { invalidateAppReads(); setRevision(value => value + 1) }}
            aria-label={loading ? '피드 새로고침 중' : '피드 새로고침'} aria-busy={loading} title="새로고침">
            <RefreshCw size={17} aria-hidden="true" />
          </button>
          <p className="feed-count" role="status">{waitingForLocation || loading ? '주변 기록을 확인하고 있어요.'
            : `${keyword.trim() ? '검색 결과' : '기록'} ${filteredPosts.length}개`}</p>
        </div>
      </section>}

      {(error || locationError) && <p className="form-error feed-message">{error || locationError}</p>}
      {!currentUser && <div className="empty-state feed-welcome">
        <MapPin size={32} aria-hidden="true" />
        <h2>어떤 하루를 보내고 있나요?</h2>
        <p>로그인하면 내 기록과 팔로우한 사람들의<br />가까운 장소 이야기를 모아볼 수 있어요.</p>
        <Link className="button button-primary" to="/login" state={{ from: '/feed' }}>로그인하고 둘러보기 <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>}
      {waitingForLocation && <p className="empty-text feed-message">현재 위치를 확인하는 중입니다.</p>}
      {loading && <p className="empty-text feed-message">기록을 불러오는 중입니다.</p>}

      {currentUser && !waitingForLocation && !loading && (!error || posts.length > 0) && (
        filteredPosts.length === 0 ? (
          <div className="empty-text feed-search-empty"><p>{nextCursor ? '불러온 최근 기록에는 일치하는 장소가 없습니다. 이전 기록도 확인해 보세요.' : keyword.trim() ? '검색어와 일치하는 기록이 없습니다.' : '아직 볼 수 있는 기록이 없습니다.'}</p>
            {keyword.trim() && <button className="button button-secondary" type="button" onClick={clearKeyword}>검색 초기화</button>}
          </div>
        ) : (
          <section aria-label="피드 기록 목록">
            <PinAlbumGrid posts={filteredPosts} className="feed-grid" getHref={getFeedDetailHref}
              getLabel={post => `${post.title} · ${post.placeName} 기록 보기`} getTileClassName={getFeedTone} showTitleWithoutPhoto />
          </section>
        )
      )}
      {currentUser && !loading && nextCursor && <button className="button button-secondary feed-more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>
        {loadingMore ? '기록을 불러오는 중…' : '이전 기록 더 보기'}
      </button>}
    </PageContainer>
  )
}
