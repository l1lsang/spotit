import { LogIn, MapPin } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function Header() {
  const { currentUser, profile } = useAuth()

  return (
    <header className="site-header">
      <Link className="brand-lockup" to="/map" aria-label="스팟잇 지도 홈">
        <span className="brand-mark">
          <MapPin size={20} aria-hidden="true" />
        </span>
        <span>
          <strong>스팟잇</strong>
          <small>오늘, 이곳</small>
        </span>
      </Link>

      <nav className="header-nav" aria-label="주요 메뉴">
        <NavLink to="/map">지도</NavLink>
        <NavLink to="/feed">피드</NavLink>
        {currentUser && <NavLink to="/people">사람</NavLink>}
        {currentUser ? (
          <NavLink to="/profile">{profile?.nickname || '프로필'}</NavLink>
        ) : (
          <Link className="header-login" to="/login">
            <LogIn size={16} aria-hidden="true" />
            로그인
          </Link>
        )}
      </nav>
    </header>
  )
}
