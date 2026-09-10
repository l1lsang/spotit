import { ArrowLeft, Heart, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { PostCard } from '../components/post/PostCard'
import { useAuth } from '../hooks/useAuth'
import { subscribeToLikedPosts } from '../services/postService'
import type { Post } from '../types/post'

export function LikedPostsPage() {
  const { currentUser } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const uid = currentUser?.uid

  useEffect(() => {
    setPosts([]); setLoading(true); setError('')
    if (!uid) { setLoading(false); return }
    return subscribeToLikedPosts(uid, next => { setPosts(next); setLoading(false) }, () => {
      setPosts([]); setLoading(false); setError('좋아요한 핀을 불러오지 못했습니다. 다시 시도해 주세요.')
    })
  }, [uid, revision])

  return <PageContainer className="content-page liked-posts-page">
    <Link className="liked-posts-back" to="/profile"><ArrowLeft size={17} aria-hidden="true" />내 활동으로</Link>
    <section className="page-heading">
      <div><p className="eyebrow">내 활동</p><h1>좋아요</h1><p>좋아요를 누른 핀을 최근 순으로 모았어요.</p></div>
      <button className="button-icon subtle" type="button" disabled={loading} onClick={() => setRevision(value => value + 1)} aria-label="좋아요한 핀 새로고침">
        <RefreshCw size={18} aria-hidden="true" />
      </button>
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && <p className="empty-text" role="status">좋아요한 핀을 불러오는 중입니다.</p>}
    {!loading && !error && (posts.length ? <>
      <p className="liked-posts-count" role="status">좋아요한 핀 {posts.length}개</p>
      <div className="post-grid">{posts.map(post => <PostCard key={post.id} post={post} showVisibility={post.uid === uid} />)}</div>
    </> : <div className="empty-state">
      <Heart size={28} aria-hidden="true" /><h2>아직 좋아요한 핀이 없습니다.</h2>
      <p>피드나 지도에서 마음에 드는 핀에 좋아요를 눌러보세요.</p>
      <Link className="button button-primary" to="/feed">피드 둘러보기</Link>
    </div>)}
  </PageContainer>
}
