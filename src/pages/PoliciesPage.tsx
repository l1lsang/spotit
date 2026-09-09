import { ArrowLeft, ChevronRight, ExternalLink, Phone, Printer } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { policies, policyOperator, policyPublication, type PolicySection } from '../data/policies'
import { policyNavigation } from '../lib/policyNavigation'
import '../styles/policies.css'

function Section({ section }: { section: PolicySection }) {
  return (
    <section className="policy-section" id={section.id} aria-labelledby={`${section.id}-title`}>
      <h2 id={`${section.id}-title`}>{section.title}</h2>
      {section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      {section.bullets && <ul>{section.bullets.map(item => <li key={item}>{item}</li>)}</ul>}
      {section.table && (
        <div className="policy-table-scroll" tabIndex={0} role="region" aria-label={section.table.caption}>
          <table>
            <caption>{section.table.caption}</caption>
            <thead><tr>{section.table.headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead>
            <tbody>{section.table.rows.map(row => (
              <tr key={row[0]}>{row.map((cell, index) => index === 0
                ? <th key={index} scope="row">{cell}</th> : <td key={index}>{cell}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {section.note && <p className="policy-section-note"><strong>시행 전 확인</strong>{section.note}</p>}
      {section.links && <ul className="policy-related-links">{section.links.map(link => (
        <li key={link.href}>{link.href.startsWith('/')
          ? <Link to={link.href}>{link.label}<ChevronRight size={14} aria-hidden="true" /></Link>
          : <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<ExternalLink size={14} aria-hidden="true" /></a>}
        </li>
      ))}</ul>}
    </section>
  )
}

export function PoliciesPage() {
  const { policyId } = useParams()
  const location = useLocation()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const selected = policyNavigation.find(item => item.id === policyId)
  const document = selected ? policies[selected.id] : null
  const title = selected?.title || (policyId ? '문서를 찾을 수 없습니다' : '약관 및 정책')

  useEffect(() => {
    const previousTitle = window.document.title
    window.document.title = `${title} | 스팟잇`
    if (!location.hash) {
      window.scrollTo(0, 0)
      headingRef.current?.focus({ preventScroll: true })
    } else {
      const target = window.document.getElementById(location.hash.slice(1))
      target?.scrollIntoView()
    }
    return () => { window.document.title = previousTitle }
  }, [title, location.hash])

  return (
    <PageContainer className="content-page policies-page">
      <Link className="policy-back" to={policyId ? '/policies' : '/profile/settings'}>
        <ArrowLeft size={18} aria-hidden="true" />{policyId ? '약관 및 정책' : '설정으로 돌아가기'}
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">스팟잇 · 이용 안내</p>
          <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
        </div>
        {document && <button className="button button-secondary policy-print" type="button" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />인쇄
        </button>}
      </div>
      {policyId && !document ? (
        <div className="empty-state"><p>주소를 확인하거나 약관 및 정책 목록에서 문서를 선택해 주세요.</p><Link to="/policies">목록 보기</Link></div>
      ) : (
        <>
          <aside className="policy-draft-notice" aria-label="문서 개정 안내">
            <strong>약관 및 개인정보처리방침 개정 안내</strong>
            <p>만 14세 미만 가입 제한, 가입 시 필수·선택 동의, 개인정보 보관·파기와 Firebase 미국 서버로의 국외이전 기준을 안내합니다.</p>
            <small>작성일 {policyPublication.preparedAt} · 시행일 {policyPublication.effectiveDate} · {policyPublication.version}</small>
          </aside>
          {document ? (
            <>
              <p className="policy-introduction">{document.introduction}</p>
              <nav className="policy-toc" aria-label={`${title} 목차`}>
                <h2>목차</h2>
                <ol>{document.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
              </nav>
              <article className="policy-document" aria-label={title}>
                {document.sections.map(section => <Section key={section.id} section={section} />)}
              </article>
              <nav className="policy-other-documents" aria-label="다른 약관 및 정책">
                {policyNavigation.filter(item => item.id !== policyId).map(item => <Link key={item.id} to={`/policies/${item.id}`}>{item.title}</Link>)}
                <Link to="/licenses">오픈소스 라이선스</Link>
              </nav>
            </>
          ) : (
            <>
              <p className="policy-introduction">서비스 이용 기준과 개인정보·위치정보 보호에 관한 문서를 한곳에서 확인하세요.</p>
              <nav className="policy-directory" aria-label="약관 및 정책 목록">
                {policyNavigation.map(item => <Link to={`/policies/${item.id}`} key={item.id}>
                  <span><strong>{item.title}</strong><small>{item.description}</small></span><ChevronRight size={18} aria-hidden="true" />
                </Link>)}
                <Link to="/licenses"><span><strong>오픈소스 라이선스</strong><small>함께 사용한 오픈소스와 라이선스 고지</small></span><ChevronRight size={18} aria-hidden="true" /></Link>
              </nav>
              <section className="policy-contact" aria-labelledby="policy-contact-title">
                <h2 id="policy-contact-title">운영자 연락처</h2>
                <p>{policyOperator.name} · {policyOperator.address}</p>
                <a href={policyOperator.phoneHref}><Phone size={16} aria-hidden="true" />{policyOperator.phone}</a>
              </section>
            </>
          )}
        </>
      )}
    </PageContainer>
  )
}
