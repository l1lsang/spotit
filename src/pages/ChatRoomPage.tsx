import { ArrowLeft, SendHorizonal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { formatTimestamp } from '../lib/date'
import {
  getChatById,
  getOtherParticipant,
  sendChatMessage,
  subscribeToChatMessages,
} from '../services/chatService'
import type { DaymarkChat, ChatMessage } from '../types/chat'

export function ChatRoomPage() {
  const { chatId = '' } = useParams()
  const navigate = useNavigate()
  const { currentUser, profile, firebaseReady } = useAuth()
  const [chat, setChat] = useState<DaymarkChat | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  const loadChat = useCallback(async () => {
    if (!firebaseReady || !currentUser || !chatId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const nextChat = await getChatById(chatId, currentUser.uid)
      setChat(nextChat)

      if (!nextChat) {
        setError('참여 중인 채팅방을 찾을 수 없습니다.')
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '채팅방을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [chatId, currentUser, firebaseReady])

  useEffect(() => {
    void loadChat()
  }, [loadChat])

  useEffect(() => {
    if (!chat) {
      return undefined
    }

    return subscribeToChatMessages(
      chat.id,
      setMessages,
      (subscribeError) =>
        setError(subscribeError instanceof Error ? subscribeError.message : '메시지를 불러오지 못했습니다.'),
    )
  }, [chat])

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!chat || !profile || !content.trim()) {
      return
    }

    setSending(true)
    setError('')

    try {
      await sendChatMessage(chat.id, profile, content)
      setContent('')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '메시지 전송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <PageContainer className="content-page">
        <p className="empty-text">채팅방을 불러오는 중입니다.</p>
      </PageContainer>
    )
  }

  if (error && !chat) {
    return (
      <PageContainer className="content-page">
        <div className="empty-state">
          <h1>채팅방을 열 수 없습니다.</h1>
          <p>{error}</p>
          <button className="button button-primary" type="button" onClick={() => navigate('/chats')}>
            채팅 목록으로
          </button>
        </div>
      </PageContainer>
    )
  }

  const other = currentUser && chat ? getOtherParticipant(chat, currentUser.uid) : null

  return (
    <PageContainer className="content-page chat-room-page">
      <section className="chat-room">
        <header className="chat-room-header">
          <Link className="button-icon subtle" to="/chats" aria-label="채팅 목록으로">
            <ArrowLeft size={19} aria-hidden="true" />
          </Link>
          {other?.photoURL ? (
            <img className="chat-avatar" src={other.photoURL} alt={`${other.nickname} 프로필`} />
          ) : (
            <span className="profile-avatar small">{other?.nickname.slice(0, 1) || 'D'}</span>
          )}
          <div>
            <h1>{other?.nickname || '채팅'}</h1>
            <p>1:1 대화</p>
          </div>
        </header>

        {error && <p className="form-error">{error}</p>}

        <div className="message-list" ref={listRef}>
          {messages.length === 0 ? (
            <p className="empty-text">아직 메시지가 없습니다.</p>
          ) : (
            messages.map((message) => {
              const isMine = message.uid === currentUser?.uid

              return (
                <article className={`message-bubble ${isMine ? 'mine' : 'other'}`} key={message.id}>
                  <strong>{isMine ? '나' : message.authorNickname}</strong>
                  <p>{message.content}</p>
                  <time>{formatTimestamp(message.createdAt)}</time>
                </article>
              )
            })
          )}
        </div>

        <form className="message-form" onSubmit={handleSubmit}>
          <textarea
            rows={2}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="메시지를 입력하세요"
          />
          <button className="button button-primary" type="submit" disabled={sending || !content.trim()}>
            <SendHorizonal size={17} aria-hidden="true" />
            전송
          </button>
        </form>
      </section>
    </PageContainer>
  )
}
