import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { PostCard } from '../components/post/PostCard'
import { useAuth } from '../hooks/useAuth'
import { getVisiblePosts } from '../services/postService'
import type { Post } from '../types/post'

export function FeedPage() {
  const { currentUser, firebaseReady } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadPosts = useCallback(async () => {
    if (!firebaseReady) {
      setPosts([])
      return
    }

    setLoading(true)
    setError('')

    try {
      setPosts(await getVisiblePosts(currentUser?.uid))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '피드를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentUser?.uid, firebaseReady])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  return (
    <PageContainer className="content-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Recent daymarks</p>
          <h1>피드</h1>
          <p>공개 기록과 내 비공개 기록을 최신순으로 모아봅니다.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void loadPosts()}>
          <RefreshCw size={17} aria-hidden="true" />
          새로고침
        </button>
      </section>

      {error && <p className="form-error">{error}</p>}
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
