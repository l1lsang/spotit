import { CalendarDays, MapPin, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDateKey } from '../../lib/date'
import type { Post } from '../../types/post'

interface MapPostPreviewProps {
  post: Post
  onClose: () => void
}

export function MapPostPreview({ post, onClose }: MapPostPreviewProps) {
  return (
    <article className="map-preview" aria-label="선택한 기록">
      <button className="button-icon subtle" type="button" onClick={onClose} aria-label="닫기">
        ×
      </button>
      <h2>{post.title}</h2>
      <p className="preview-place">
        <MapPin size={15} aria-hidden="true" />
        {post.placeName}
      </p>
      <div className="preview-meta">
        <span>
          <CalendarDays size={14} aria-hidden="true" />
          {formatDateKey(post.dateKey)}
        </span>
        <span>
          <UserRound size={14} aria-hidden="true" />
          {post.authorNickname}
        </span>
      </div>
      <Link className="button button-primary" to={`/posts/${post.id}`}>
        상세보기
      </Link>
    </article>
  )
}
