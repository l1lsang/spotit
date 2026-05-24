import { Trash2 } from 'lucide-react'
import { formatTimestamp } from '../../lib/date'
import type { PostComment } from '../../types/comment'

interface CommentListProps {
  comments: PostComment[]
  currentUserUid?: string
  postOwnerUid: string
  onDelete: (commentId: string) => void
}

export function CommentList({
  comments,
  currentUserUid,
  postOwnerUid,
  onDelete,
}: CommentListProps) {
  if (comments.length === 0) {
    return <p className="empty-text">아직 댓글이 없습니다.</p>
  }

  return (
    <ul className="comment-list">
      {comments.map((comment) => {
        const canDelete = currentUserUid === comment.uid || currentUserUid === postOwnerUid

        return (
          <li key={comment.id} className="comment-item">
            <div>
              <strong>{comment.authorNickname}</strong>
              <time>{formatTimestamp(comment.createdAt)}</time>
              <p>{comment.content}</p>
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
