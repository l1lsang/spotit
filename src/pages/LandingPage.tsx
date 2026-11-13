import { BrandStory, FeatureHighlights, FinalCTA } from '../components/landing/LandingSections'
import { ScrollPhoneStory } from '../components/landing/ScrollPhoneStory'
import { SiteFooter } from '../components/site/SiteFooter'
import { SiteHeader } from '../components/site/SiteHeader'
import { usePageMeta } from '../hooks/usePageMeta'

export function LandingPage() {
  usePageMeta('피노리 — 지도 위에 남기는 기록 SNS',
    '피노리는 사진과 메모를 지도 위 핀으로 남기는 기록 SNS 앱입니다. 지나온 장소에 이야기를 남기고, 소중한 순간들을 다시 만나보세요.')
  return (
    <div className="site">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <ScrollPhoneStory />
        <FeatureHighlights />
        <BrandStory />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  )
}
