import { MessageCircle, Plus, UsersRound, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type RefObject } from 'react'

interface NewChatFabProps {
  buttonRef: RefObject<HTMLButtonElement | null>
  onGroup: () => void
  onDirect: () => void
}

const ACTIONS = [
  { key: 'group', title: '단체방', description: '여러 친구를 초대해 함께 대화', Icon: UsersRound },
  { key: 'direct', title: '1:1 채팅', description: '친구 한 명과 바로 대화', Icon: MessageCircle },
] as const

export function NewChatFab({ buttonRef, onGroup, onDirect }: NewChatFabProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const firstActionRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    firstActionRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, buttonRef])

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function choose(key: (typeof ACTIONS)[number]['key']) {
    setOpen(false)
    if (key === 'group') onGroup()
    else onDirect()
  }

  return (
    <>
      {open && <div className="new-chat-backdrop" role="presentation" onClick={close} />}
      <div className="new-chat-fab-area">
        {open && (
          <ul className="new-chat-actions" id={menuId} aria-label="새 채팅 종류">
            {ACTIONS.map(({ key, title, description, Icon }, index) => (
              <li key={key}>
                <button ref={index === 0 ? firstActionRef : undefined} className="new-chat-action" type="button" onClick={() => choose(key)}>
                  <span className="new-chat-action-label">
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  <span className="new-chat-action-icon" aria-hidden="true"><Icon size={22} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          ref={buttonRef}
          className="new-chat-fab"
          type="button"
          aria-label={open ? '새 채팅 메뉴 닫기' : '새 채팅'}
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => (open ? close() : setOpen(true))}
        >
          {open ? <X size={26} aria-hidden="true" /> : <Plus size={26} aria-hidden="true" />}
        </button>
      </div>
    </>
  )
}
