import { Link } from 'react-router-dom'
import type { DaymarkUser } from '../../types/user'

type UserSummary = Pick<DaymarkUser, 'uid' | 'nickname' | 'username' | 'photoURL'>

export function UserSummaryLink({ user, returnTo = '/people', onOpen }: { user: UserSummary; returnTo?: string; onOpen?: () => void }) {
  return (
    <Link className="user-summary-link" to={`/people/${encodeURIComponent(user.uid)}`} state={{ peopleReturnTo: returnTo }} onClick={onOpen}
      aria-label={`${user.nickname || '사용자'}${user.username ? ` (@${user.username})` : ''} 프로필 보기`}>
      {user.photoURL ? <img className="profile-photo small" src={user.photoURL} alt="" loading="lazy" />
        : <span className="profile-avatar small" aria-hidden="true">{user.nickname.slice(0, 1) || 'S'}</span>}
      <span className="user-summary-identity">
        <strong>{user.nickname || '스팟잇 사용자'}</strong>
        {user.username && <span>@{user.username}</span>}
      </span>
    </Link>
  )
}
