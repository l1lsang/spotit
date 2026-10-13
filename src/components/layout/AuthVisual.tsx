import { MapPin } from 'lucide-react'
import walkPhoto from '../../assets/landing/walk.webp'

export function AuthVisual() {
  return <aside className="auth-visual" aria-label="스팟잇 장소 기록">
    <img src={walkPhoto} alt="햇살 아래 초록빛 성북천 산책길" width="640" height="640" />
    <div className="auth-visual-copy"><span><MapPin size={15} aria-hidden="true" /> 성북천, 서울</span><h2>오늘의 발걸음이<br />내일의 추억으로.</h2><p>당신만의 장소를 하나씩 모아보세요.</p></div>
  </aside>
}
