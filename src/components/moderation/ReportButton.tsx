import { Flag, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { REPORT_REASONS, type ReportTarget } from '../../types/moderation'
import { submitReport } from '../../services/moderationService'
import '../../styles/admin.css'

export function ReportButton({ target, compact = false, label = '신고' }: { target: ReportTarget; compact?: boolean; label?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const result = await submitReport(target, reason, details)
      setSuccess(result.duplicate ? '이미 접수한 신고입니다. 문의 내역에서 처리 상태를 확인할 수 있어요.' : '신고가 접수되었습니다. 검토 후 처리하겠습니다.')
    } catch (e) { setError(e instanceof Error ? e.message : '신고를 접수하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <>
    <button type="button" className={compact ? 'report-compact' : 'button button-secondary'} aria-label={`${target.label} ${label}`} onClick={() => { setReason(''); setDetails(''); setError(''); setSuccess(''); setOpen(true) }}>
      <Flag size={compact ? 13 : 16} aria-hidden="true" />{label}
    </button>
    <dialog ref={dialog} className="report-dialog" onCancel={event => { if (busy) event.preventDefault(); else setOpen(false) }} onClose={() => setOpen(false)} aria-labelledby={`report-title-${target.messageId || target.targetId}`}>
      <div className="modal-header"><div><p className="eyebrow">안전한 스팟잇</p><h2 id={`report-title-${target.messageId || target.targetId}`}>{target.kind === 'pin' ? '핀' : target.kind === 'user' ? '유저' : '채팅'} 신고</h2></div><button type="button" className="button-icon" disabled={busy} onClick={() => setOpen(false)} aria-label="신고 창 닫기"><X size={20} /></button></div>
      {success ? <div className="report-success" role="status"><p>{success}</p><button className="button button-primary" onClick={() => setOpen(false)}>확인</button></div> : <form className="form" onSubmit={submit}>
        <p className="muted-label">{target.label}</p>
        <label>신고 사유<select required value={reason} onChange={e => setReason(e.target.value)} disabled={busy}><option value="">사유를 선택해 주세요</option>{REPORT_REASONS.filter(r => target.kind === 'pin' || r.id !== 'false_place').map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
        <label>상세 내용 {reason !== 'other' && '(선택)'}<textarea rows={4} maxLength={2000} required={reason === 'other'} value={details} onChange={e => setDetails(e.target.value)} disabled={busy} placeholder="어떤 문제가 있었는지 알려 주세요." /></label>
        <p className="report-notice">신고자 정보는 상대에게 공개되지 않습니다.{target.kind === 'chat' ? target.messageId ? ' 선택한 메시지와 첨부 사진이 검토를 위해 전달됩니다.' : ' 최근 메시지 최대 20개와 첨부 사진이 검토를 위해 전달됩니다.' : ' 신고 당시 콘텐츠가 검토를 위해 보관됩니다.'}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary" disabled={busy || !reason}>{busy ? '접수 중…' : '신고 접수'}</button>
      </form>}
    </dialog>
  </>
}
