import { Ellipsis, Heart, MapPin, MessageCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useLiveVisibility } from '../../hooks/useLiveVisibility'
import { getExternalMapUrl } from '../../lib/mapLocation'
import { subscribeToLikeStatus, subscribeToPostReactions, togglePostLike } from '../../services/likeService'
import type { Post } from '../../types/post'
import { formatFeedDate, getFeedTone } from './feedPosts'

export function FeedPostCard({ post }: { post: Post }) {
  const { currentUser, profile, firebaseReady } = useAuth()
  const navigate = useNavigate()
  const { ref, live } = useLiveVisibility()
  const [counts, setCounts] = useState({ likeCount: post.likeCount, commentCount: post.commentCount })
  const [liked, setLiked] = useState(false)
  const [ready, setReady] = useState(false)
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoIndex, setPhotoIndex] = useState(0)
  const pending = useRef(false)
  const uid = currentUser?.uid
  const detailHref = `/posts/${encodeURIComponent(post.id)}`
  const photos = post.photoUrls

  useEffect(() => {
    setReady(false)
    setLiked(false)
    setAvailable(true)
    setError('')
    if (!firebaseReady || !uid || !live) return
    const fail = () => { setAvailable(false); setError('반응을 불러오지 못했어요. 기록이 삭제되었거나 볼 수 없게 되었을 수 있어요.') }
    const stopCounts = subscribeToPostReactions(post.id, next => {
      if (!next) { setAvailable(false); setError('삭제된 기록이에요.'); return }
      setCounts(next)
    }, fail)
    const stopLike = subscribeToLikeStatus(post.id, uid, next => { setLiked(next); setReady(true) }, fail)
    return () => { stopCounts(); stopLike() }
  }, [post.id, uid, firebaseReady, live])

  async function toggleLike() {
    if (!currentUser || !profile) { navigate('/login'); return }
    if (pending.current || !available || !ready) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await togglePostLike(post.id, { uid: currentUser.uid, nickname: profile.nickname, photoURL: profile.photoURL })
    } catch {
      setError('좋아요를 저장하지 못했어요. 다시 시도해 주세요.')
    } finally { pending.current = false; setBusy(false) }
  }

  return (
    <article className="feed-post" id={`feed-post-${post.id}`} aria-labelledby={`feed-post-title-${post.id}`}>
      <div ref={ref}>
        <header className="feed-post-author">
          <Link className="feed-post-avatar" to={`/people/${encodeURIComponent(post.uid)}`} aria-label={`${post.authorNickname} 프로필 보기`}>
            {post.authorNickname.slice(0, 1) || '?'}
          </Link>
          <div className="feed-post-who">
            <Link to={`/people/${encodeURIComponent(post.uid)}`}>{post.authorNickname}</Link>
            <span><MapPin size={12} aria-hidden="true" />{post.placeName}</span>
          </div>
          <Link className="feed-post-icon-button" to={detailHref} aria-label={`${post.title} 기록 자세히 보기`}>
            <Ellipsis size={22} aria-hidden="true" />
          </Link>
        </header>

        {photos.length > 0 ? (
          <div className="feed-post-media">
            <div className="feed-post-track" tabIndex={photos.length > 1 ? 0 : undefined}
              aria-label={photos.length > 1 ? `사진 ${photos.length}장, 옆으로 넘겨 보기` : undefined}
              onScroll={(event) => {
                const track = event.currentTarget
                setPhotoIndex(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)))
              }}>
              {photos.map((url, index) => (
                <img key={url} src={url} alt={`${post.title} 사진 ${index + 1}`} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />
              ))}
            </div>
            {photos.length > 1 && <span className="feed-post-counter" aria-hidden="true">{photoIndex + 1}/{photos.length}</span>}
          </div>
        ) : (
          <div className={`feed-post-placeholder ${getFeedTone(post)}`}>
            <MapPin size={28} aria-hidden="true" />
            <span>{post.placeName}</span>
          </div>
        )}

        <div className="feed-post-actions">
          <button className={`feed-post-icon-button${liked ? ' is-liked' : ''}`} type="button" aria-pressed={liked}
            aria-label={liked ? '좋아요 취소' : '좋아요'} aria-busy={busy}
            disabled={busy || !available || Boolean(currentUser && !ready)} onClick={() => void toggleLike()}>
            <Heart size={24} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
          </button>
          <Link className="feed-post-icon-button" to={detailHref} aria-label="댓글 보기">
            <MessageCircle size={24} aria-hidden="true" />
          </Link>
          <a className="feed-post-icon-button" href={getExternalMapUrl(post)} target="_blank" rel="noopener noreferrer" aria-label="지도에서 위치 열기">
            <MapPin size={24} aria-hidden="true" />
          </a>
          {photos.length > 1 && <span className="feed-post-dots" aria-hidden="true">
            {photos.map((url, index) => <i key={url} className={index === photoIndex ? 'active' : undefined} />)}
          </span>}
        </div>

        <div className="feed-post-caption">
          <p className="feed-post-likes">좋아요 {counts.likeCount}개</p>
          <h2 id={`feed-post-title-${post.id}`}>{post.title}</h2>
          {post.content && <p className="feed-post-content">{post.content}</p>}
          <Link className="feed-post-comments" to={detailHref}>
            {counts.commentCount > 0 ? `댓글 ${counts.commentCount}개 모두 보기` : '댓글 남기기'}
          </Link>
          <time dateTime={post.dateKey}>{formatFeedDate(post.dateKey)}</time>
          {error && <p className="form-error interaction-error" role="alert">{error}</p>}
        </div>
      </div>
    </article>
  )
}
