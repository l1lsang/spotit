import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { FeedPostCard } from '../components/feed/FeedPostCard'
import { readFeedPostsFrom } from '../components/feed/feedPosts'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { getPostById, getVisiblePostPage } from '../services/postService'
import type { Post } from '../types/post'
import '../styles/feed.css'

export function FeedDetailPage() {
  const { postId = '' } = useParams()
  const { currentUser, firebaseReady, loading: authLoading } = useAuth()
  const viewerUid = currentUser?.uid
  return viewerUid
    ? <FeedDetail key={`${viewerUid}:${postId}`} postId={postId} viewerUid={viewerUid} firebaseReady={firebaseReady} />
    : authLoading ? <div className="screen-message">로그인 상태를 확인하는 중입니다.</div>
    // Guests can still open a public record on its own page.
    : <Navigate to={`/posts/${encodeURIComponent(postId)}`} replace />
}

function FeedDetail({ postId, viewerUid, firebaseReady }: { postId: string; viewerUid: string; firebaseReady: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [posts, setPosts] = useState<Post[] | null>(() => readFeedPostsFrom(viewerUid, postId))
  const [error, setError] = useState('')

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [postId])

  useEffect(() => {
    // Opened from the grid: the remembered list already starts at this record.
    if (posts || !firebaseReady) return
    let active = true
    void (async () => {
      try {
        const page = await getVisiblePostPage(viewerUid)
        const index = page.posts.findIndex(post => post.id === postId)
        if (index >= 0) { if (active) setPosts(page.posts.slice(index)); return }
        const post = await getPostById(postId, viewerUid)
        if (!active) return
        if (post) setPosts([post, ...page.posts])
        else setError('기록을 찾을 수 없어요. 삭제되었거나 볼 수 없는 기록일 수 있어요.')
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : '기록을 불러오지 못했어요.')
      }
    })()
    return () => { active = false }
  }, [posts, firebaseReady, postId, viewerUid])

  return (
    <PageContainer className="feed-detail-page" hideHeader>
      <header className="feed-detail-topbar">
        <button className="feed-post-icon-button" type="button" aria-label="피드로 돌아가기"
          onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/feed'))}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h1>피드</h1>
      </header>
      {error ? <div className="empty-text feed-message"><p>{error}</p><Link className="button button-secondary" to="/feed">피드로 가기</Link></div>
        : !posts ? <p className="empty-text feed-message" role="status">기록을 불러오는 중입니다.</p>
        : <div className="feed-detail-list">{posts.map(post => <FeedPostCard key={post.id} post={post} />)}</div>}
    </PageContainer>
  )
}
