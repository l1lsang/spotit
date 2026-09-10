import { SendHorizonal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { addComment, addReply, deleteComment, deleteReply, subscribeToComments } from '../../services/commentService'
import { COMMENT_MAX_LENGTH, type PostComment } from '../../types/comment'
import type { Post } from '../../types/post'
import { CommentList } from './CommentList'

export function CommentThread({ post, anchorTargets }: { post: Post; anchorTargets: boolean }) {
  const { currentUser, profile } = useAuth()
  const location = useLocation()
  const [comments, setComments] = useState<PostComment[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [missingTarget, setMissingTarget] = useState(false)
  const pending = useRef(false)
  const scrolledTo = useRef('')
  const uid = currentUser?.uid

  useEffect(() => {
    setLoading(true)
    setLoadError('')
    if (!uid) { setLoading(false); return }
    return subscribeToComments(post.id, next => { setComments(next); setLoading(false) }, () => {
      setComments([]); setLoading(false); setLoadError('댓글을 불러오지 못했습니다. 다시 시도해 주세요.')
    })
  }, [post.id, uid, revision])

  useEffect(() => {
    if (!anchorTargets || loading || loadError || !location.hash) return
    const targetKey = `${location.key}${location.hash}`
    if (scrolledTo.current === targetKey) return
    const id = location.hash.slice(1)
    if (!/^(comment-|reply-)[\w-]+$/.test(id) && id !== 'comments') return
    const target = document.getElementById(id === 'comments' ? `comments-${post.id}` : id)
    setMissingTarget(!target)
    const destination = target || document.getElementById(`comments-${post.id}`)
    destination?.scrollIntoView({ block: 'center' })
    destination?.focus({ preventScroll: true })
    scrolledTo.current = targetKey
  }, [anchorTargets, loading, loadError, location.hash, location.key, post.id, comments])

  function actor() {
    if (!currentUser || !profile) throw new Error('로그인 후 댓글을 남길 수 있습니다.')
    return { uid: currentUser.uid, nickname: profile.nickname, photoURL: profile.photoURL }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || !content.trim()) return
    pending.current = true; setBusy(true); setError('')
    try { await addComment(post.id, actor(), content); setContent('') }
    catch { setError('댓글을 저장하지 못했습니다. 입력한 내용을 확인하고 다시 시도해 주세요.') }
    finally { pending.current = false; setBusy(false) }
  }

  return <section className="comments-section" id={`comments-${post.id}`} aria-label="댓글과 답글" tabIndex={-1}>
    <h2>댓글</h2>
    {missingTarget && <p className="comment-status" role="status">알림의 댓글이 삭제되었거나 더 이상 표시되지 않습니다.</p>}
    {loading && <p className="comment-status" role="status">댓글을 불러오는 중입니다.</p>}
    {loadError && <p className="form-error" role="alert">{loadError} <button className="text-action" type="button" onClick={() => setRevision(value => value + 1)}>다시 시도</button></p>}
    {!loading && !loadError && <CommentList comments={comments} currentUserUid={uid} postOwnerUid={post.uid}
      anchorTargets={anchorTargets} postId={post.id}
      onReply={(comment, text) => addReply(post.id, comment.id, actor(), text)}
      onDelete={commentId => deleteComment(post.id, commentId, actor().uid)}
      onDeleteReply={(comment, reply) => deleteReply(post.id, comment.id, reply.id, actor().uid)} />}
    <form className="comment-form" onSubmit={event => void submit(event)}>
      <label className="sr-only" htmlFor={`comment-input-${post.id}`}>댓글 입력</label>
      <textarea id={`comment-input-${post.id}`} value={content} onChange={event => setContent(event.target.value)}
        placeholder={uid ? '댓글을 남겨보세요' : '로그인 후 댓글을 남길 수 있습니다'} rows={2}
        maxLength={COMMENT_MAX_LENGTH} disabled={!uid || busy || Boolean(loadError)} />
      <div className="comment-compose-actions">
        <small>{content.length.toLocaleString()} / {COMMENT_MAX_LENGTH.toLocaleString()}</small>
        <button className="text-action comment-submit" type="submit" disabled={!uid || busy || !content.trim() || Boolean(loadError)}>
          <SendHorizonal size={16} aria-hidden="true" />{busy ? '등록 중…' : '댓글 등록'}
        </button>
      </div>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
