import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { joinGroupWithCode } from '../../services/groupService'
import { isGroupInviteCode, normalizeGroupInviteCode } from '../../types/group'
import '../../styles/groups.css'

export function JoinGroupDialog({ groupId, onClose, onJoined }: { groupId?: string; onClose: () => void; onJoined: (id: string) => void }) {
  const { currentUser } = useAuth()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentUser || busy) return
    setBusy(true)
    setError('')
    try { onJoined(await joinGroupWithCode(code, currentUser.uid, groupId)) }
    catch (cause) {
      setError(cause instanceof Error && !('code' in cause) ? cause.message : '가입하지 못했습니다. 초대코드를 확인하고 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  return <dialog ref={dialog} className="modal create-group-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="modal-header"><h2 id={titleId}>초대코드로 가입</h2><button className="button-icon" type="button" aria-label="닫기" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    <form className="form" onSubmit={submit}>
      <p className="group-note">그룹 멤버에게 받은 12자리 초대코드를 입력해 주세요.</p>
      <label className="field"><span>초대코드</span><input className="group-code-input" autoFocus required autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={24} value={code} disabled={busy} onChange={event => { setCode(event.target.value); setError('') }} placeholder="ABCD-EFGH-2345" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={onClose}>취소</button><button className="button button-primary" disabled={busy || !isGroupInviteCode(normalizeGroupInviteCode(code))}>{busy ? '가입 중…' : '그룹 가입하기'}</button></div>
    </form>
  </dialog>
}
