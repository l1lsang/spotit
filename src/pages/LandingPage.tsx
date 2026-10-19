import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { LandingHero } from '../components/landing/LandingHero'
import { BrandLogo } from '../components/layout/BrandLogo'
import { PolicyFooter } from '../components/layout/PolicyFooter'
import { useAuth } from '../hooks/useAuth'

export function LandingPage() {
  const navigate = useNavigate()
  const { currentUser, loading } = useAuth()
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link to="/" className="brand-lockup" aria-label="스팟잇 홈"><BrandLogo variant="reversed" /></Link>
        <span className="landing-tagline">오늘, 이곳.</span>
        <nav aria-label="시작 메뉴">
          <Link to={currentUser ? '/profile' : '/login'}>{currentUser ? '내 기록' : '로그인'}</Link>
          <Link to="/map">지도 둘러보기 <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </nav>
      </header>
      <main id="main-content" className="landing-main">
        <section className="landing-intro" aria-labelledby="landing-title">
          <h1 id="landing-title">좋았던 순간은,<br /><span>여기에.</span></h1>
          <div className="landing-intro-note">
            <p>걷다가 만난 골목, 오래 머문 카페.<br />사진과 글로 남긴 오늘이<br className="landing-mobile-break" /> 나만의 지도가 됩니다.</p>
            <button className="button button-primary landing-cta" type="button" disabled={loading}
              onClick={() => navigate(currentUser ? '/map' : '/login')}>
              나의 지도 시작하기 <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
        <LandingHero />
        <section className="landing-closing" aria-label="스팟잇 소개">
          <p>흘러가는 하루를,<br />다시 찾을 수 있는 장소로.</p>
          <div><p>지도에 핀을 남기고, 사진과 이야기를 더해보세요.<br />혼자 간직하거나 팔로우한 사람들과 나눌 수 있어요.</p>
            <Link to="/map" className="text-link">지도로 바로가기 <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
      <footer className="landing-footer"><span>스팟잇</span><PolicyFooter showCredit={false} /></footer>
    </div>
  )
}
