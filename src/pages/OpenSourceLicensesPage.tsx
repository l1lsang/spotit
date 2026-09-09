import { ArrowLeft, ChevronDown, ExternalLink, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import licenses from '../data/openSourceLicenses.json'
import '../styles/licenses.css'

const scopeLabels: Record<string, string> = {
  app: '앱',
  server: '서버',
  development: '개발 도구',
}
const licenseTexts: Record<string, string> = licenses.texts
type LicensePackage = typeof licenses.packages[number]

function LicenseItem({ entry }: { entry: LicensePackage }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <details className="license-item" onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary>
        <span className="license-package-heading">
          <strong>{entry.name}</strong>
          <span className="license-package-meta">
            <span>v{entry.version}</span>
            <span>{entry.scopes.map(scope => scopeLabels[scope]).join(' · ')}</span>
          </span>
        </span>
        <span className="license-badge">{entry.license}</span>
        <ChevronDown className="license-chevron" size={18} aria-hidden="true" />
      </summary>
      {expanded && (
        <div className="license-item-body">
          {entry.repository.startsWith('https://') && (
            <a className="license-source-link" href={entry.repository} target="_blank" rel="noopener noreferrer">
              프로젝트 저장소 <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
          {entry.documents.map(document => (
            <section className="license-document" key={document.textId}>
              <h2>{document.title}</h2>
              {document.source.startsWith('https://') && (
                <a className="license-source-link" href={document.source} target="_blank" rel="noopener noreferrer">
                  원문 출처 <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
              <pre tabIndex={0} aria-label={`${entry.name} ${document.title} 원문`}>
                {licenseTexts[document.textId]}
              </pre>
            </section>
          ))}
        </div>
      )}
    </details>
  )
}

export function OpenSourceLicensesPage() {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')
  const keyword = query.trim().toLowerCase()
  const filteredPackages = licenses.packages.filter(entry => (
    (scope === 'all' || entry.scopes.includes(scope))
    && `${entry.name} ${entry.version} ${entry.license}`.toLowerCase().includes(keyword)
  ))

  return (
    <PageContainer className="content-page licenses-page">
      <Link className="licenses-back" to="/policies">
        <ArrowLeft size={18} aria-hidden="true" /> 약관 및 정책
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">약관 및 정책</p>
          <h1>오픈소스 라이선스</h1>
          <p>스팟잇을 만드는 데 함께한 오픈소스 프로젝트입니다.</p>
        </div>
      </section>
      <p className="licenses-description">
        앱, 서버, 개발 도구와 각 프로젝트가 사용하는 라이브러리를 포함합니다.
        항목을 누르면 저작권 고지와 라이선스 원문을 확인할 수 있습니다.
      </p>
      <div className="license-filters">
        <label className="license-search">
          <span>라이브러리 검색</span>
          <span className="license-search-input">
            <Search size={18} aria-hidden="true" />
            <input type="search" value={query} onChange={event => setQuery(event.target.value)}
              placeholder="이름 또는 라이선스로 검색" autoComplete="off" spellCheck={false} />
          </span>
        </label>
        <label className="license-scope">
          <span>사용 범위</span>
          <select value={scope} onChange={event => setScope(event.target.value)}>
            <option value="all">전체</option>
            {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <p className="license-count" role="status">
        전체 {licenses.packages.length}개 중 {filteredPackages.length}개
      </p>
      {filteredPackages.length ? (
        <div className="license-list">
          {filteredPackages.map(entry => <LicenseItem key={`${entry.name}@${entry.version}`} entry={entry} />)}
        </div>
      ) : (
        <div className="empty-state">
          <p>검색 결과가 없습니다. 검색어나 사용 범위를 바꿔 보세요.</p>
          <button className="button button-secondary" type="button" onClick={() => { setQuery(''); setScope('all') }}>
            전체 목록 보기
          </button>
        </div>
      )}
    </PageContainer>
  )
}
