import { MessageCircle, Plus, RefreshCw, UsersRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { formatTimestamp } from '../lib/date'
import { createGroupChat, getOtherParticipant, subscribeToMyChats } from '../services/chatService'
import { listUsers } from '../services/userService'
import type { DaymarkChat } from '../types/chat'
import type { DaymarkUser } from '../types/user'

function isUnreadChat(chat: DaymarkChat, uid: string): boolean {
  const readAt = chat.readAtBy?.[uid]

  if (!chat.lastMessageAt || chat.lastMessageUid === uid) {
    return false
  }

  return !readAt || readAt.toMillis() < chat.lastMessageAt.toMillis()
}

export function ChatListPage() {
  const navigate = useNavigate()
  const { currentUser, firebaseReady, profile } = useAuth()
  const [chats, setChats] = useState<DaymarkChat[]>([])
  const [users, setUsers] = useState<DaymarkUser[]>([])
  const [groupName, setGroupName] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [groupError, setGroupError] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
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

  useEffect(() => {
    if (!firebaseReady || !currentUser || !isGroupModalOpen) {
      return
    }

    void listUsers()
      .then((nextUsers) => setUsers(nextUsers.filter((user) => user.uid !== currentUser.uid)))
      .catch((loadError) =>
        setGroupError(loadError instanceof Error ? loadError.message : '초대할 사람을 불러오지 못했습니다.'),
      )
  }, [currentUser, firebaseReady, isGroupModalOpen])

  function toggleSelectedUser(uid: string) {
    setSelectedUserIds((previous) => {
      const next = new Set(previous)

      if (next.has(uid)) {
        next.delete(uid)
      } else {
        next.add(uid)
      }

      return next
    })
  }

  async function handleCreateGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!profile) {
      return
    }

    const members = users.filter((user) => selectedUserIds.has(user.uid))

    setCreatingGroup(true)
    setGroupError('')

    try {
      const chatId = await createGroupChat(profile, members, groupName)
      setIsGroupModalOpen(false)
      setGroupName('')
      setSelectedUserIds(new Set())
      navigate(`/chats/${chatId}`)
    } catch (createError) {
      setGroupError(createError instanceof Error ? createError.message : '단체방을 만들지 못했습니다.')
    } finally {
      setCreatingGroup(false)
    }
  }

  return (
    <PageContainer className="content-page chat-list-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Messages</p>
          <h1>채팅</h1>
          <p>팔로우한 사람들과 장소 이야기를 이어가세요.</p>
        </div>
        <div className="page-actions">
          <button className="button button-secondary" type="button" onClick={() => setRefreshKey((key) => key + 1)}>
            <RefreshCw size={17} aria-hidden="true" />
            새로고침
          </button>
          <button className="button button-primary" type="button" onClick={() => setIsGroupModalOpen(true)}>
            <Plus size={17} aria-hidden="true" />
            단체방
          </button>
        </div>
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
            const unread = currentUser ? isUnreadChat(chat, currentUser.uid) : false
            const isGroup = chat.kind === 'group'
            const lastMessage =
              chat.lastMessageUid === currentUser?.uid && chat.lastMessage
                ? `나: ${chat.lastMessage}`
                : chat.lastMessage
            const chatTitle = isGroup ? chat.name || '단체방' : other?.nickname || '알 수 없는 사용자'
            const chatSubtitle = isGroup
              ? `${chat.participantIds.length}명 · ${lastMessage || '새 대화를 시작해 보세요.'}`
              : lastMessage || '새 대화를 시작해 보세요.'

            return (
              <Link className={`chat-row ${unread ? 'unread' : ''}`} to={`/chats/${chat.id}`} key={chat.id}>
                {isGroup ? (
                  <span className="profile-avatar small group-avatar">
                    <UsersRound size={22} aria-hidden="true" />
                  </span>
                ) : other?.photoURL ? (
                  <img className="chat-avatar" src={other.photoURL} alt={`${other.nickname} 프로필`} />
                ) : (
                  <span className="profile-avatar small">{other?.nickname.slice(0, 1) || 'D'}</span>
                )}
                <span className="chat-row-main">
                  <strong>{chatTitle}</strong>
                  <small>{chatSubtitle}</small>
                </span>
                <span className="chat-row-side">
                  <time>{formatTimestamp(chat.lastMessageAt || chat.updatedAt)}</time>
                  {unread && <i aria-label="읽지 않은 메시지" />}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {isGroupModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal group-modal" role="dialog" aria-modal="true" aria-labelledby="group-chat-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Group chat</p>
                <h2 id="group-chat-title">단체방 만들기</h2>
              </div>
              <button className="button-icon" type="button" onClick={() => setIsGroupModalOpen(false)} aria-label="닫기">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <form className="form" onSubmit={handleCreateGroup}>
              <label className="field">
                <span>방 이름</span>
                <input
                  maxLength={32}
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="예: 주말 맛집 핀 모임"
                />
              </label>

              <fieldset className="field">
                <legend>초대할 사람</legend>
                <div className="invite-list">
                  {users.map((user) => (
                    <label className="invite-row" key={user.uid}>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(user.uid)}
                        onChange={() => toggleSelectedUser(user.uid)}
                      />
                      {user.photoURL ? (
                        <img className="chat-avatar" src={user.photoURL} alt={`${user.nickname} 프로필`} />
                      ) : (
                        <span className="profile-avatar small">{user.nickname.slice(0, 1) || 'D'}</span>
                      )}
                      <span>{user.nickname}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {groupError && <p className="form-error">{groupError}</p>}

              <div className="modal-actions">
                <button className="button button-secondary" type="button" onClick={() => setIsGroupModalOpen(false)}>
                  취소
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={creatingGroup || selectedUserIds.size === 0}
                >
                  <UsersRound size={17} aria-hidden="true" />
                  {creatingGroup ? '만드는 중' : '만들기'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </PageContainer>
  )
}
