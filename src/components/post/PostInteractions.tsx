import { Heart, MessageCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useLiveVisibility } from '../../hooks/useLiveVisibility'
import { subscribeToLikeStatus, subscribeToPostReactions, togglePostLike } from '../../services/likeService'
import type { Post } from '../../types/post'
import { CommentThread } from './CommentThread'

export function PostInteractions({ post, expanded = false }: { post: Post; expanded?: boolean }) {
  const { currentUser, profile, firebaseReady } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(expanded)
  const [counts, setCounts] = useState({ likeCount: post.likeCount, commentCount: post.commentCount })
  const [liked, setLiked] = useState(false)
  const [ready, setReady] = useState(false)
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const pending = useRef(false)
  const uid = currentUser?.uid
  const { ref, live } = useLiveVisibility(expanded || open)

  useEffect(() => {
    setReady(false)
    setLiked(false)
    setAvailable(true)
    setError('')
    if (!firebaseReady || !uid || !live) return
    const fail = () => { setAvailable(false); setError('반응을 불러오지 못했습니다. 기록이 삭제되었거나 접근 권한이 변경되었을 수 있습니다.') }
    const stopCounts = subscribeToPostReactions(post.id, next => {
      if (!next) { setAvailable(false); setError('삭제된 기록입니다.'); return }
      setCounts(next)
    }, fail)
    const stopLike = subscribeToLikeStatus(post.id, uid, next => { setLiked(next); setReady(true) }, fail)
    return () => { stopCounts(); stopLike() }
  }, [post.id, uid, firebaseReady, revision, live])

  async function toggleLike() {
    if (!currentUser || !profile) { navigate('/login'); return }
    if (pending.current || !available || !ready) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await togglePostLike(post.id, { uid: currentUser.uid, nickname: profile.nickname, photoURL: profile.photoURL })
    } catch {
      setError('좋아요를 저장하지 못했습니다. 다시 시도해 주세요.')
    } finally { pending.current = false; setBusy(false) }
  }

  return <div ref={ref} className="post-interactions">
    <div className="post-reaction-actions" aria-label={`${post.title} 반응`}>
      <button className={`post-reaction-button ${liked ? 'is-liked' : ''}`} type="button" aria-pressed={liked}
        aria-label={`${liked ? '좋아요 취소' : '좋아요'} ${counts.likeCount}개`} aria-busy={busy}
        disabled={busy || !available || Boolean(currentUser && !ready)} onClick={() => void toggleLike()}>
        <Heart size={19} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />좋아요 {counts.likeCount}
      </button>
      <button className="post-reaction-button" type="button" aria-expanded={open} aria-controls={`comments-${post.id}`}
        disabled={!available} onClick={() => {
          if (!currentUser) { navigate('/login'); return }
          if (expanded) document.getElementById(`comment-input-${post.id}`)?.focus()
          else setOpen(value => !value)
        }}>
        <MessageCircle size={19} aria-hidden="true" />댓글 {counts.commentCount}
      </button>
    </div>
    {error && <p className="form-error interaction-error" role="alert">{error}
      {!available && <button className="text-action" type="button" onClick={() => setRevision(value => value + 1)}>다시 시도</button>}
    </p>}
    {open && available && <CommentThread key={`${post.id}-${uid}`} post={post} anchorTargets={expanded} />}
  </div>
}
