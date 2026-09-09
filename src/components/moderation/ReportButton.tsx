import { CheckCircle2, Flag, ShieldCheck, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { REPORT_REASONS, type ReportTarget } from '../../types/moderation'
import { submitReport } from '../../services/moderationService'
import '../../styles/admin.css'

export function ReportButton({ target, compact = false, label = '신고' }: { target: ReportTarget; compact?: boolean; label?: string }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  function close() {
    setOpen(false)
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }
  return <>
    <button ref={trigger} type="button" className={compact ? 'report-compact' : 'button button-secondary'} aria-label={`${target.label} ${label}`} onClick={() => setOpen(true)}>
      <Flag size={compact ? 13 : 16} aria-hidden="true" />{label}
    </button>
    {open && <ReportDialog target={target} onClose={close} />}
  </>
}

export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const formId = useId()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const result = await submitReport(target, reason, details)
      setSuccess(result.duplicate ? '이미 접수한 신고입니다. 문의 내역에서 처리 상태를 확인할 수 있어요.' : '신고가 접수되었습니다. 검토 후 처리하겠습니다.')
    } catch (e) { setError(e instanceof Error ? e.message : '신고를 접수하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return (
    <dialog ref={dialog} className="report-dialog" onCancel={event => { event.stopPropagation(); event.preventDefault(); if (!busy) onClose() }} onClose={event => { event.stopPropagation(); onClose() }} aria-labelledby={`${formId}-title`}>
      <div className="modal-header">
        <div className="report-heading">
          <div className="moderation-heading-icon"><Flag size={22} aria-hidden="true" /></div>
          <div><p className="eyebrow">안전한 스팟잇</p><h2 id={`${formId}-title`}>{target.kind === 'photo' ? '사진' : target.kind === 'pin' ? '핀' : target.kind === 'user' ? '유저' : '채팅'} 신고</h2></div>
        </div>
        <button type="button" className="button-icon" disabled={busy} onClick={onClose} aria-label="신고 창 닫기"><X size={20} aria-hidden="true" /></button>
      </div>
      {success ? (
        <div className="report-success" role="status">
          <CheckCircle2 size={38} aria-hidden="true" />
          <p>{success}</p>
          <button className="button button-primary" type="button" onClick={onClose}>확인</button>
        </div>
      ) : (
        <form className="form" onSubmit={submit} aria-busy={busy}>
          <div className="report-target"><small>신고 대상</small><strong>{target.label}</strong></div>
          {target.kind === 'photo' && <img className="report-photo-preview" src={target.photoUrl} alt="신고할 사진" />}
          <label className="field">
            <span>신고 사유</span>
            <select required value={reason} onChange={e => setReason(e.target.value)} disabled={busy}>
              <option value="">사유를 선택해 주세요</option>
              {REPORT_REASONS.filter(r => target.kind === 'pin' || (target.kind === 'photo' && target.sourceKind === 'pin') || r.id !== 'false_place').map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>상세 내용 {reason !== 'other' && <small className="field-hint">(선택)</small>}</span>
            <textarea rows={4} maxLength={2000} required={reason === 'other'} value={details} onChange={e => setDetails(e.target.value)} disabled={busy} placeholder="어떤 문제가 있었는지 알려 주세요." aria-describedby={`${formId}-details-count`} />
            <small className="field-counter" id={`${formId}-details-count`}>{details.length.toLocaleString()} / 2,000자</small>
          </label>
          <div className="report-notice">
            <ShieldCheck size={18} aria-hidden="true" />
            <p>신고자 정보는 상대에게 공개되지 않습니다.{target.kind === 'photo' ? ' 선택한 사진의 주소, 작성자와 연결된 콘텐츠 정보가 검토를 위해 기록됩니다.' : target.kind === 'chat' ? target.messageId ? ' 선택한 메시지와 첨부 사진이 검토를 위해 전달됩니다.' : ' 최근 메시지 최대 20개와 첨부 사진이 검토를 위해 전달됩니다.' : ' 신고 당시 콘텐츠가 검토를 위해 보관됩니다.'}</p>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="report-actions">
            <button className="button button-secondary" type="button" disabled={busy} onClick={onClose}>취소</button>
            <button className="button button-primary" type="submit" disabled={busy || !reason}>{busy ? '접수 중…' : '신고 접수'}</button>
          </div>
        </form>
      )}
    </dialog>
  )
}
