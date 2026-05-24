import { ArrowLeft, SendHorizonal } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { formatChatDateSeparator, formatChatTime, getTimestampDateKey } from '../lib/date'
import {
  getOtherParticipant,
  markChatAsRead,
  sendChatMessage,
  subscribeToChat,
  subscribeToChatMessages,
} from '../services/chatService'
import type { ChatMessage, DaymarkChat } from '../types/chat'

function isMessageReadByOther(message: ChatMessage, chat: DaymarkChat, currentUid: string): boolean {
  const other = getOtherParticipant(chat, currentUid)
  const otherReadAt = other ? chat.readAtBy?.[other.uid] : undefined

  if (!otherReadAt || !message.createdAt || message.uid !== currentUid) {
    return false
  }

  return otherReadAt.toMillis() >= message.createdAt.toMillis()
}

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

  useEffect(() => {
    if (!firebaseReady || !currentUser || !chatId) {
      setLoading(false)
      return undefined
    }

    setLoading(true)
    setError('')

    return subscribeToChat(
      chatId,
      currentUser.uid,
      (nextChat) => {
        setChat(nextChat)
        setLoading(false)

        if (!nextChat) {
          setError('참여 중인 채팅방을 찾을 수 없습니다.')
        }
      },
      (subscribeError) => {
        setError(subscribeError instanceof Error ? subscribeError.message : '채팅방을 불러오지 못했습니다.')
        setLoading(false)
      },
    )
  }, [chatId, currentUser, firebaseReady])

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
    if (!chat || !currentUser) {
      return
    }

    const lastMessageAt = chat.lastMessageAt
    const myReadAt = chat.readAtBy?.[currentUser.uid]

    if (lastMessageAt && (!myReadAt || myReadAt.toMillis() < lastMessageAt.toMillis())) {
      void markChatAsRead(chat.id, currentUser.uid).catch((readError) => {
        setError(readError instanceof Error ? readError.message : '읽음 상태를 저장하지 못했습니다.')
      })
    }
  }, [chat, currentUser])

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

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
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
            messages.map((message, index) => {
              const isMine = message.uid === currentUser?.uid
              const dateKey = getTimestampDateKey(message.createdAt)
              const previousDateKey = getTimestampDateKey(messages[index - 1]?.createdAt)
              const showDateSeparator = dateKey && dateKey !== previousDateKey
              const readByOther = chat && currentUser ? isMessageReadByOther(message, chat, currentUser.uid) : false

              return (
                <Fragment key={message.id}>
                  {showDateSeparator && (
                    <div className="date-separator">
                      <span>{formatChatDateSeparator(dateKey)}</span>
                    </div>
                  )}
                  <article className={`message-row ${isMine ? 'mine' : 'other'}`}>
                    {!isMine &&
                      (other?.photoURL ? (
                        <img className="message-avatar" src={other.photoURL} alt={`${other.nickname} 프로필`} />
                      ) : (
                        <span className="profile-avatar tiny">{other?.nickname.slice(0, 1) || 'D'}</span>
                      ))}
                    <div className="message-stack">
                      {!isMine && <strong className="message-author">{message.authorNickname}</strong>}
                      <p className="message-bubble">{message.content}</p>
                      <div className="message-meta">
                        {isMine && <span>{readByOther ? '읽음' : '보냄'}</span>}
                        <time>{formatChatTime(message.createdAt)}</time>
                      </div>
                    </div>
                  </article>
                </Fragment>
              )
            })
          )}
        </div>

        <form className="message-form" onSubmit={handleSubmit}>
          <textarea
            rows={2}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleKeyDown}
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
