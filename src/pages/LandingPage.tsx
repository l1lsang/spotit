import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { LandingHero } from '../components/landing/LandingHero'
import { useAuth } from '../hooks/useAuth'
import { PolicyFooter } from '../components/layout/PolicyFooter'

export function LandingPage() {
  const navigate = useNavigate()
  const { currentUser, loading } = useAuth()

  return (
    <main className="landing-page">
      <section className="landing-content">
        <div className="landing-copy">
          <h1>스팟잇</h1>
          <p className="landing-subtitle">
            사진과 글로 남긴 오늘이, 나만의 지도가 됩니다
          </p>
          <button
            className="button button-primary landing-cta"
            type="button"
            disabled={loading}
            onClick={() => navigate(currentUser ? '/map' : '/login')}
          >
            시작하기
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <PolicyFooter />
        </div>

        <LandingHero />
      </section>
    </main>
  )
}
