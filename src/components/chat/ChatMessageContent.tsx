import { Flag, MoreHorizontal, Pin, PinOff, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createLongPress } from '../../lib/longPress'
import type { ChatMessage } from '../../types/chat'
import { ReportDialog } from '../moderation/ReportButton'

interface ChatMessageContentProps {
  message: ChatMessage
  chatId: string
  canReport: boolean
  pinned?: boolean
  onTogglePin?: () => Promise<void>
}

export function ChatMessageContent({ message, chatId, canReport, pinned = false, onTogglePin }: ChatMessageContentProps) {
  const [view, setView] = useState<'actions' | 'report' | 'photo-report' | null>(null)
  const trigger = useRef<HTMLDivElement>(null)
  const [press] = useState(() => createLongPress(() => setView('actions')))
  const canOpenMenu = canReport || Boolean(onTogglePin)

  useEffect(() => () => press.cancel(), [press])

  function close() {
    setView(null)
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }

  return (
    <>
      <div
        ref={trigger}
        className={`message-content${canOpenMenu ? ' reportable' : ''}`}
        role={canOpenMenu ? 'group' : undefined}
        tabIndex={canOpenMenu ? 0 : undefined}
        aria-label={canOpenMenu ? `${message.authorNickname}의 메시지. 길게 누르거나 Enter 키로 메시지 메뉴 열기` : undefined}
        aria-haspopup={canOpenMenu ? 'dialog' : undefined}
        onPointerDown={event => {
          if (!canOpenMenu || (event.target instanceof Element && event.target.closest('button'))) return
          if (!event.isPrimary || event.button !== 0) { press.cancel(); return }
          press.start(event.clientX, event.clientY)
        }}
        onPointerMove={event => press.move(event.clientX, event.clientY)}
        onPointerUp={press.cancel}
        onPointerCancel={press.cancel}
        onPointerLeave={press.cancel}
        onWheel={press.cancel}
        onContextMenu={event => {
          if (!canOpenMenu) return
          event.preventDefault()
          press.open()
        }}
        onClickCapture={event => {
          if (press.consumeClick()) { event.preventDefault(); event.stopPropagation() }
        }}
        onKeyDown={event => {
          if (!canOpenMenu || event.target !== event.currentTarget) return
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault()
            press.open()
          }
        }}
      >
        {canOpenMenu && <button className="message-options-button" type="button" aria-label="메시지 메뉴 열기" aria-haspopup="dialog" onClick={() => setView('actions')}><MoreHorizontal size={17} aria-hidden="true" /></button>}
        {pinned && <small className="message-pinned-label"><Pin size={12} aria-hidden="true" />고정됨</small>}
        {message.photoUrl && (
          <a className="message-photo-link" href={message.photoUrl} target="_blank" rel="noreferrer" draggable={false}>
            <img className="message-photo" src={message.photoUrl} alt={message.photoName || '채팅 사진'} draggable={false} />
          </a>
        )}
        {message.photoUrl && canReport && <button className="message-photo-report" type="button" onClick={() => setView('photo-report')}>
          <Flag size={13} aria-hidden="true" />사진 신고
        </button>}
        {message.content && <p className="message-bubble">{message.content}</p>}
      </div>
      {canOpenMenu && view === 'actions' && (
        <MessageActions message={message} onClose={close} onReport={canReport ? () => setView('report') : undefined}
          onReportPhoto={canReport && message.photoUrl ? () => setView('photo-report') : undefined} pinned={pinned} onTogglePin={onTogglePin} />
      )}
      {canReport && view === 'report' && (
        <ReportDialog target={{ kind: 'chat', targetId: chatId, messageId: message.id, label: `${message.authorNickname}의 메시지` }} onClose={close} />
      )}
      {canReport && message.photoUrl && view === 'photo-report' && (
        <ReportDialog target={{ kind: 'photo', sourceKind: 'chat', targetId: chatId, messageId: message.id, photoUrl: message.photoUrl, label: `${message.authorNickname}의 채팅 사진` }} onClose={close} />
      )}
    </>
  )
}

function MessageActions({ message, onClose, onReport, onReportPhoto, pinned, onTogglePin }: {
  message: ChatMessage; onClose: () => void; onReport?: () => void; onReportPhoto?: () => void; pinned: boolean; onTogglePin?: () => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pointerStartedHere = useRef(false)
  const titleId = useId()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const actionLock = useRef(false)
  useEffect(() => { dialog.current?.showModal() }, [])

  async function togglePin() {
    if (!onTogglePin || actionLock.current) return
    actionLock.current = true
    setSaving(true)
    setError('')
    try {
      await onTogglePin()
      onClose()
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : '고정 상태를 변경하지 못했습니다.')
    } finally {
      actionLock.current = false
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      className="message-actions-dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={onClose}
      onPointerDownCapture={() => { pointerStartedHere.current = true }}
      onClickCapture={event => {
        // Releasing the original hold must not click a newly opened menu item.
        if (event.detail > 0 && !pointerStartedHere.current) { event.preventDefault(); event.stopPropagation() }
        pointerStartedHere.current = false
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="message-actions-heading">
        <h2 id={titleId}>메시지 메뉴</h2>
        <button className="button-icon" type="button" onClick={onClose} aria-label="메시지 메뉴 닫기"><X size={18} aria-hidden="true" /></button>
      </div>
      <div className="message-actions-preview">
        <strong>{message.authorNickname}</strong>
        <p>{message.content || message.photoName || '사진 메시지'}</p>
      </div>
      {onTogglePin && <>
        <button className="message-pin-action" type="button" disabled={saving} onClick={() => void togglePin()}>
          {pinned ? <PinOff size={18} aria-hidden="true" /> : <Pin size={18} aria-hidden="true" />}{saving ? '변경 중…' : pinned ? '메시지 고정 해제' : '메시지 고정'}
        </button>
        <p className="message-pin-hint">고정한 메시지는 이 방의 모든 참여자에게 보여요.</p>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {onReport && <button className="message-report-action" type="button" onClick={onReport} disabled={saving}>
        <Flag size={18} aria-hidden="true" />이 메시지 신고
      </button>}
      {onReportPhoto && <button className="message-report-action" type="button" onClick={onReportPhoto} disabled={saving}>
        <Flag size={18} aria-hidden="true" />이 사진 신고
      </button>}
    </dialog>
  )
}
