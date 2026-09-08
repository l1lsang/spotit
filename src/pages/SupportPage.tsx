import { useCallback, useEffect, useRef, useState } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { CASE_LABELS, STATUS_LABELS, type ModerationCase } from '../types/moderation'
import { listMyCases, submitInquiry } from '../services/moderationService'

export function SupportPage() {
  const [cases, setCases] = useState<ModerationCase[]>([])
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const requestId = useRef(crypto.randomUUID())
  const refresh = useCallback(async () => {
    setLoading(true)
    try { setCases((await listMyCases()).cases) }
    catch (e) { setError(e instanceof Error ? e.message : '내역을 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('')
    try {
      await submitInquiry(title, details, requestId.current)
      requestId.current = crypto.randomUUID()
      setTitle(''); setDetails(''); setSuccess('문의가 접수되었습니다. 아래 내역에서 답변을 확인해 주세요.')
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : '문의 접수에 실패했습니다.') }
    finally { setBusy(false) }
  }
  return <PageContainer className="content-page support-page">
    <section className="page-heading"><div><p className="eyebrow">Support</p><h1>문의·신고 내역</h1><p>궁금한 점이나 불편했던 경험을 알려 주세요.</p></div></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {success && <p className="form-success" role="status">{success}</p>}
    <div className="support-layout"><section className="support-panel"><h2>문의하기</h2><form className="form" onSubmit={submit}>
      <label>제목<input required maxLength={100} value={title} onChange={e => setTitle(e.target.value)} disabled={busy} placeholder="어떤 도움이 필요하세요?" /></label>
      <label>문의 내용<textarea required maxLength={2000} rows={7} value={details} onChange={e => setDetails(e.target.value)} disabled={busy} placeholder="상황을 자세히 적어 주시면 확인에 도움이 됩니다." /></label>
      <button className="button button-primary" disabled={busy || !title.trim() || !details.trim()}>{busy ? '접수 중…' : '문의 보내기'}</button>
    </form></section><section className="support-panel"><div className="admin-row"><h2>내 접수 내역</h2><button className="button button-secondary" onClick={() => { setError(''); void refresh() }} disabled={loading}>새로고침</button></div>
      {loading ? <p className="empty-text">내역을 불러오는 중…</p> : cases.length === 0 ? <p className="empty-text">아직 접수한 문의나 신고가 없어요.</p> : cases.map(item => <article className="support-case" key={item.id}><div className="admin-row"><small>{CASE_LABELS[item.kind]} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}</small><span className={`case-badge ${item.status}`}>{STATUS_LABELS[item.status]}</span></div><h3>{item.title}</h3>{item.details && <p className="preserve-text">{item.details}</p>}{item.reply && <div className="support-reply"><strong>스팟잇 답변</strong><p className="preserve-text">{item.reply}</p></div>}</article>)}
    </section></div>
  </PageContainer>
}
