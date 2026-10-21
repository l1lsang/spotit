import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DaymarkUser } from '../../types/user'

interface ProfileHeaderProps {
  user: DaymarkUser
  own: boolean
  pinCount: number | null
  onOpenFollowList: (kind: 'followers' | 'following') => void
  children?: ReactNode
}

export function ProfileHeader({ user, own, pinCount, onOpenFollowList, children }: ProfileHeaderProps) {
  const name = user.nickname || '스팟잇 사용자'
  const followers = user.followerCount || 0
  const following = user.followingCount || 0
  return <section className="profile-view-header" aria-label="프로필">
    <div className="profile-view-summary">
      {user.photoURL ? <img className="profile-view-avatar" src={user.photoURL} alt={`${name} 프로필 사진`} />
        : <span className="profile-view-avatar profile-view-initial" aria-hidden="true">{name.slice(0, 1) || 'S'}</span>}
      <div className="profile-view-stats">
        <p className="profile-view-stat">
          <strong aria-hidden={pinCount === null ? true : undefined}>{pinCount ?? '–'}</strong>
          <span>핀{pinCount === null && <span className="sr-only"> 수를 볼 수 없어요</span>}</span>
        </p>
        <button className="profile-view-stat" type="button" onClick={() => onOpenFollowList('followers')} aria-label={`팔로워 ${followers}명 보기`}>
          <strong>{followers}</strong><span>팔로워</span>
        </button>
        <button className="profile-view-stat" type="button" onClick={() => onOpenFollowList('following')} aria-label={`팔로잉 ${following}명 보기`}>
          <strong>{following}</strong><span>팔로잉</span>
        </button>
      </div>
    </div>
    <div className="profile-view-identity">
      <h1>{name}</h1>
      <p className={`profile-view-bio${user.bio ? '' : ' is-empty'}`}>{user.bio || '아직 소개글이 없습니다.'}</p>
      {user.isPrivate && <p className="profile-view-privacy"><Lock size={14} aria-hidden="true" />
        <span>{own ? '비공개 계정 · 새 팔로우 요청은 설정에서 승인할 수 있습니다.' : '비공개 계정 · 팔로우 요청을 승인받아야 합니다.'}</span></p>}
    </div>
    {children && <div className="profile-view-actions">{children}</div>}
  </section>
}
