import { CalendarDays, ExternalLink, MapPin, Share2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateKey } from '../../lib/date'
import { getExternalMapUrl } from '../../lib/mapLocation'
import type { Post } from '../../types/post'
import { PostInteractions } from '../post/PostInteractions'

interface MapPostPreviewProps {
  post: Post
  onClose: () => void
  onBack?: () => void
}

export function MapPostPreview({ post, onClose, onBack }: MapPostPreviewProps) {
  const [shareMessage, setShareMessage] = useState('')
  async function handleShare() {
    const shareUrl = `${window.location.origin}/posts/${post.id}`

    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: `${post.placeName} 핀을 공유합니다.`, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setShareMessage('공유 링크를 복사했습니다.')
      }
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') setShareMessage('공유하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  return (
    <article className="map-preview" aria-label="선택한 기록">
      <button className="button-icon subtle" type="button" onClick={onClose} aria-label="닫기">
        ×
      </button>
      {onBack && <button className="map-list-back" type="button" onClick={onBack}>← 핀 목록</button>}
      <h2>{post.title}</h2>
      <p className="preview-place">
        <MapPin size={15} aria-hidden="true" />
        {post.placeName}
      </p>
      <p className="preview-address">{post.address || '주소가 등록되지 않은 위치입니다.'}</p>
      <p className="preview-coordinates">{post.lat.toFixed(5)}, {post.lng.toFixed(5)}</p>
      <a className="preview-map-link" href={getExternalMapUrl(post, post.placeName)} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={14} aria-hidden="true" />지도에서 위치 열기
      </a>
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
      {shareMessage && <p role="status">{shareMessage}</p>}
      <PostInteractions key={post.id} post={post} />
      <div className="preview-actions">
        <Link className="button button-primary" to={`/posts/${post.id}`}>
          상세보기
        </Link>
        <button className="button button-secondary" type="button" onClick={() => void handleShare()}>
          <Share2 size={16} aria-hidden="true" />
          공유
        </button>
      </div>
    </article>
  )
}
