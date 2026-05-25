import { MessageCircle, SendHorizonal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { formatTimestamp } from '../../lib/date'
import type { PostComment, PostReply } from '../../types/comment'

interface CommentListProps {
  comments: PostComment[]
  currentUserUid?: string
  postOwnerUid: string
  onDelete: (commentId: string) => void
  onDeleteReply: (comment: PostComment, reply: PostReply) => void
  onReply: (comment: PostComment, content: string) => Promise<void>
}

export function CommentList({
  comments,
  currentUserUid,
  postOwnerUid,
  onDelete,
  onDeleteReply,
  onReply,
}: CommentListProps) {
  const [replyingTo, setReplyingTo] = useState('')
  const [replyContent, setReplyContent] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  if (comments.length === 0) {
    return <p className="empty-text">아직 댓글이 없습니다.</p>
  }

  async function handleReplySubmit(event: React.FormEvent<HTMLFormElement>, comment: PostComment) {
    event.preventDefault()

    if (!replyContent.trim()) {
      return
    }

    setSubmittingReply(true)

    try {
      await onReply(comment, replyContent)
      setReplyContent('')
      setReplyingTo('')
    } finally {
      setSubmittingReply(false)
    }
  }

  return (
    <ul className="comment-list">
      {comments.map((comment) => {
        const canDelete = currentUserUid === comment.uid || currentUserUid === postOwnerUid
        const isReplying = replyingTo === comment.id

        return (
          <li key={comment.id} className="comment-item">
            <div className="comment-main">
              <strong>{comment.authorNickname}</strong>
              <time>{formatTimestamp(comment.createdAt)}</time>
              <p>{comment.content}</p>
              <div className="comment-actions">
                <button
                  className="text-action"
                  type="button"
                  disabled={!currentUserUid}
                  onClick={() => {
                    setReplyingTo(isReplying ? '' : comment.id)
                    setReplyContent('')
                  }}
                >
                  <MessageCircle size={14} aria-hidden="true" />
                  답글
                </button>
              </div>

              {comment.replies.length > 0 && (
                <ul className="reply-list">
                  {comment.replies.map((reply) => {
                    const canDeleteReply =
                      currentUserUid === reply.uid ||
                      currentUserUid === postOwnerUid ||
                      currentUserUid === comment.uid

                    return (
                      <li className="reply-item" key={reply.id}>
                        <div>
                          <strong>{reply.authorNickname}</strong>
                          <time>{formatTimestamp(reply.createdAt)}</time>
                          <p>{reply.content}</p>
                        </div>
                        {canDeleteReply && (
                          <button
                            className="button-icon subtle danger"
                            type="button"
                            onClick={() => onDeleteReply(comment, reply)}
                            aria-label="답글 삭제"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {isReplying && (
                <form className="reply-form" onSubmit={(event) => void handleReplySubmit(event, comment)}>
                  <textarea
                    value={replyContent}
                    onChange={(event) => setReplyContent(event.target.value)}
                    placeholder="답글을 입력하세요"
                    rows={2}
                    disabled={submittingReply}
                  />
                  <button className="button button-primary" type="submit" disabled={submittingReply || !replyContent.trim()}>
                    <SendHorizonal size={16} aria-hidden="true" />
                    답글 작성
                  </button>
                </form>
              )}
            </div>
            {canDelete && (
              <button
                className="button-icon subtle danger"
                type="button"
                onClick={() => onDelete(comment.id)}
                aria-label="댓글 삭제"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
