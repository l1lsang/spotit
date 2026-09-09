import { Link } from 'react-router-dom'
import { policyNavigation } from '../../lib/policyNavigation'

export function PolicyFooter({ newTab = false }: { newTab?: boolean }) {
  return (
    <nav className="policy-footer" aria-label="약관 및 정책">
      {policyNavigation.map(item => <Link key={item.id} to={`/policies/${item.id}`}
        target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}
        title={newTab ? `${item.title} (새 창)` : undefined}
        className={item.id === 'privacy' ? 'policy-footer-privacy' : undefined}>{item.title}</Link>)}
      <Link to="/licenses" target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}
        title={newTab ? '오픈소스 라이선스 (새 창)' : undefined}>오픈소스 라이선스</Link>
    </nav>
  )
}
