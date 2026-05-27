import { CalendarDays, Globe2, Lock, MapPin, UsersRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDateKey } from '../../lib/date'
import type { Post } from '../../types/post'

interface PostCardProps {
  post: Post
  showVisibility?: boolean
  actions?: ReactNode
}

export function PostCard({ post, showVisibility = false, actions }: PostCardProps) {
  const excerpt = post.content.length > 84 ? `${post.content.slice(0, 84)}...` : post.content

  return (
    <article className="post-card">
      <Link className="post-card-link" to={`/posts/${post.id}`} aria-label={`${post.title} 상세보기`}>
        {post.photoUrls[0] ? (
          <img className="post-thumbnail" src={post.photoUrls[0]} alt={post.title} />
        ) : (
          <div className="post-thumbnail placeholder-thumbnail">
            <MapPin size={28} aria-hidden="true" />
          </div>
        )}

        <div className="post-card-body">
          <div className="card-title-row">
            <h2>{post.title}</h2>
            {showVisibility && (
              <span className={`pill ${post.visibility === 'private' ? 'private' : ''}`}>
                {post.visibility === 'private' ? (
                  <Lock size={13} aria-hidden="true" />
                ) : post.visibility === 'public' ? (
                  <Globe2 size={13} aria-hidden="true" />
                ) : (
                  <UsersRound size={13} aria-hidden="true" />
                )}
                {post.visibility === 'private'
                  ? 'private'
                  : post.visibility === 'public'
                    ? 'public'
                    : 'followers'}
              </span>
            )}
          </div>
          <p className="post-place">
            <MapPin size={15} aria-hidden="true" />
            {post.placeName}
          </p>
          <p className="post-excerpt">{excerpt}</p>
          <div className="post-meta">
            <span>
              <CalendarDays size={14} aria-hidden="true" />
              {formatDateKey(post.dateKey)}
            </span>
            <span>
              <UsersRound size={14} aria-hidden="true" />
              {post.authorNickname}
            </span>
          </div>
        </div>
      </Link>
      {actions && <div className="card-actions">{actions}</div>}
    </article>
  )
}
