import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppStoreButtons } from '../components/layout/AppStoreButtons'
import { PhoneMockup, PhoneScreenImage } from '../components/site/PhoneMockup'
import { SiteFooter } from '../components/site/SiteFooter'
import { SiteHeader } from '../components/site/SiteHeader'
import { policyOperator } from '../data/policies'
import { screens } from '../data/showcase'
import { usePageMeta } from '../hooks/usePageMeta'
import '../styles/company.css'

// Only facts that can be checked go on this page: no user counts, revenue, funding or market figures.
// TODO(운영자): 확인된 자료가 생기면 아래 "검증과 로드맵" 섹션의 상태 카드를 실제 내용으로 바꾸세요.
//   - 조사·사용자 검증 결과 (설문·인터뷰 수치는 실제 결과와 출처만)
//   - 개발 로드맵 (공개해도 되는 일정만)
//   - 팀 구성원 소개 (본인 동의를 받은 이름과 역할만)
//   - 제휴 문의 이메일 (생기면 아래 contact 섹션의 링크를 mailto:로 바꾸세요)

const solutions = [
  { title: '사진 위치로 장소 찾기', body: '사진의 촬영 위치와 날짜를 읽어 핀을 찍을 장소를 먼저 제안해요.' },
  { title: '색과 테마가 있는 핀', body: '핀 색상, 밝기, 테마를 골라 지도에서 내 기록을 한눈에 구분해요.' },
  { title: '공개 범위가 있는 피드', body: '기록마다 팔로워, 전체, 비공개를 정하고 팔로우한 사람의 기록을 피드와 지도에서 봐요.' },
  { title: '그룹과 실시간 리뷰', body: '그룹 지도에 함께 핀을 모으고, 장소마다 지금의 분위기를 리뷰로 남겨요.' },
]

// Qualitative comparison by category only: no competitor names, no figures.
const differentiation = {
  columns: ['사진첩', '장소 추천·리뷰 앱', '피노리'],
  rows: [
    { label: '정리 기준', values: ['찍은 날짜', '장소의 평점과 정보', '내가 머문 장소'] },
    { label: '남는 것', values: ['사진', '다른 사람의 평가', '사진, 메모, 그날의 마음'] },
    { label: '다시 찾는 방법', values: ['날짜를 거슬러 스크롤', '장소를 검색', '지도 위의 내 핀'] },
    { label: '함께 나누기', values: ['파일로 따로 공유', '공개 리뷰', '공개 범위를 고른 기록, 그룹 지도'] },
  ],
}

