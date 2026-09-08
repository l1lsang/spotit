import { Flag, MoreHorizontal, ShieldAlert, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ReportTarget } from '../../types/moderation'
import { ReportDialog } from '../moderation/ReportButton'

interface ChatReportMenuProps {
  chatId: string
  roomTitle: string
  user?: { uid: string; nickname: string }
}

export function ChatReportMenu({ chatId, roomTitle, user }: ChatReportMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)

  function close() {
    setMenuOpen(false)
    setReportTarget(null)
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }

  function report(target: ReportTarget) {
    setMenuOpen(false)
    setReportTarget(target)
  }

  return (
    <>
      <button ref={trigger} className="button-icon subtle" type="button" aria-label="채팅방 더보기" aria-haspopup="dialog" aria-expanded={menuOpen || Boolean(reportTarget)} onClick={() => setMenuOpen(true)}>
        <MoreHorizontal size={21} aria-hidden="true" />
      </button>
      {menuOpen && (
        <RoomMenu roomTitle={roomTitle} user={user} onClose={close} onReportChat={() => report({ kind: 'chat', targetId: chatId, label: roomTitle })} onReportUser={() => { if (user) report({ kind: 'user', targetId: user.uid, label: user.nickname }) }} />
      )}
      {reportTarget && <ReportDialog target={reportTarget} onClose={close} />}
    </>
  )
}

function RoomMenu({ roomTitle, user, onClose, onReportChat, onReportUser }: {
  roomTitle: string
  user?: ChatReportMenuProps['user']
  onClose: () => void
  onReportChat: () => void
  onReportUser: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => { dialog.current?.showModal() }, [])

  return (
    <dialog ref={dialog} className="message-actions-dialog chat-room-menu" aria-labelledby={titleId} onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="message-actions-heading">
        <h2 id={titleId}>채팅방 메뉴</h2>
        <button className="button-icon" type="button" onClick={onClose} aria-label="채팅방 메뉴 닫기"><X size={18} aria-hidden="true" /></button>
      </div>
      <p className="chat-room-menu-title">{roomTitle}</p>
      <div className="chat-room-menu-actions">
        <button className="chat-room-menu-item" type="button" onClick={onReportChat}>
          <Flag size={20} aria-hidden="true" />
          <span><strong>채팅 신고</strong><small>이 대화의 내용을 신고해요</small></span>
        </button>
        {user && (
          <button className="chat-room-menu-item" type="button" onClick={onReportUser}>
            <ShieldAlert size={20} aria-hidden="true" />
            <span><strong>유저 신고</strong><small>{user.nickname}님의 계정을 신고해요</small></span>
          </button>
        )}
      </div>
    </dialog>
  )
}
