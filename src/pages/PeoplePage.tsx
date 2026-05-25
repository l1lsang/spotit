import { Clock, Lock, MessageCircle, RefreshCw, Search, UserPlus, UserRoundCheck, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { getOrCreateDirectChat } from '../services/chatService'
import {
  cancelFollowRequest,
  followUser,
  getFollowers,
  getFollowing,
  getFollowingIds,
  getOutgoingFollowRequestIds,
  unfollowUser,
} from '../services/followService'
import { listUsers } from '../services/userService'
import type { FollowEdge } from '../types/follow'
import type { DaymarkUser } from '../types/user'

type FollowListKind = 'followers' | 'following'

function sortFollowEdgesByCreatedAtDesc(edges: FollowEdge[]): FollowEdge[] {
  return [...edges].sort((a, b) => {
    const left = a.createdAt?.toMillis?.() || 0
    const right = b.createdAt?.toMillis?.() || 0

    return right - left
  })
}

export function PeoplePage() {
  const navigate = useNavigate()
  const { currentUser, profile, firebaseReady, refreshProfile } = useAuth()
  const [users, setUsers] = useState<DaymarkUser[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [pendingFollowRequestIds, setPendingFollowRequestIds] = useState<Set<string>>(new Set())
  const [followListOwner, setFollowListOwner] = useState<DaymarkUser | null>(null)
  const [followListKind, setFollowListKind] = useState<FollowListKind | null>(null)
  const [followList, setFollowList] = useState<FollowEdge[]>([])
  const [followListLoading, setFollowListLoading] = useState(false)
  const [followListError, setFollowListError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [followActionUid, setFollowActionUid] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadPeople = useCallback(async () => {
    if (!firebaseReady || !currentUser) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const [nextUsers, nextFollowingIds, nextPendingRequestIds] = await Promise.all([
        listUsers(),
        getFollowingIds(currentUser.uid),
        getOutgoingFollowRequestIds(currentUser.uid),
      ])
      setUsers(nextUsers.filter((user) => user.uid !== currentUser.uid))
      setFollowingIds(new Set(nextFollowingIds))
      setPendingFollowRequestIds(new Set(nextPendingRequestIds))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '사용자 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentUser, firebaseReady])

  useEffect(() => {
    void loadPeople()
  }, [loadPeople])

  const filteredUsers = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase()

    if (!trimmed) {
      return users
    }

    return users.filter(
      (user) =>
        user.nickname.toLowerCase().includes(trimmed) ||
        user.email.toLowerCase().includes(trimmed),
    )
  }, [keyword, users])

  async function handleToggleFollow(user: DaymarkUser) {
    if (!currentUser || !profile) {
      return
    }

    const alreadyFollowing = followingIds.has(user.uid)
    const alreadyRequested = pendingFollowRequestIds.has(user.uid)

    setFollowActionUid(user.uid)
    setError('')

    try {
      if (alreadyFollowing) {
        await unfollowUser(currentUser.uid, user.uid)
        setFollowingIds((previous) => {
          const next = new Set(previous)
          next.delete(user.uid)
          return next
        })
      } else if (alreadyRequested) {
        await cancelFollowRequest(currentUser.uid, user.uid)
        setPendingFollowRequestIds((previous) => {
          const next = new Set(previous)
          next.delete(user.uid)
          return next
        })
      } else {
        const result = await followUser(profile, user)

        if (result === 'requested') {
          setPendingFollowRequestIds((previous) => new Set(previous).add(user.uid))
        } else {
          setFollowingIds((previous) => new Set(previous).add(user.uid))
        }
      }

      await refreshProfile()
      await loadPeople()
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : '팔로우 상태 변경에 실패했습니다.')
    } finally {
      setFollowActionUid('')
    }
  }

  async function handleStartChat(user: DaymarkUser) {
    if (!profile) {
      return
    }

    try {
      const chatId = await getOrCreateDirectChat(profile, user)
      navigate(`/chats/${chatId}`)
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : '채팅을 시작하지 못했습니다.')
    }
  }

  async function handleOpenFollowList(user: DaymarkUser, kind: FollowListKind) {
    setFollowListOwner(user)
    setFollowListKind(kind)
    setFollowList([])
    setFollowListLoading(true)
    setFollowListError('')

    try {
      const nextList = kind === 'followers' ? await getFollowers(user.uid) : await getFollowing(user.uid)
      setFollowList(sortFollowEdgesByCreatedAtDesc(nextList))
    } catch (loadError) {
      setFollowListError(loadError instanceof Error ? loadError.message : '목록을 불러오지 못했습니다.')
    } finally {
      setFollowListLoading(false)
    }
  }

  function handleCloseFollowList() {
    setFollowListOwner(null)
    setFollowListKind(null)
    setFollowList([])
    setFollowListError('')
  }

  const followListTitle = followListKind === 'followers' ? '팔로워' : '팔로잉'

  return (
    <PageContainer className="content-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Follow network</p>
          <h1>사람 찾기</h1>
          <p>팔로우한 사람들의 팔로워 공개 핀만 지도와 피드에 표시됩니다.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void loadPeople()}>
          <RefreshCw size={17} aria-hidden="true" />
          새로고침
        </button>
      </section>

      <label className="people-search">
        <Search size={18} aria-hidden="true" />
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="닉네임 또는 이메일 검색"
        />
      </label>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="empty-text">사람들을 불러오는 중입니다.</p>}

      {!loading && filteredUsers.length === 0 ? (
        <p className="empty-text">검색된 사용자가 없습니다.</p>
      ) : (
        <div className="people-grid">
          {filteredUsers.map((user) => {
            const isFollowed = followingIds.has(user.uid)
            const isRequested = pendingFollowRequestIds.has(user.uid)
            const followButtonLabel = isFollowed
              ? '팔로잉'
              : isRequested
                ? '요청 취소'
                : user.isPrivate
                  ? '요청'
                  : '팔로우'

            return (
              <article className="person-card" key={user.uid}>
                {user.photoURL ? (
                  <img className="profile-photo small" src={user.photoURL} alt={`${user.nickname} 프로필`} />
                ) : (
                  <div className="profile-avatar small">{user.nickname.slice(0, 1) || 'D'}</div>
                )}
                <div className="person-info">
                  <div className="person-title">
                    <h2>{user.nickname}</h2>
                    {user.isPrivate && (
                      <span className="private-account-badge compact">
                        <Lock size={12} aria-hidden="true" />
                        비공개
                      </span>
                    )}
                  </div>
                  <p>{user.email || '카카오 계정'}</p>
                  <div className="person-stats">
                    <button type="button" onClick={() => void handleOpenFollowList(user, 'followers')}>
                      팔로워 {user.followerCount || 0}
                    </button>
                    <button type="button" onClick={() => void handleOpenFollowList(user, 'following')}>
                      팔로잉 {user.followingCount || 0}
                    </button>
                  </div>
                </div>
                <div className="person-actions">
                  <button
                    className={`button ${isFollowed || isRequested ? 'button-secondary' : 'button-primary'}`}
                    type="button"
                    onClick={() => void handleToggleFollow(user)}
                    disabled={followActionUid === user.uid}
                  >
                    {isFollowed ? (
                      <UserRoundCheck size={17} aria-hidden="true" />
                    ) : isRequested ? (
                      <Clock size={17} aria-hidden="true" />
                    ) : user.isPrivate ? (
                      <Lock size={17} aria-hidden="true" />
                    ) : (
                      <UserPlus size={17} aria-hidden="true" />
                    )}
                    {followActionUid === user.uid ? '처리 중' : followButtonLabel}
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => void handleStartChat(user)}>
                    <MessageCircle size={17} aria-hidden="true" />
                    채팅
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {followListOwner && followListKind && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal follow-modal" role="dialog" aria-modal="true" aria-labelledby="follow-list-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">{followListOwner.nickname}</p>
                <h2 id="follow-list-title">{followListTitle}</h2>
              </div>
              <button className="button-icon" type="button" onClick={handleCloseFollowList} aria-label="닫기">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {followListError && <p className="form-error">{followListError}</p>}
            {followListLoading && <p className="follow-empty">목록을 불러오는 중입니다.</p>}

            {!followListLoading && followList.length === 0 ? (
              <p className="follow-empty">아직 {followListTitle} 목록이 없습니다.</p>
            ) : (
              <div className="follow-list">
                {followList.map((edge) => (
                  <article className="follow-row view-only" key={edge.uid}>
                    {edge.photoURL ? (
                      <img className="chat-avatar" src={edge.photoURL} alt={`${edge.nickname} 프로필`} />
                    ) : (
                      <span className="profile-avatar small">{edge.nickname.slice(0, 1) || 'D'}</span>
                    )}
                    <div className="person-info">
                      <h2>{edge.nickname}</h2>
                      <small>{followListKind === 'followers' ? '팔로워' : '팔로잉'}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PageContainer>
  )
}
