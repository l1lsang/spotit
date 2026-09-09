import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Images, Pin, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { formatTimestamp } from '../../lib/date'
import type { ChatMessage } from '../../types/chat'

interface ChatCollectionDialogProps {
  kind: 'pins' | 'media'
  messages: ChatMessage[]
  loading: boolean
  error: string
  onClose: () => void
  onJump: (messageId: string) => void
  onRetry: () => void
}

export function ChatCollectionDialog({ kind, messages, loading, error, onClose, onJump, onRetry }: ChatCollectionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIndex = messages.findIndex(message => message.id === selectedId)
  const selected = kind === 'media' ? messages[selectedIndex] : undefined
  const title = kind === 'pins' ? '고정 메시지' : '미디어 모아보기'

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return <dialog ref={dialogRef} className="chat-collection-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <header className="chat-collection-header">
      <div>{selected && <button className="button-icon subtle" type="button" onClick={() => setSelectedId(null)} aria-label="사진 목록으로"><ArrowLeft size={20} aria-hidden="true" /></button>}
        <h2 id={titleId}>{kind === 'pins' ? <Pin size={19} aria-hidden="true" /> : <Images size={19} aria-hidden="true" />}{title}<span>{messages.length}</span></h2>
      </div>
      <button className="button-icon subtle" type="button" onClick={onClose} aria-label={`${title} 닫기`}><X size={20} aria-hidden="true" /></button>
    </header>
    <div className={`chat-collection-body${selected ? ' viewing-photo' : ''}`}>
      {loading && <p className="chat-collection-empty" role="status">대화를 불러오는 중입니다.</p>}
      {error && <div className="chat-collection-empty" role="alert"><p>{error}</p><button className="button button-secondary" type="button" onClick={onRetry}>다시 시도</button></div>}
      {!loading && !error && (selected ? <>
        <div className="chat-media-viewer"><img src={selected.photoUrl} alt={selected.photoName || `${selected.authorNickname}님이 보낸 사진`} /></div>
        <div className="chat-media-details"><strong>{selected.authorNickname}</strong><time>{formatTimestamp(selected.createdAt)}</time>{selected.content && <p>{selected.content}</p>}</div>
      </> : messages.length === 0 ? <div className="chat-collection-empty">
        {kind === 'pins' ? <Pin size={30} aria-hidden="true" /> : <Images size={30} aria-hidden="true" />}
        <p>{kind === 'pins' ? '아직 고정한 메시지가 없습니다.' : '아직 주고받은 사진이 없습니다.'}</p>
        {kind === 'pins' && <small>메시지를 길게 누르거나 옆의 ··· 메뉴에서 고정해 보세요.</small>}
      </div> : kind === 'media' ? <div className="chat-media-grid">
        {messages.map(message => <button key={message.id} className="chat-media-tile" type="button" onClick={() => setSelectedId(message.id)}
          aria-label={`${message.authorNickname} · ${formatTimestamp(message.createdAt)} 사진 보기`}>
          <img src={message.photoUrl} alt="" loading="lazy" />
        </button>)}
      </div> : <div className="chat-pinned-list">
        <p className="chat-collection-hint">참여자 모두에게 공유된 메시지입니다. 누르면 해당 대화로 이동해요.</p>
        {messages.map(message => <button key={message.id} className="chat-pinned-item" type="button" onClick={() => onJump(message.id)}>
          {message.photoUrl && <img src={message.photoUrl} alt="" loading="lazy" />}
          <span><strong>{message.authorNickname}</strong><span>{message.content || message.photoName || '사진 메시지'}</span><time>{formatTimestamp(message.createdAt)}</time></span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>)}
      </div>)}
    </div>
    {selected && !loading && !error && <footer className="chat-media-footer">
      <div className="chat-media-navigation">
        <button className="button-icon subtle" type="button" disabled={selectedIndex <= 0} onClick={() => setSelectedId(messages[selectedIndex - 1].id)} aria-label="이전 사진"><ChevronLeft size={20} aria-hidden="true" /></button>
        <span>{selectedIndex + 1} / {messages.length}</span>
        <button className="button-icon subtle" type="button" disabled={selectedIndex >= messages.length - 1} onClick={() => setSelectedId(messages[selectedIndex + 1].id)} aria-label="다음 사진"><ChevronRight size={20} aria-hidden="true" /></button>
      </div>
      <button className="button button-secondary" type="button" onClick={() => onJump(selected.id)}><ArrowUpRight size={16} aria-hidden="true" />대화로 이동</button>
    </footer>}
  </dialog>
}
