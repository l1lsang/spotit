import { Globe2, Images, Lock, MapPin, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Post } from '../../types/post'

export function PinAlbumGrid({ posts, showVisibility = false }: { posts: Post[]; showVisibility?: boolean }) {
  return <div className="pin-album-grid">
    {posts.map(post => <Link className="pin-album-tile" key={post.id} to={`/posts/${encodeURIComponent(post.id)}`}
      aria-label={`${post.title} · ${post.placeName} 핀 보기`}>
      {post.photoUrls[0] ? <img src={post.photoThumbnailUrls?.[0] || post.photoUrls[0]} alt="" loading="lazy" decoding="async" />
        : <div className="pin-album-placeholder"><MapPin size={32} aria-hidden="true" /><span>{post.placeName}</span></div>}
      {post.photoUrls.length > 1 && <span className="pin-album-photo-count" aria-label={`사진 ${post.photoUrls.length}장`}><Images size={14} aria-hidden="true" />{post.photoUrls.length}</span>}
      {showVisibility && <span className="pin-album-visibility" aria-label={post.visibility === 'private' ? '나만 보기' : post.visibility === 'group' ? '그룹 멤버 공개' : post.visibility === 'followers' ? '팔로워 공개' : '전체 공개'}>
        {post.visibility === 'private' || post.visibility === 'group' ? <Lock size={14} aria-hidden="true" /> : post.visibility === 'followers' ? <UsersRound size={14} aria-hidden="true" /> : <Globe2 size={14} aria-hidden="true" />}
      </span>}
      <span className="pin-album-caption">{post.title}</span>
    </Link>)}
  </div>
}
