import { Bell, BookOpen, List, Map, MessageCircle, User, UsersRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications'

const items = [
  { to: '/map', label: '지도', icon: Map },
  { to: '/feed', label: '피드', icon: List },
  { to: '/people', label: '사람', icon: UsersRound },
  { to: '/chats', label: '채팅', icon: MessageCircle },
  { to: '/notifications', label: '알림', icon: Bell },
  { to: '/my', label: '내 기록', icon: BookOpen },
  { to: '/profile', label: '프로필', icon: User },
] as const

export function BottomNav() {
  const { currentUser } = useAuth()
  const unreadCount = useUnreadNotifications(currentUser?.uid)

  return (
    <nav className="bottom-nav" aria-label="하단 탭 메뉴">
      {items.map((item) => {
        const Icon = item.icon
        const isNotifications = item.to === '/notifications'

        return (
          <NavLink key={item.to} to={item.to}>
            <span className="bottom-nav-icon">
              <Icon size={20} aria-hidden="true" />
              {isNotifications && unreadCount > 0 && (
                <i>{unreadCount > 99 ? '99+' : unreadCount}</i>
              )}
            </span>
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
