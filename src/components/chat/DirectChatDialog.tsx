import { ChevronRight, Info, RefreshCw, Search, UsersRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { filterChatCandidates } from '../../lib/chatCandidates'
import type { DaymarkUser } from '../../types/user'

interface DirectChatDialogProps {
  users: DaymarkUser[]
  loading: boolean
  error: string
  chattingUids: Set<string>
  onRetry: () => void
  onStart: (user: DaymarkUser) => Promise<void>
  onClose: () => void
  onCreateGroup: () => void
}

export function DirectChatDialog({
  users,
  loading,
  error,
  chattingUids,
  onRetry,
  onStart,
  onClose,
  onCreateGroup,
}: DirectChatDialogProps) {
  const [search, setSearch] = useState('')
  const [pendingUid, setPendingUid] = useState('')
  const [startError, setStartError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const pending = Boolean(pendingUid)
  const keyword = search.trim()
  const candidates = filterChatCandidates(users, search)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleStart(user: DaymarkUser) {
    if (pendingUid) return
    setPendingUid(user.uid)
    setStartError('')
    try {
      await onStart(user)
    } catch (openError) {
      setStartError(openError instanceof Error ? openError.message : '채팅을 열지 못했어요. 다시 시도해 주세요.')
      setPendingUid('')
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={(event) => {
      if (event.target === event.currentTarget && !pending) onClose()
    }}>
      <section
        className="modal group-modal direct-chat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="direct-chat-title"
        aria-busy={pending}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !pending) {
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Direct message</p>
            <h2 id="direct-chat-title">1:1 채팅 시작</h2>
          </div>
          <button className="button-icon" type="button" disabled={pending} onClick={onClose} aria-label="닫기">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="direct-chat-body">
          <div className="field">
            <label className="invite-search">
              <Search size={18} aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={search}
                disabled={pending}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="닉네임 또는 @사용자 이름으로 검색"
                aria-label="대화할 사람 검색"
                aria-controls="direct-chat-candidates"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
              />
            </label>
          </div>

          {!loading && !error && (
            <p className="direct-chat-count" role="status">
              {keyword ? `검색 결과 ${candidates.length}명` : `팔로잉 ${users.length}명`}
            </p>
          )}

          {error && (
            <div className="direct-chat-state" role="alert">
              <p className="form-error">{error}</p>
              <button className="button button-secondary" type="button" onClick={onRetry}>
                <RefreshCw size={17} aria-hidden="true" />다시 불러오기
              </button>
            </div>
          )}

          <div className="direct-chat-list" id="direct-chat-candidates" aria-busy={loading}>
            {loading && <p className="empty-text" role="status">팔로잉 목록을 불러오는 중이에요.</p>}
            {!loading && !error && candidates.length === 0 && (keyword ? (
              <p className="empty-text" role="status">검색 결과가 없어요. 다른 닉네임이나 사용자 이름을 입력해 보세요.</p>
            ) : (
              <div className="direct-chat-state" role="status">
                <p className="empty-text">아직 팔로우한 사람이 없어요. 사람 탭에서 친구를 팔로우하면 여기서 바로 대화할 수 있어요.</p>
                <Link className="button button-secondary" to="/people">사람 찾기</Link>
              </div>
            ))}
            {!loading && !error && candidates.length > 0 && (
              <ul aria-label="대화할 사람">
                {candidates.map((user) => (
                  <li key={user.uid}>
                    <button className="direct-chat-row" type="button" disabled={pending} onClick={() => void handleStart(user)}>
                      {user.photoURL ? (
                        <img className="chat-avatar" src={user.photoURL} alt="" loading="lazy" />
                      ) : (
                        <span className="profile-avatar small" aria-hidden="true">{user.nickname.slice(0, 1) || 'D'}</span>
                      )}
                      <span className="invite-identity">
                        <strong>{user.nickname}</strong>
                        {user.username && <small>@{user.username}</small>}
                      </span>
                      {chattingUids.has(user.uid) && <span className="direct-chat-chip">대화 중</span>}
                      {pendingUid === user.uid
                        ? <span className="direct-chat-pending" role="status">여는 중…</span>
                        : <ChevronRight size={18} aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {startError && <p className="form-error" role="alert">{startError}</p>}

          <p className="direct-chat-note">
            <Info size={16} aria-hidden="true" />
            친구를 누르면 바로 대화가 열려요. 이미 대화 중인 친구는 기존 채팅방으로 이동해요.
          </p>
          <button className="direct-chat-group-link" type="button" disabled={pending} onClick={onCreateGroup}>
            <UsersRound size={16} aria-hidden="true" />여러 명과 대화하려면 단체방 만들기
          </button>
        </div>
      </section>
    </div>
  )
}
