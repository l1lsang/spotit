import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { setGroupMembership } from '../../services/groupService'

export function GroupJoinButton({ groupId, joined, allowLeave = false }: { groupId: string; joined: boolean; allowLeave?: boolean }) {
  const { currentUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function changeMembership() {
    if (!currentUser || busy) return
    setBusy(true)
    setError('')
    try { await setGroupMembership(groupId, currentUser.uid, !joined) }
    catch { setError('가입 상태를 변경하지 못했습니다. 다시 시도해 주세요.') }
    finally { setBusy(false) }
  }
  return (
    <div className="group-join-action">
      <button type="button" className={`button ${joined ? 'button-secondary' : 'button-primary'}`} disabled={busy || !currentUser || (joined && !allowLeave)} onClick={() => void changeMembership()}>
        {joined ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
        {busy ? '처리 중…' : joined ? allowLeave ? '그룹 탈퇴' : '가입 완료' : '바로 가입'}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
