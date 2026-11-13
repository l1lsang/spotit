import { Link, useLocation } from 'react-router-dom'
import { BrandLogo } from '../layout/BrandLogo'

export function SiteHeader() {
  const { pathname } = useLocation()
  const onCompany = pathname.startsWith('/company')

  return (
    <header className="site-header-bar">
      <div className="site-wrap site-header-inner">
        <Link to="/" className="site-brand" aria-label="피노리 홈"><BrandLogo /></Link>
        <nav className="site-nav" aria-label="주요 메뉴">
          <a className="site-nav-link site-nav-optional" href="/#story">서비스 소개</a>
          <a className="site-nav-link site-nav-optional" href="/#features">기능</a>
          <Link className="site-nav-link" to="/company" aria-current={onCompany ? 'page' : undefined}>회사 소개</Link>
          <a className="button button-primary site-nav-cta" href="/#download">다운받기</a>
        </nav>
      </div>
    </header>
  )
}
