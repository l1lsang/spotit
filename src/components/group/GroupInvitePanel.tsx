import { Copy, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getGroupInviteCode } from '../../services/groupService'

export function GroupInvitePanel({ groupId }: { groupId: string }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setCode('')
    setError('')
    void getGroupInviteCode(groupId).then(next => { if (!cancelled) setCode(next) }, () => {
      if (!cancelled) setError('초대코드를 불러오지 못했습니다.')
    })
    return () => { cancelled = true }
  }, [groupId, revision])

  async function copy() {
    try { await navigator.clipboard.writeText(code); setMessage('초대코드를 복사했습니다.') }
    catch { setMessage('복사하지 못했습니다. 표시된 코드를 선택해서 복사해 주세요.') }
  }

  return <div className="group-invite-panel">
    <div><strong><KeyRound size={17} aria-hidden="true" />그룹 초대코드</strong><p className="group-note">함께할 사람에게 이 코드를 알려주세요. 그룹 페이지에서 코드로 가입할 수 있어요.</p></div>
    {code && <div className="group-invite-code"><code>{code.match(/.{4}/g)?.join('-')}</code><button className="button button-secondary" type="button" onClick={() => void copy()}><Copy size={16} aria-hidden="true" />코드 복사</button></div>}
    {!code && !error && <p role="status">초대코드를 불러오는 중…</p>}
    {error && <p className="form-error" role="alert">{error} <button className="button button-secondary" type="button" onClick={() => setRevision(value => value + 1)}>다시 시도</button></p>}
    {message && <p className="group-note" role="status">{message}</p>}
  </div>
}
