import { ArrowLeft, ImagePlus, SendHorizonal, UserPlus, UsersRound, X } from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { formatChatDateSeparator, formatChatTime, getTimestampDateKey } from '../lib/date'
import {
  getOtherParticipant,
  addParticipantsToChat,
  getChatInviteCandidates,
  markChatAsRead,
  sendChatMessage,
  subscribeToChat,
  subscribeToChatMessages,
} from '../services/chatService'
import { uploadChatPhoto } from '../services/storageService'
import type { ChatMessage, DaymarkChat } from '../types/chat'
import type { DaymarkUser } from '../types/user'

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
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [inviteCandidates, setInviteCandidates] = useState<DaymarkUser[]>([])
  const [selectedInviteIds, setSelectedInviteIds] = useState<Set<string>>(new Set())
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [sending, setSending] = useState(false)
  const [inviting, setInviting] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const list = listRef.current

    if (!list) {
      return
    }

    list.scrollTo({
      top: list.scrollHeight,
      behavior,
    })
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    let animationFrame = 0

    function updateChatViewport() {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      animationFrame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport
        const height = viewport?.height || window.innerHeight
        const offsetTop = viewport?.offsetTop || 0
        const keyboardInset = Math.max(0, window.innerHeight - height - offsetTop)

        root.style.setProperty('--chat-viewport-height', `${height}px`)
        root.style.setProperty('--chat-viewport-offset-top', `${offsetTop}px`)
        body.classList.toggle('chat-keyboard-open', keyboardInset > 80)
        scrollMessagesToBottom()
      })
    }

    body.classList.add('chat-room-active')
    updateChatViewport()
    window.addEventListener('resize', updateChatViewport)
    window.visualViewport?.addEventListener('resize', updateChatViewport)
    window.visualViewport?.addEventListener('scroll', updateChatViewport)

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      body.classList.remove('chat-room-active')
      body.classList.remove('chat-keyboard-open')
      root.style.removeProperty('--chat-viewport-height')
      root.style.removeProperty('--chat-viewport-offset-top')
      window.removeEventListener('resize', updateChatViewport)
      window.visualViewport?.removeEventListener('resize', updateChatViewport)
      window.visualViewport?.removeEventListener('scroll', updateChatViewport)
    }
  }, [scrollMessagesToBottom])

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
    scrollMessagesToBottom('smooth')
  }, [messages, scrollMessagesToBottom])

  useEffect(() => {
    scrollMessagesToBottom()
  }, [photoPreviewUrl, scrollMessagesToBottom])

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl('')
      return undefined
    }

    const nextPreviewUrl = URL.createObjectURL(photoFile)
    setPhotoPreviewUrl(nextPreviewUrl)

    return () => URL.revokeObjectURL(nextPreviewUrl)
  }, [photoFile])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!chat || !profile || (!content.trim() && !photoFile)) {
      return
    }

    setSending(true)
    setError('')

    try {
      const photoUrl = photoFile ? await uploadChatPhoto(profile.uid, chat.id, photoFile) : ''

      await sendChatMessage(
        chat.id,
        profile,
        content,
        photoFile
          ? {
              photoUrl,
              photoName: photoFile.name,
            }
          : undefined,
      )
      setContent('')
      setPhotoFile(null)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '메시지 전송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  async function handleOpenInvite() {
    if (!chat) {
      return
    }

    setIsInviteOpen(true)
    setInviteError('')

    try {
      setInviteCandidates(await getChatInviteCandidates(chat.id))
      setSelectedInviteIds(new Set())
    } catch (loadError) {
      setInviteError(loadError instanceof Error ? loadError.message : '초대할 사람을 불러오지 못했습니다.')
    }
  }

  function toggleInviteUser(uid: string) {
    setSelectedInviteIds((previous) => {
      const next = new Set(previous)

      if (next.has(uid)) {
        next.delete(uid)
      } else {
        next.add(uid)
      }

      return next
    })
  }

  async function handleInviteMembers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!chat) {
      return
    }

    const members = inviteCandidates.filter((user) => selectedInviteIds.has(user.uid))

    setInviting(true)
    setInviteError('')

    try {
      await addParticipantsToChat(chat.id, members)
      setIsInviteOpen(false)
      setSelectedInviteIds(new Set())
    } catch (inviteErrorValue) {
      setInviteError(inviteErrorValue instanceof Error ? inviteErrorValue.message : '초대하지 못했습니다.')
    } finally {
      setInviting(false)
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
      <main className="chat-room-page">
        <section className="chat-room chat-room-state">
          <p className="empty-text">채팅방을 불러오는 중입니다.</p>
        </section>
      </main>
    )
  }

  if (error && !chat) {
    return (
      <main className="chat-room-page">
        <section className="chat-room chat-room-state">
          <div className="empty-state">
            <h1>채팅방을 열 수 없습니다.</h1>
            <p>{error}</p>
            <button className="button button-primary" type="button" onClick={() => navigate('/chats')}>
              채팅 목록으로
            </button>
          </div>
        </section>
      </main>
    )
  }

  const other = currentUser && chat ? getOtherParticipant(chat, currentUser.uid) : null
  const canSend = Boolean(content.trim() || photoFile)
  const isGroup = chat?.kind === 'group'
  const roomTitle = isGroup ? chat?.name || '단체방' : other?.nickname || '채팅'

  return (
    <main className="chat-room-page">
      <section className="chat-room">
        <header className="chat-room-header">
          <Link className="button-icon subtle" to="/chats" aria-label="채팅 목록으로">
            <ArrowLeft size={19} aria-hidden="true" />
          </Link>
          {isGroup ? (
            <span className="profile-avatar small group-avatar">
              <UsersRound size={22} aria-hidden="true" />
            </span>
          ) : other?.photoURL ? (
            <img className="chat-avatar" src={other.photoURL} alt={`${other.nickname} 프로필`} />
          ) : (
            <span className="profile-avatar small">{other?.nickname.slice(0, 1) || 'D'}</span>
          )}
          <div>
            <h1>{roomTitle}</h1>
            <p>{isGroup ? `${chat?.participantIds.length || 0}명` : '1:1 대화'}</p>
          </div>
          {isGroup && (
            <button className="button-icon subtle chat-header-action" type="button" onClick={() => void handleOpenInvite()} aria-label="초대">
              <UserPlus size={18} aria-hidden="true" />
            </button>
          )}
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
                      ((isGroup ? chat?.participants[message.uid]?.photoURL : other?.photoURL) ? (
                        <img
                          className="message-avatar"
                          src={isGroup ? chat?.participants[message.uid]?.photoURL : other?.photoURL}
                          alt={`${message.authorNickname} 프로필`}
                        />
                      ) : (
                        <span className="profile-avatar tiny">{message.authorNickname.slice(0, 1) || 'D'}</span>
                      ))}
                    <div className="message-stack">
                      {!isMine && <strong className="message-author">{message.authorNickname}</strong>}
                      {message.photoUrl && (
                        <a
                          className="message-photo-link"
                          href={message.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            className="message-photo"
                            src={message.photoUrl}
                            alt={message.photoName || '채팅 사진'}
                          />
                        </a>
                      )}
                      {message.content && <p className="message-bubble">{message.content}</p>}
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
          {photoPreviewUrl && (
            <div className="message-attachment-preview">
              <img src={photoPreviewUrl} alt={photoFile?.name || '선택한 사진'} />
              <button
                className="button-icon subtle"
                type="button"
                onClick={() => setPhotoFile(null)}
                aria-label="선택한 사진 제거"
                disabled={sending}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          )}
          <label className="button-icon subtle message-photo-picker" aria-label="사진 첨부">
            <ImagePlus size={19} aria-hidden="true" />
            <input
              type="file"
              accept="image/*"
              disabled={sending}
              onChange={(event) => {
                const selectedFile = event.target.files?.[0] || null
                setPhotoFile(selectedFile)
                event.target.value = ''
              }}
            />
          </label>
          <textarea
            rows={1}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요"
            disabled={sending}
          />
          <button
            className="button-icon message-send-button"
            type="submit"
            disabled={sending || !canSend}
            aria-label="전송"
          >
            <SendHorizonal size={17} aria-hidden="true" />
          </button>
        </form>
      </section>

      {isInviteOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal group-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Invite</p>
                <h2 id="invite-title">단체방 초대</h2>
              </div>
              <button className="button-icon" type="button" onClick={() => setIsInviteOpen(false)} aria-label="닫기">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <form className="form" onSubmit={handleInviteMembers}>
              <div className="invite-list">
                {inviteCandidates.length === 0 ? (
                  <p className="empty-text">초대할 수 있는 사람이 없습니다.</p>
                ) : (
                  inviteCandidates.map((user) => (
                    <label className="invite-row" key={user.uid}>
                      <input
                        type="checkbox"
                        checked={selectedInviteIds.has(user.uid)}
                        onChange={() => toggleInviteUser(user.uid)}
                      />
                      {user.photoURL ? (
                        <img className="chat-avatar" src={user.photoURL} alt={`${user.nickname} 프로필`} />
                      ) : (
                        <span className="profile-avatar small">{user.nickname.slice(0, 1) || 'D'}</span>
                      )}
                      <span>{user.nickname}</span>
                    </label>
                  ))
                )}
              </div>

              {inviteError && <p className="form-error">{inviteError}</p>}

              <div className="modal-actions">
                <button className="button button-secondary" type="button" onClick={() => setIsInviteOpen(false)}>
                  취소
                </button>
                <button className="button button-primary" type="submit" disabled={inviting || selectedInviteIds.size === 0}>
                  <UserPlus size={17} aria-hidden="true" />
                  {inviting ? '초대 중' : '초대하기'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
