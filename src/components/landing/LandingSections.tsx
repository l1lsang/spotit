import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { features } from '../../data/showcase'
import { AppStoreButtons } from '../layout/AppStoreButtons'
import { PhoneMockup, PhoneScreenImage } from '../site/PhoneMockup'

gsap.registerPlugin(ScrollTrigger)

export function FeatureHighlights() {
  const gridRef = useRef<HTMLDivElement>(null)

  // A short, one-time entrance for the three cards (none under reduced motion).
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const ctx = gsap.context(() => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(grid.children, {
          y: 32, autoAlpha: 0, duration: 0.7, ease: 'power2.out', stagger: 0.09,
          scrollTrigger: { trigger: grid, start: 'top 82%', once: true },
        })
      })
    }, grid)
    return () => ctx.revert()
  }, [])

  return (
    <section id="features" className="site-section features" aria-labelledby="features-title">
      <div className="site-wrap">
        <h2 id="features-title" className="section-title">기록하고, 함께 모으고, 지금을 나눠요</h2>
        <p className="section-lead">피드, 그룹, 실시간 리뷰는 지금 피노리 앱에서 바로 쓸 수 있어요.</p>
        <div ref={gridRef} className="feature-grid">
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
    <section id="brand" className="site-section brand-story" aria-labelledby="brand-title">
      <div className="site-wrap brand-story-inner">
        <div className="brand-mark-block">
          <p className="brand-equation" aria-hidden="true">
            <span>PIN</span><span className="brand-plus">+</span><span>STORY</span>
          </p>
          <p className="brand-meaning">PIN(지도 핀)과 STORY(이야기)를 더해 PINORI.</p>
        </div>
        <div className="brand-story-text">
          <h2 id="brand-title" className="section-title">모든 장소에는 이야기가 있습니다.</h2>
          <p>우리는 수많은 장소를 지나며 살아갑니다.</p>
          <p>어떤 장소는 평범한 하루였고,<br />어떤 장소는 오래 기억하고 싶은 순간이었습니다.</p>
          <p>피노리는 그 순간들이 사라지지 않도록<br />당신의 이야기를 지도 위에 남깁니다.</p>
        </div>
      </div>
    </section>
  )
}

export function FinalCTA() {
  return (
    <section id="download" className="site-section final-cta" aria-labelledby="download-title">
      <div className="site-wrap final-cta-inner">
        <h2 id="download-title" className="final-cta-title">오늘 지나온 곳에,<br />첫 번째 핀을 남겨보세요.</h2>
        <p className="section-lead">피노리는 Google Play와 App Store에서 내려받을 수 있어요.</p>
        <AppStoreButtons primary />
        <Link className="text-link" to="/company">회사 소개 보기 <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
  )
}
