import { List, Map, MessageCircle, User, UsersRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/map', label: '지도', icon: Map },
  { to: '/feed', label: '피드', icon: List },
  { to: '/people', label: '사람', icon: UsersRound },
  { to: '/chats', label: '채팅', icon: MessageCircle },
  { to: '/profile', label: '프로필', icon: User },
] as const

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="하단 탭 메뉴">
      {items.map((item) => {
        const Icon = item.icon

        return (
          <NavLink key={item.to} to={item.to}>
            <span className="bottom-nav-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