export function CompanyPage() {
  usePageMeta('회사 소개 — 피노리',
    '피노리는 사진과 이야기를 장소에 연결하는 지도 기반 기록 SNS입니다. 서비스 비전, 해결하려는 문제와 제품을 소개합니다.')
  return (
    <div className="site">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="company">
        <section className="site-section company-hero" aria-labelledby="company-title" data-enter>
          <div className="site-wrap">
            <h1 id="company-title" className="company-title">장소에 이야기를 남기는<br />지도 기록 SNS, 피노리</h1>
            <p className="company-lead">피노리는 사람들이 지나온 장소와 그곳에서의 장면을 하나의 기록으로 잇습니다. 사진첩의 날짜 대신 지도 위의 장소로 지난 하루를 다시 찾게 하는 것이 우리의 목표예요.</p>
            <dl className="company-facts">
              <div><dt>서비스</dt><dd>지도 기반 기록 SNS</dd></div>
              <div><dt>출시</dt><dd>Google Play, App Store</dd></div>
              <div><dt>이름</dt><dd>PIN(지도 핀) + STORY(이야기)</dd></div>
            </dl>
          </div>
        </section>

        <section className="site-section company-problem" aria-labelledby="problem-title">
          <div className="site-wrap company-split">
            <h2 id="problem-title" className="section-title">사진과 장소가 따로 남는 문제</h2>
            <div className="company-prose">
              <p>휴대폰 사진첩에는 사진이 날짜순으로만 쌓여, 그곳이 어디였고 어떤 마음이었는지 다시 찾기 어려워요.</p>
              <p>장소 앱은 평점과 추천을 모으지만, 한 사람이 그 장소에서 보낸 시간은 담지 않아요. 피노리는 이 둘 사이의 빈자리에서 시작했어요.</p>
            </div>
          </div>
        </section>

        <section className="site-section company-solution" aria-labelledby="solution-title">
          <div className="site-wrap">
            <h2 id="solution-title" className="section-title">지도에 남기는 사진과 메모</h2>
            <p className="section-lead">피노리 앱에서 지금 쓸 수 있는 기능이에요.</p>
            <ul className="solution-list">
              {solutions.map((item, index) => (
                <li key={item.title}>
                  <span className="solution-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="site-section company-product" aria-labelledby="product-title">
          <div className="site-wrap">
            <h2 id="product-title" className="section-title">Android와 iOS에 출시한 앱</h2>
            <p className="section-lead">웹은 소개와 공유 링크를 맡고, 기록은 모두 모바일 앱에서 이뤄져요.</p>
            <div className="product-phones">
              {[screens.home, screens.details, screens.reviews].map(screen => (
                <PhoneMockup key={screen.id} className="product-phone"><PhoneScreenImage screen={screen} /></PhoneMockup>
              ))}
            </div>
            <AppStoreButtons />
          </div>
        </section>

        <section className="site-section company-diff" aria-labelledby="diff-title">
          <div className="site-wrap">
            <h2 id="diff-title" className="section-title">사진첩, 장소 앱과 다른 점</h2>
            <p className="section-lead">같은 사진과 장소를 다루지만, 무엇을 기준으로 남기고 다시 찾는지가 달라요.</p>
            <div className="diff-table" role="table" aria-label="사진첩, 장소 추천·리뷰 앱, 피노리 비교">
              <div className="diff-row diff-head" role="row">
                <span role="columnheader">구분</span>
                {differentiation.columns.map(column => <span key={column} role="columnheader">{column}</span>)}
              </div>
              {differentiation.rows.map(row => (
                <div key={row.label} className="diff-row" role="row">
                  <span role="rowheader">{row.label}</span>
                  {row.values.map((value, index) => <span key={index} role="cell" data-col={differentiation.columns[index]} data-ours={index === 2 || undefined}>{value}</span>)}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section company-status" aria-labelledby="status-title">
          <div className="site-wrap">
            <h2 id="status-title" className="section-title">검증과 로드맵</h2>
            <p className="section-lead">수치와 일정은 확인된 자료만 공개합니다. 아직 정리되지 않은 항목은 상태를 그대로 표시해요.</p>
            <div className="status-grid">
              <article className="status-card">
                <p className="status-badge">자료 정리 중</p>
                <h3>사용자 검증</h3>
                <p>설문과 인터뷰, 테스트 사용 결과를 정리하고 있어요. 검증 가능한 결과가 준비되면 이곳에 출처와 함께 공개합니다.</p>
              </article>
              <article className="status-card">
                <p className="status-badge">확정 후 공개</p>
                <h3>개발 로드맵</h3>
                <p>지금은 Android와 iOS 앱을 운영하며 기록, 피드, 그룹, 실시간 리뷰를 다듬고 있어요. 다음 단계는 일정이 확정되면 공개합니다.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="site-section company-contact" aria-labelledby="contact-title">
          <div className="site-wrap company-split">
            <h2 id="contact-title" className="section-title">팀과 제휴 문의</h2>
            <div className="company-prose">
              <p>피노리는 운영자 {policyOperator.name}이 만들고 운영합니다. 제휴, 투자, 협업 제안은 운영자 연락처로 받고 있어요.</p>
              <Link className="button button-primary" to="/policies/privacy#contact">운영자 연락처 보기 <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
