import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { features } from '../../data/showcase'
import { AppStoreButtons } from '../layout/AppStoreButtons'
import { PhoneMockup, PhoneScreenImage } from '../site/PhoneMockup'

export function FeatureHighlights() {
  return (
    <section id="features" className="site-section features" aria-labelledby="features-title">
      <div className="site-wrap">
        <h2 id="features-title" className="section-title">혼자 남긴 핀이 함께 보는 지도로</h2>
        <p className="section-lead">기록은 혼자 남기고, 장소는 여럿이 함께 모아요. 그룹과 리뷰는 지금 앱에서 바로 쓸 수 있어요.</p>
        <div className="feature-grid">
          {features.map(feature => (
            <article key={feature.id} className="feature-card">
              <div className="feature-text">
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </div>
              <div className="feature-visual">
                <PhoneMockup className="feature-phone">
                  <PhoneScreenImage screen={feature.screen} />
                </PhoneMockup>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function BrandStory() {
  return (
    <section className="site-section brand-story" aria-labelledby="brand-title">
      <div className="site-wrap brand-story-inner">
        <p className="brand-equation" aria-hidden="true">
          <span>PIN</span><span className="brand-plus">+</span><span>STORY</span>
        </p>
        <div className="brand-story-text">
          <h2 id="brand-title" className="section-title">핀과 이야기를 더한 이름, 피노리</h2>
          <p>핀은 지도 위의 한 점이고, 이야기는 그곳에서 있었던 일이에요. 피노리는 둘을 하나의 기록으로 묶어 사진첩이 아닌 지도에서 지난 하루를 다시 찾게 해요.</p>
        </div>
      </div>
    </section>
  )
}

export function FinalCTA() {
  return (
    <section id="download" className="site-section final-cta" aria-labelledby="download-title">
      <div className="site-wrap final-cta-inner">
        <h2 id="download-title" className="final-cta-title">모든 장소에는<br />이야기가 있습니다.</h2>
        <p className="section-lead">피노리는 Android와 iOS 앱으로 쓸 수 있어요. 오늘 지나온 곳에 첫 핀을 남겨보세요.</p>
        <AppStoreButtons primary />
        <Link className="text-link" to="/company">회사 소개 보기 <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
  )
}
