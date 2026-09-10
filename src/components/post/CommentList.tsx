import { CornerDownRight, SendHorizonal, Trash2, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatTimestamp } from '../../lib/date'
import { COMMENT_MAX_LENGTH, type PostComment, type PostReply } from '../../types/comment'

interface CommentListProps {
  comments: PostComment[]
  currentUserUid?: string
  postOwnerUid: string
  postId: string
  anchorTargets?: boolean
  onDelete: (commentId: string) => Promise<void>
  onDeleteReply: (comment: PostComment, reply: PostReply) => Promise<void>
  onReply: (comment: PostComment, content: string) => Promise<void>
}

function CommentAuthor({ author }: { author: PostComment | PostReply }) {
  return <Link className="comment-author" to={`/people/${encodeURIComponent(author.uid)}`}>
    {author.authorPhotoURL ? <img className="comment-avatar" src={author.authorPhotoURL} alt="" loading="lazy" />
      : <span className="comment-avatar"><UserRound size={17} aria-hidden="true" /></span>}
    <strong>{author.authorNickname}</strong>
  </Link>
}

export function CommentList({ comments, currentUserUid, postOwnerUid, postId, anchorTargets = false, onDelete, onDeleteReply, onReply }: CommentListProps) {
  const [replyingTo, setReplyingTo] = useState('')
  const [replyContent, setReplyContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const visibleComments = comments.filter(comment => !comment.deleted || comment.replies.length > 0)
  const rowId = (kind: string, id: string) => `${anchorTargets ? '' : `${postId}-`}${kind}-${id}`

  async function run(action: () => Promise<void>) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await action() }
    catch { setError('댓글을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.') }
    finally { pending.current = false; setBusy(false) }
  }

  if (!visibleComments.length) return <p className="comment-status">첫 댓글을 남겨보세요.</p>

  return <>
    <ul className="comment-list">
      {visibleComments.map(comment => {
        const canDelete = !comment.deleted && (currentUserUid === comment.uid || currentUserUid === postOwnerUid)
        const isReplying = !comment.deleted && replyingTo === comment.id
        return <li key={comment.id} className="comment-item" id={rowId('comment', comment.id)} tabIndex={-1}>
          <div className="comment-main">
            <div className="comment-heading">
              {comment.deleted ? <span className="comment-deleted">삭제된 댓글</span> : <CommentAuthor author={comment} />}
              <time>{formatTimestamp(comment.createdAt)}</time>
              {canDelete && <button className="text-action comment-delete" type="button" disabled={busy}
                onClick={() => void run(() => onDelete(comment.id))} aria-label={`${comment.authorNickname}님의 댓글 삭제`}>
                <Trash2 size={15} aria-hidden="true" />
              </button>}
            </div>
            <p className={comment.deleted ? 'comment-deleted' : undefined}>{comment.deleted ? '삭제된 댓글입니다.' : comment.content}</p>
            {!comment.deleted && <div className="comment-actions">
              <button className="text-action" type="button" disabled={!currentUserUid || busy} aria-expanded={isReplying}
                onClick={() => { setReplyingTo(isReplying ? '' : comment.id); setReplyContent(''); setError('') }}>
                <CornerDownRight size={14} aria-hidden="true" />{isReplying ? '답글 취소' : '답글 달기'}
              </button>
            </div>}
            {comment.replies.length > 0 && <ul className="reply-list" aria-label={`${comment.authorNickname}님의 댓글에 달린 답글`}>
              {comment.replies.map(reply => {
                const canDeleteReply = [reply.uid, postOwnerUid, comment.uid].includes(currentUserUid || '')
                return <li className="reply-item" key={reply.id} id={rowId('reply', reply.id)} tabIndex={-1}>
                  <CornerDownRight className="reply-indent" size={16} aria-hidden="true" />
                  <div className="comment-main">
                    <div className="comment-heading">
                      <CommentAuthor author={reply} /><time>{formatTimestamp(reply.createdAt)}</time>
                      {canDeleteReply && <button className="text-action comment-delete" type="button" disabled={busy}
                        onClick={() => void run(() => onDeleteReply(comment, reply))} aria-label={`${reply.authorNickname}님의 답글 삭제`}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>}
                    </div>
                    <p>{reply.content}</p>
                  </div>
                </li>
              })}
            </ul>}
            {isReplying && <form className="reply-form" onSubmit={event => {
              event.preventDefault()
              if (!replyContent.trim()) return
              void run(async () => { await onReply(comment, replyContent); setReplyContent(''); setReplyingTo('') })
            }}>
              <label htmlFor={`reply-input-${postId}-${comment.id}`}>{comment.authorNickname}님에게 답글</label>
              <textarea id={`reply-input-${postId}-${comment.id}`} value={replyContent} onChange={event => setReplyContent(event.target.value)}
                placeholder="답글을 입력하세요" rows={2} maxLength={COMMENT_MAX_LENGTH} disabled={busy} autoFocus />
              <div className="comment-compose-actions">
                <small>{replyContent.length.toLocaleString()} / {COMMENT_MAX_LENGTH.toLocaleString()}</small>
                <button className="text-action comment-submit" type="submit" disabled={busy || !replyContent.trim()}>
                  <SendHorizonal size={16} aria-hidden="true" />{busy ? '등록 중…' : '답글 등록'}
                </button>
              </div>
            </form>}
          </div>
        </li>
      })}
    </ul>
    {error && <p className="form-error" role="alert">{error}</p>}
  </>
}
