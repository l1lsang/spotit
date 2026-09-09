import { Globe2, Lock, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { createGroup } from '../../services/groupService'
import type { GroupVisibility } from '../../types/group'

export function CreateGroupDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { currentUser } = useAuth()
  const dialog = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<GroupVisibility>('public')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentUser || busy) return
    setBusy(true)
    setError('')
    try { onCreated(await createGroup({ name, description, visibility }, currentUser.uid)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '그룹을 만들지 못했습니다.'); setBusy(false) }
  }
  return (
    <dialog ref={dialog} className="modal create-group-dialog" aria-labelledby="create-group-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
      <div className="modal-header">
        <div><p className="eyebrow">함께 만드는 장소 모음</p><h2 id="create-group-title">새 그룹 만들기</h2></div>
        <button className="button-icon" type="button" aria-label="닫기" disabled={busy} onClick={onClose}><X size={20} /></button>
      </div>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>그룹 이름</span><input autoFocus required minLength={2} maxLength={40} value={name} disabled={busy} onChange={event => setName(event.target.value)} placeholder="예: 서울의 작은 책방" /></label>
        <label className="field"><span>그룹 소개 <small>선택</small></span><textarea rows={4} maxLength={240} value={description} disabled={busy} onChange={event => setDescription(event.target.value)} placeholder="어떤 장소를 함께 모으고 싶나요?" /></label>
        <fieldset className="group-visibility" disabled={busy}>
          <legend>그룹 공개 범위</legend>
          <label className={visibility === 'public' ? 'selected' : ''}><input type="radio" name="group-visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} /><Globe2 size={20} aria-hidden="true" /><span><strong>공개 그룹</strong><small>누구나 그룹과 핀을 둘러볼 수 있어요.</small></span></label>
          <label className={visibility === 'private' ? 'selected' : ''}><input type="radio" name="group-visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} /><Lock size={20} aria-hidden="true" /><span><strong>비공개 그룹</strong><small>검색에 표시되지 않고, 멤버만 그룹과 핀을 볼 수 있어요.</small></span></label>
        </fieldset>
        <p className="group-note">공개·비공개 모두 초대코드가 있어야 가입할 수 있어요. 그룹을 만들면 자동으로 가입되고, 공유할 초대코드가 발급돼요.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={onClose}>취소</button><button className="button button-primary" disabled={busy || name.trim().length < 2}>{busy ? '만드는 중…' : '그룹 만들기'}</button></div>
      </form>
    </dialog>
  )
}
