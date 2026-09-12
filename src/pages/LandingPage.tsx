import { ArrowRight, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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

        <div className="landing-map-art" aria-label="지도 위 장소 기록 예시">
          <div className="map-grid-lines" />
          <span className="pin pin-one">
            <MapPin size={28} aria-hidden="true" />
          </span>
          <span className="pin pin-two">
            <MapPin size={24} aria-hidden="true" />
          </span>
          <span className="pin pin-three">
            <MapPin size={22} aria-hidden="true" />
          </span>
          <article>
            <strong>햇살 좋았던 점심 산책</strong>
            <small>서울시청 앞 광장 · 2026.05.24</small>
          </article>
        </div>
      </section>
    </main>
  )
}
