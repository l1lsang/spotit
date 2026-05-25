import { Bell, LogIn } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications'

export function Header() {
  const { currentUser, profile } = useAuth()
  const unreadCount = useUnreadNotifications(currentUser?.uid)

  return (
    <header className="site-header">
      <Link className="brand-lockup" to="/map" aria-label="스팟온 지도 홈">
        <img className="brand-logo" src="/logo.png" alt="스팟온" />
      </Link>

      <nav className="header-nav" aria-label="주요 메뉴">
        <NavLink to="/map">지도</NavLink>
        <NavLink to="/feed">피드</NavLink>
        {currentUser && <NavLink to="/people">사람</NavLink>}
        {currentUser && <NavLink to="/chats">채팅</NavLink>}
        {currentUser ? (
          <NavLink to="/profile">{profile?.nickname || '프로필'}</NavLink>
        ) : (
          <Link className="header-login" to="/login">
            <LogIn size={16} aria-hidden="true" />
            로그인
          </Link>
        )}
        {currentUser && (
          <NavLink
            className="header-icon-link notification-nav-link"
            to="/notifications"
            aria-label={unreadCount > 0 ? `알림 ${unreadCount}개` : '알림'}
          >
            <Bell size={19} aria-hidden="true" />
            {unreadCount > 0 && <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </NavLink>
        )}
      </nav>
    </header>
  )
}
