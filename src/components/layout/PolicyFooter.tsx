import { Link } from 'react-router-dom'
import { policyNavigation } from '../../lib/policyNavigation'

export function PolicyFooter({ newTab = false }: { newTab?: boolean }) {
  return (
    <>
      <nav className="policy-footer" aria-label="약관 및 정책">
        {policyNavigation.map(item => <Link key={item.id} to={`/policies/${item.id}`}
          target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}
          title={newTab ? `${item.title} (새 창)` : undefined}
          className={item.id === 'privacy' ? 'policy-footer-privacy' : undefined}>{item.title}</Link>)}
        <Link to="/licenses" target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}
          title={newTab ? '오픈소스 라이선스 (새 창)' : undefined}>오픈소스 라이선스</Link>
      </nav>
      <p className="logo-credit">
        로고 제작:{' '}
        <a
          href="https://l.instagram.com/?u=https%3A%2F%2Fsmartstore.naver.com%2Flogoism99%2Fproducts%2F7337632372%3Fnt_source%3Dinsta%26nt_medium%3Dsocial%26nt_detail%3Dlogo&e=AUD5oZ0WKWwrIZL8Dd0qWg-W_seWABRuF8lh8OmwPUsK4LeW4aOVD135JUmLCapsd3MY_86gO1BktF3KYQHKI9NbUrT4h6Qxej3uZichileDT2kOAnsHA2iy6jGor9OTbqmLIqL1zEzsa-UabGQ72w"
          target="_blank"
          rel="noopener noreferrer"
          title="로고리즘 (새 창)"
        >로고리즘</a>
      </p>
    </>
  )
}
