import { Globe2, Images, Lock, MapPin, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Post } from '../../types/post'

interface PinAlbumGridProps {
  posts: Post[]
  showVisibility?: boolean
  className?: string
  // The feed reuses these square tiles and opens its own detail view.
  getHref?: (post: Post) => string
  getLabel?: (post: Post) => string
  getTileClassName?: (post: Post) => string
  showTitleWithoutPhoto?: boolean
}

const defaultHref = (post: Post) => `/posts/${encodeURIComponent(post.id)}`
const defaultLabel = (post: Post) => `${post.title} · ${post.placeName} 핀 보기`

export function PinAlbumGrid({
  posts, showVisibility = false, className = '', getHref = defaultHref, getLabel = defaultLabel, getTileClassName, showTitleWithoutPhoto = false,
}: PinAlbumGridProps) {
  return <div className={`pin-album-grid${className ? ` ${className}` : ''}`}>
    {posts.map(post => <Link className={`pin-album-tile${getTileClassName ? ` ${getTileClassName(post)}` : ''}`} key={post.id} to={getHref(post)}
      aria-label={getLabel(post)}>
      {post.photoUrls[0] ? <img src={post.photoThumbnailUrls?.[0] || post.photoUrls[0]} alt="" loading="lazy" decoding="async" />
        : <div className="pin-album-placeholder"><MapPin size={showTitleWithoutPhoto ? 20 : 32} aria-hidden="true" />
          {showTitleWithoutPhoto && <strong>{post.title}</strong>}<span>{post.placeName}</span></div>}
      {post.photoUrls.length > 1 && <span className="pin-album-photo-count" aria-label={`사진 ${post.photoUrls.length}장`}><Images size={14} aria-hidden="true" />{post.photoUrls.length}</span>}
      {showVisibility && <span className="pin-album-visibility" aria-label={post.visibility === 'private' ? '나만 보기' : post.visibility === 'group' ? '그룹 멤버 공개' : post.visibility === 'followers' ? '팔로워 공개' : '전체 공개'}>
        {post.visibility === 'private' || post.visibility === 'group' ? <Lock size={14} aria-hidden="true" /> : post.visibility === 'followers' ? <UsersRound size={14} aria-hidden="true" /> : <Globe2 size={14} aria-hidden="true" />}
      </span>}
      <span className="pin-album-caption">{post.title}</span>
    </Link>)}
  </div>
}
