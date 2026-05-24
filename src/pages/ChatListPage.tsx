import { MessageCircle, RefreshCw, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { formatTimestamp } from '../lib/date'
import { getOtherParticipant, subscribeToMyChats } from '../services/chatService'
import type { DaymarkChat } from '../types/chat'

export function ChatListPage() {
  const { currentUser, firebaseReady } = useAuth()
  const [chats, setChats] = useState<DaymarkChat[]>([])
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!firebaseReady || !currentUser) {
      return undefined
    }

    return subscribeToMyChats(
      currentUser.uid,
      setChats,
      (subscribeError) =>
        setError(subscribeError instanceof Error ? subscribeError.message : '채팅 목록을 불러오지 못했습니다.'),
    )
  }, [currentUser, firebaseReady, refreshKey])

  return (
    <PageContainer className="content-page chat-list-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Messages</p>
          <h1>채팅</h1>
          <p>팔로우한 사람들과 장소 이야기를 이어가세요.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => setRefreshKey((key) => key + 1)}>
          <RefreshCw size={17} aria-hidden="true" />
          새로고침
        </button>
      </section>

      {error && <p className="form-error">{error}</p>}

      {chats.length === 0 ? (
        <div className="empty-state">
          <MessageCircle size={34} aria-hidden="true" />
          <h2>아직 채팅이 없습니다.</h2>
          <p>사람 찾기에서 대화를 시작해 보세요.</p>
          <Link className="button button-primary" to="/people">
            <UsersRound size={17} aria-hidden="true" />
            사람 찾기
          </Link>
        </div>
      ) : (
        <div className="chat-list">
          {chats.map((chat) => {
            const other = currentUser ? getOtherParticipant(chat, currentUser.uid) : null

            return (
              <Link className="chat-row" to={`/chats/${chat.id}`} key={chat.id}>
                {other?.photoURL ? (
                  <img className="chat-avatar" src={other.photoURL} alt={`${other.nickname} 프로필`} />
                ) : (
                  <span className="profile-avatar small">{other?.nickname.slice(0, 1) || 'D'}</span>
                )}
                <span className="chat-row-main">
                  <strong>{other?.nickname || '알 수 없는 사용자'}</strong>
                  <small>{chat.lastMessage || '새 대화를 시작해 보세요.'}</small>
                </span>
                <time>{formatTimestamp(chat.lastMessageAt || chat.updatedAt)}</time>
              </Link>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
