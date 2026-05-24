import { MessageCircle, RefreshCw, Search, UserPlus, UserRoundCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { getOrCreateDirectChat } from '../services/chatService'
import { followUser, getFollowingIds, unfollowUser } from '../services/followService'
import { listUsers } from '../services/userService'
import type { DaymarkUser } from '../types/user'

export function PeoplePage() {
  const navigate = useNavigate()
  const { currentUser, profile, firebaseReady, refreshProfile } = useAuth()
  const [users, setUsers] = useState<DaymarkUser[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadPeople = useCallback(async () => {
    if (!firebaseReady || !currentUser) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const [nextUsers, nextFollowingIds] = await Promise.all([
        listUsers(),
        getFollowingIds(currentUser.uid),
      ])
      setUsers(nextUsers.filter((user) => user.uid !== currentUser.uid))
      setFollowingIds(new Set(nextFollowingIds))
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

    try {
      if (alreadyFollowing) {
        await unfollowUser(currentUser.uid, user.uid)
        setFollowingIds((previous) => {
          const next = new Set(previous)
          next.delete(user.uid)
          return next
        })
      } else {
        await followUser(profile, user)
        setFollowingIds((previous) => new Set(previous).add(user.uid))
      }

      await refreshProfile()
      await loadPeople()
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : '팔로우 상태 변경에 실패했습니다.')
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

            return (
              <article className="person-card" key={user.uid}>
                <div className="profile-avatar small">{user.nickname.slice(0, 1) || 'D'}</div>
                <div className="person-info">
                  <h2>{user.nickname}</h2>
                  <p>{user.email || '카카오 계정'}</p>
                  <small>
                    팔로워 {user.followerCount || 0} · 팔로잉 {user.followingCount || 0}
                  </small>
                </div>
                <div className="person-actions">
                  <button
                    className={`button ${isFollowed ? 'button-secondary' : 'button-primary'}`}
                    type="button"
                    onClick={() => void handleToggleFollow(user)}
                  >
                    {isFollowed ? (
                      <UserRoundCheck size={17} aria-hidden="true" />
                    ) : (
                      <UserPlus size={17} aria-hidden="true" />
                    )}
                    {isFollowed ? '팔로잉' : '팔로우'}
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
    </PageContainer>
  )
}
