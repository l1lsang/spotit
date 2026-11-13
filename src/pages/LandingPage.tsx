import { Link } from 'react-router-dom'
import { BrandLogo } from '../components/layout/BrandLogo'
import { PolicyFooter } from '../components/layout/PolicyFooter'

/**
 * 피노리 랜딩 페이지 (구성 예정).
 * 헤더·푸터만 두고 본문은 비워둔 상태입니다. 랜딩 섹션은 <main className="landing-main"> 안에 추가하세요.
 */
export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link to="/" className="brand-lockup" aria-label="피노리 홈"><BrandLogo /></Link>
      </header>
      <main id="main-content" className="landing-main">
        <h1 className="sr-only">피노리</h1>
        {/* TODO: 랜딩 콘텐츠 */}
      </main>
      <footer className="landing-footer"><span>피노리</span><PolicyFooter showCredit={false} /></footer>
    </div>
  )
}
