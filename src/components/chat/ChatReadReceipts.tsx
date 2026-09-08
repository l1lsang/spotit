import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getMessageReaders } from '../../lib/chatReadReceipts'
import type { ChatMessage, ChatParticipant, DaymarkChat } from '../../types/chat'

interface ChatReadReceiptsProps {
  message: ChatMessage
  chat: DaymarkChat
  currentUid?: string
}

const previewLimit = 3

export function ChatReadReceipts({ message, chat, currentUid }: ChatReadReceiptsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const readers = getMessageReaders(message, chat)

  function close() {
    setIsOpen(false)
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }

  if (readers.length === 0 && !isOpen) {
    return message.uid === currentUid ? <span>보냄</span> : null
  }

  return (
    <>
      <button
        ref={trigger}
        className="message-read-receipts"
        type="button"
        aria-label={`읽은 사람 ${readers.length}명 보기`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={`읽은 사람 ${readers.length}명`}
        onClick={() => setIsOpen(true)}
      >
        <span className="message-reader-previews" aria-hidden="true">
          {readers.slice(0, previewLimit).map((reader) => <ReaderAvatar key={reader.uid} reader={reader} />)}
        </span>
        {readers.length > previewLimit && <span className="message-reader-overflow" aria-hidden="true">+{readers.length - previewLimit}</span>}
      </button>
      {isOpen && createPortal(
        <ReadersDialog readers={readers} currentUid={currentUid} onClose={close} />,
        document.body,
      )}
    </>
  )
}

function ReaderAvatar({ reader }: { reader: ChatParticipant }) {
  return (
    <span className="message-reader-avatar" aria-hidden="true">
      {Array.from(reader.nickname.trim())[0] || '?'}
      {reader.photoURL && <img src={reader.photoURL} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true }} />}
    </span>
  )
}

function ReadersDialog({ readers, currentUid, onClose }: {
  readers: ChatParticipant[]
  currentUid?: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => { dialog.current?.showModal() }, [])

  return (
    <dialog
      ref={dialog}
      className="message-actions-dialog message-readers-dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
      }}
    >
      <div className="message-actions-heading">
        <h2 id={titleId}>읽은 사람 <span className="message-readers-count">{readers.length}</span></h2>
        <button className="button-icon" type="button" onClick={onClose} aria-label="읽은 사람 목록 닫기">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {readers.length === 0 ? <p className="empty-text">아직 읽은 사람이 없습니다.</p> : (
        <ul className="message-readers-list">
          {readers.map((reader) => (
            <li key={reader.uid}>
              <ReaderAvatar reader={reader} />
              <span className="message-reader-name">{reader.nickname || '참여자'}</span>
              {reader.uid === currentUid && <span className="message-reader-self">나</span>}
            </li>
          ))}
        </ul>
      )}
    </dialog>
  )
}
