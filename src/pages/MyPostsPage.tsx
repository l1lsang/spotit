import { ChevronLeft, MapPin, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { PinAlbumGrid } from '../components/profile/PinAlbumGrid'
import { useAuth } from '../hooks/useAuth'
import { getUserPosts } from '../services/postService'
import type { Post } from '../types/post'
import '../styles/people.css'
import '../styles/myRecords.css'

type RecordKind = 'public' | 'followers' | 'private' | 'group'
type RecordFilter = 'all' | RecordKind

const FILTERS: { id: RecordFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'public', label: '전체 공개' },
  { id: 'followers', label: '팔로워' },
  { id: 'private', label: '나만 보기' },
  { id: 'group', label: '그룹' },
]

// Group pins count as group records whatever visibility the group gave them.
function getRecordKind(post: Pick<Post, 'groupId' | 'visibility'>): RecordKind {
  if (post.groupId || post.visibility === 'group') return 'group'
  return post.visibility
}

export function MyPostsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, firebaseReady } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<RecordFilter>('all')

  const loadPosts = useCallback(async () => {
    if (!firebaseReady || !currentUser) {
      return
    }

    setLoading(true)
    setError('')

    try {
      setPosts(await getUserPosts(currentUser.uid))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '내 기록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentUser, firebaseReady])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  const counts = posts.reduce<Record<RecordFilter, number>>((total, post) => {
    total[getRecordKind(post)] += 1
    return total
  }, { all: posts.length, public: 0, followers: 0, private: 0, group: 0 })
  const visiblePosts = filter === 'all' ? posts : posts.filter((post) => getRecordKind(post) === filter)

  return (
    <PageContainer className="content-page my-records-page">
      <header className="my-records-bar">
        <button className="my-records-back" type="button" aria-label="뒤로 가기"
          onClick={() => (location.key === 'default' ? navigate('/profile') : navigate(-1))}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h1>내 기록</h1>
        {!loading && !error && <span className="my-records-count">기록 {posts.length}개</span>}
      </header>

      {posts.length > 0 && (
        <div className="my-records-filters" role="group" aria-label="공개 범위로 보기">
          {FILTERS.filter(({ id }) => id === 'all' || counts[id] > 0).map(({ id, label }) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}<span>{counts[id]}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="my-records-state" role="alert">
          <p className="form-error">{error}</p>
          <button className="button button-secondary" type="button" onClick={() => void loadPosts()}>
            <RefreshCw size={17} aria-hidden="true" />다시 시도
          </button>
        </div>
      )}
      {loading && <p className="my-records-state" role="status">내 기록을 불러오는 중이에요.</p>}

      {!loading && !error && posts.length === 0 && (
        <div className="my-records-state">
          <MapPin size={28} aria-hidden="true" />
          <p>아직 남긴 기록이 없어요.</p>
          <Link className="button button-primary" to="/map">지도에서 첫 기록 남기기</Link>
        </div>
      )}

      {!loading && visiblePosts.length > 0 && (
        <>
          <div className="my-records-grid">
            <PinAlbumGrid posts={visiblePosts} showVisibility showTitleWithoutPhoto />
          </div>
          <p className="my-records-hint">기록을 누르면 내용을 보고 수정하거나 삭제할 수 있어요.</p>
        </>
      )}
      {!loading && posts.length > 0 && visiblePosts.length === 0 && (
        <p className="my-records-state" role="status">이 공개 범위로 남긴 기록이 없어요.</p>
      )}
    </PageContainer>
  )
}
