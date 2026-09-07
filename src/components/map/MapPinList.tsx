import { MapPin, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { formatDateKey } from '../../lib/date'
import type { Post } from '../../types/post'

interface MapPinListProps {
  posts: Post[]
  onSelect: (post: Post) => void
  onClose: () => void
}

export function MapPinList({ posts, onSelect, onClose }: MapPinListProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeRef.current?.focus() }, [])
  return (
    <section className="map-preview map-pin-list" aria-label="겹친 핀 목록" onKeyDown={(event) => {
      if (event.key === 'Escape') onClose()
    }}>
      <button ref={closeRef} className="button-icon subtle" type="button" onClick={onClose} aria-label="핀 목록 닫기">
        <X size={18} aria-hidden="true" />
      </button>
      <h2>이 위치의 핀 {posts.length}개</h2>
      <p className="map-pin-list-hint">핀을 선택하면 정확한 위치를 볼 수 있어요.</p>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <button className="map-pin-list-item" type="button" onClick={() => onSelect(post)}>
              <strong>{post.title}</strong>
              <span><MapPin size={14} aria-hidden="true" />{post.placeName}</span>
              <small>{post.address || `${post.lat.toFixed(5)}, ${post.lng.toFixed(5)}`}</small>
              <small>{post.authorNickname} · {formatDateKey(post.dateKey)}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
