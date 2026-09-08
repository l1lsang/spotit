import { Flag, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createLongPress } from '../../lib/longPress'
import type { ChatMessage } from '../../types/chat'
import { ReportDialog } from '../moderation/ReportButton'

export function ChatMessageContent({ message, chatId, canReport }: { message: ChatMessage; chatId: string; canReport: boolean }) {
  const [view, setView] = useState<'actions' | 'report' | null>(null)
  const trigger = useRef<HTMLDivElement>(null)
  const [press] = useState(() => createLongPress(() => setView('actions')))

  useEffect(() => () => press.cancel(), [press])

  function close() {
    setView(null)
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }

  return (
    <>
      <div
        ref={trigger}
        className={`message-content${canReport ? ' reportable' : ''}`}
        role={canReport ? 'group' : undefined}
        tabIndex={canReport ? 0 : undefined}
        aria-label={canReport ? `${message.authorNickname}의 메시지. 길게 누르거나 Enter 키로 메시지 메뉴 열기` : undefined}
        aria-haspopup={canReport ? 'dialog' : undefined}
        onPointerDown={event => {
          if (!canReport) return
          if (!event.isPrimary || event.button !== 0) { press.cancel(); return }
          press.start(event.clientX, event.clientY)
        }}
        onPointerMove={event => press.move(event.clientX, event.clientY)}
        onPointerUp={press.cancel}
        onPointerCancel={press.cancel}
        onPointerLeave={press.cancel}
        onWheel={press.cancel}
        onContextMenu={event => {
          if (!canReport) return
          event.preventDefault()
          press.open()
        }}
        onClickCapture={event => {
          if (press.consumeClick()) { event.preventDefault(); event.stopPropagation() }
        }}
        onKeyDown={event => {
          if (!canReport || event.target !== event.currentTarget) return
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault()
            press.open()
          }
        }}
      >
        {message.photoUrl && (
          <a className="message-photo-link" href={message.photoUrl} target="_blank" rel="noreferrer" draggable={false}>
            <img className="message-photo" src={message.photoUrl} alt={message.photoName || '채팅 사진'} draggable={false} />
          </a>
        )}
        {message.content && <p className="message-bubble">{message.content}</p>}
      </div>
      {canReport && view === 'actions' && (
        <MessageActions message={message} onClose={close} onReport={() => setView('report')} />
      )}
      {canReport && view === 'report' && (
        <ReportDialog target={{ kind: 'chat', targetId: chatId, messageId: message.id, label: `${message.authorNickname}의 메시지` }} onClose={close} />
      )}
    </>
  )
}

function MessageActions({ message, onClose, onReport }: { message: ChatMessage; onClose: () => void; onReport: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pointerStartedHere = useRef(false)
  const titleId = useId()
  useEffect(() => { dialog.current?.showModal() }, [])

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
      <button className="message-report-action" type="button" onClick={onReport}>
        <Flag size={18} aria-hidden="true" />이 메시지 신고
      </button>
    </dialog>
  )
}
