import { MessageCircle, Plus, RefreshCw, Search, UsersRound, X } from 'lucide-react'
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
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [usersRevision, setUsersRevision] = useState(0)
  const [memberSearch, setMemberSearch] = useState('')
  const [groupName, setGroupName] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [groupError, setGroupError] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const viewerUid = currentUser?.uid
  const searchKeyword = memberSearch.trim().toLowerCase()
  const filteredUsers = users.filter((user) => !searchKeyword
    || user.nickname.toLowerCase().includes(searchKeyword)
    || user.username?.toLowerCase().includes(searchKeyword.replace(/^@/, '')))
  const selectedUsers = users.filter((user) => selectedUserIds.has(user.uid))

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
    if (!firebaseReady || !viewerUid || !isGroupModalOpen) {
      return
    }

    let active = true
    setUsersLoading(true)
    setUsersError('')
    void listUsers()
      .then((nextUsers) => {
        if (!active) return
        const candidates = nextUsers.filter((user) => user.uid !== viewerUid)
        setUsers(candidates)
        const candidateIds = new Set(candidates.map((user) => user.uid))
        setSelectedUserIds((previous) => new Set([...previous].filter((uid) => candidateIds.has(uid))))
      })
      .catch((loadError) => {
        if (active) setUsersError(loadError instanceof Error ? loadError.message : '초대할 사람을 불러오지 못했습니다.')
      })
      .finally(() => { if (active) setUsersLoading(false) })
    return () => { active = false }
  }, [viewerUid, firebaseReady, isGroupModalOpen, usersRevision])

  function handleOpenGroupModal() {
    setMemberSearch('')
    setGroupError('')
    setUsersError('')
    setUsersLoading(true)
    setIsGroupModalOpen(true)
  }

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

    if (!profile || creatingGroup || usersLoading || usersError || selectedUsers.length === 0) {
      return
    }

    setCreatingGroup(true)
    setGroupError('')

    try {
      const chatId = await createGroupChat(profile, selectedUsers, groupName)
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
          <button className="button button-primary" type="button" disabled={!firebaseReady || !profile} onClick={handleOpenGroupModal}>
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
              <button className="button-icon" type="button" disabled={creatingGroup} onClick={() => setIsGroupModalOpen(false)} aria-label="닫기">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <form className="form" onSubmit={handleCreateGroup}>
              <label className="field">
                <span>방 이름</span>
                <input
                  maxLength={32}
                  disabled={creatingGroup}
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="예: 주말 맛집 핀 모임"
                />
              </label>

              <fieldset className="field" disabled={creatingGroup}>
                <legend>초대할 사람</legend>
                <label className="invite-search">
                  <Search size={18} aria-hidden="true" />
                  <input
                    type="search"
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
                    placeholder="닉네임 또는 @사용자 이름으로 친구 검색"
                    aria-label="친구 검색"
                    aria-controls="group-chat-candidates"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="search"
                  />
                </label>
                <p className="invite-selection-count" role="status">선택한 친구 {selectedUsers.length}명</p>
                {selectedUsers.length > 0 && (
                  <ul className="invite-selected-list" aria-label="선택한 친구">
                    {selectedUsers.map((user) => (
                      <li key={user.uid}>
                        <button
                          type="button"
                          onClick={() => toggleSelectedUser(user.uid)}
                          aria-label={`${user.nickname}${user.username ? ` (@${user.username})` : ''} 선택 해제`}
                        >
                          <span>{user.nickname}</span>
                          <X size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {usersError && (
                  <div>
                    <p className="form-error" role="alert">{usersError}</p>
                    <button className="button button-secondary" type="button" onClick={() => setUsersRevision((value) => value + 1)}>
                      다시 불러오기
                    </button>
                  </div>
                )}
                <div className="invite-list" id="group-chat-candidates" aria-busy={usersLoading}>
                  {usersLoading && <p className="empty-text" role="status">친구 목록을 불러오는 중입니다.</p>}
                  {!usersLoading && !usersError && filteredUsers.length === 0 && (
                    <p className="empty-text" role="status">
                      {searchKeyword ? '검색 결과가 없습니다. 다른 닉네임이나 사용자 이름을 입력해 보세요.' : '초대할 수 있는 사람이 없습니다.'}
                    </p>
                  )}
                  {!usersLoading && !usersError && filteredUsers.map((user) => (
                    <label className={`invite-row${selectedUserIds.has(user.uid) ? ' is-selected' : ''}`} key={user.uid}>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(user.uid)}
                        onChange={() => toggleSelectedUser(user.uid)}
                      />
                      {user.photoURL ? (
                        <img className="chat-avatar" src={user.photoURL} alt="" loading="lazy" />
                      ) : (
                        <span className="profile-avatar small" aria-hidden="true">{user.nickname.slice(0, 1) || 'D'}</span>
                      )}
                      <span className="invite-identity">
                        <strong>{user.nickname}</strong>
                        {user.username && <small>@{user.username}</small>}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {groupError && <p className="form-error">{groupError}</p>}

              <div className="modal-actions">
                <button className="button button-secondary" type="button" disabled={creatingGroup} onClick={() => setIsGroupModalOpen(false)}>
                  취소
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={creatingGroup || usersLoading || Boolean(usersError) || selectedUsers.length === 0}
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
