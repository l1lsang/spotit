import { ArrowLeft, Clock, Lock, MessageCircle, Settings, UserPlus, UserRoundCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { ReportButton } from '../components/moderation/ReportButton'
import { UserSummaryLink } from '../components/profile/UserSummaryLink'
import { ProfilePinAlbum } from '../components/profile/ProfilePinAlbum'
import { useAuth } from '../hooks/useAuth'
import { getOrCreateDirectChat } from '../services/chatService'
import { cancelFollowRequest, followUser, getFollowers, getFollowing, hasPendingFollowRequest, isFollowing, unfollowUser } from '../services/followService'
import { getUserProfile } from '../services/userService'
import type { FollowEdge } from '../types/follow'
import type { DaymarkUser } from '../types/user'
import '../styles/people.css'

type FollowListKind = 'followers' | 'following'
interface ProfileDetails { user: DaymarkUser | null; followed: boolean; requested: boolean }

export function PersonProfilePage() {
  const { userId = '' } = useParams()
  return <PersonProfile key={userId} userId={userId} />
}

export function PersonProfile({ userId }: { userId: string }) {
  const { currentUser, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [details, setDetails] = useState<ProfileDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [action, setAction] = useState<'follow' | 'chat' | null>(null)
  const [revision, setRevision] = useState(0)
  const [followListKind, setFollowListKind] = useState<FollowListKind | null>(null)
  const actionLock = useRef(false)
  const activeRef = useRef(true)
  const viewerUid = currentUser?.uid
  const ownProfile = viewerUid === userId
  const requestedReturnTo: unknown = location.state?.peopleReturnTo
  const returnTo = typeof requestedReturnTo === 'string' && (requestedReturnTo === '/people' || requestedReturnTo.startsWith('/people?'))
    ? requestedReturnTo : '/people'

  useEffect(() => {
    activeRef.current = true
    window.scrollTo(0, 0)
    return () => { activeRef.current = false }
  }, [])

  useEffect(() => {
    if (!viewerUid) return
    let active = true
    setLoading(true)
    setLoadError('')
    void Promise.all([
      getUserProfile(userId),
      ownProfile ? Promise.resolve(false) : isFollowing(viewerUid, userId),
      ownProfile ? Promise.resolve(false) : hasPendingFollowRequest(viewerUid, userId),
    ]).then(([user, followed, requested]) => {
      if (active) setDetails({ user: user?.onboardingComplete === false ? null : user, followed, requested })
    }).catch(error => {
      if (active) setLoadError(error instanceof Error ? error.message : '프로필을 불러오지 못했습니다.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId, viewerUid, ownProfile, revision])

  async function handleFollow() {
    if (!profile || !viewerUid || !details?.user || ownProfile || actionLock.current || loading) return
    actionLock.current = true
    setAction('follow')
    setActionError('')
    try {
      if (details.followed) await unfollowUser(viewerUid, userId)
      else if (details.requested) await cancelFollowRequest(viewerUid, userId)
      else await followUser(profile, details.user)
      await refreshProfile()
    } catch (error) {
      if (activeRef.current) setActionError(error instanceof Error ? error.message : '팔로우 상태를 변경하지 못했습니다.')
    } finally {
      actionLock.current = false
      if (activeRef.current) {
        setAction(null)
        setLoading(true)
        setRevision(value => value + 1)
      }
    }
  }

  async function handleChat() {
    if (!profile || !details?.user || ownProfile || actionLock.current) return
    actionLock.current = true
    setAction('chat')
    setActionError('')
    try {
      const chatId = await getOrCreateDirectChat(profile, details.user)
      if (activeRef.current) navigate(`/chats/${chatId}`)
    } catch (error) {
      if (activeRef.current) setActionError(error instanceof Error ? error.message : '채팅을 시작하지 못했습니다.')
    } finally {
      actionLock.current = false
      if (activeRef.current) setAction(null)
    }
  }

  const user = details?.user
  const followLabel = details?.followed ? '팔로잉' : details?.requested ? '요청 취소' : user?.isPrivate ? '팔로우 요청' : '팔로우'

  return (
    <PageContainer className="content-page person-profile-page">
      <div className="person-profile-toolbar">
        {ownProfile ? <span>내 프로필</span> : <Link className="person-profile-back" to={returnTo}><ArrowLeft size={18} aria-hidden="true" />사람 목록</Link>}
        {ownProfile && <Link className="button-icon subtle profile-settings-link" to="/profile/settings" aria-label="프로필 설정" title="프로필 설정"><Settings size={22} aria-hidden="true" /></Link>}
      </div>
      {loading && !details && <p className="empty-text" role="status">프로필을 불러오는 중입니다.</p>}
      {loadError && <div className="person-profile-error" role="alert"><p>{loadError}</p>
        <button className="button button-secondary" type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>다시 시도</button>
      </div>}
      {!loading && !loadError && !user && <div className="empty-state"><h1>프로필을 찾을 수 없습니다.</h1><p>탈퇴했거나 아직 프로필을 완성하지 않은 사용자입니다.</p></div>}
      {user && <article className="person-profile-card">
        <div className="person-profile-heading">
          {user.photoURL ? <img className="person-profile-photo" src={user.photoURL} alt={`${user.nickname} 프로필 사진`} />
            : <span className="profile-avatar person-profile-photo" aria-hidden="true">{user.nickname.slice(0, 1) || 'S'}</span>}
          <div className="person-profile-identity">
            <h1>{user.nickname || '스팟잇 사용자'}</h1>
            {user.username && <p className="person-profile-username">@{user.username}</p>}
            <div className="profile-stats">
              <button type="button" onClick={() => setFollowListKind('followers')}><span>팔로워</span><strong>{user.followerCount || 0}</strong></button>
              <button type="button" onClick={() => setFollowListKind('following')}><span>팔로잉</span><strong>{user.followingCount || 0}</strong></button>
            </div>
          </div>
        </div>
        <section className="person-profile-about" aria-label="소개">
          <h2>소개</h2>
          <p>{user.bio || '아직 소개글이 없습니다.'}</p>
          {user.isPrivate && <div className="person-profile-privacy"><Lock size={15} aria-hidden="true" /><span>{ownProfile ? '비공개 계정 · 새 팔로우 요청은 설정에서 승인할 수 있습니다.' : '비공개 계정 · 팔로우 요청을 승인받아야 합니다.'}</span></div>}
        </section>
        {!ownProfile && <>
          <div className="person-profile-actions">
            <button className={`button ${details.followed || details.requested ? 'button-secondary' : 'button-primary'}`} type="button"
              onClick={() => void handleFollow()} disabled={Boolean(action) || loading || Boolean(loadError) || !profile}>
              {details.followed ? <UserRoundCheck size={17} aria-hidden="true" /> : details.requested ? <Clock size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
              {action === 'follow' ? '처리 중…' : followLabel}
            </button>
            <button className="button button-secondary" type="button" onClick={() => void handleChat()} disabled={Boolean(action) || !profile}>
              <MessageCircle size={17} aria-hidden="true" />{action === 'chat' ? '채팅 여는 중…' : '채팅'}
            </button>
          </div>
          <div className="person-profile-report"><ReportButton target={{ kind: 'user', targetId: user.uid, label: user.nickname }} compact /></div>
        </>}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
      </article>}
      {user && <ProfilePinAlbum ownerUid={user.uid} refreshKey={revision} />}
      {user && followListKind && <PersonFollowList user={user} kind={followListKind} returnTo={returnTo} onClose={() => setFollowListKind(null)} />}
    </PageContainer>
  )
}

function PersonFollowList({ user, kind, returnTo, onClose }: { user: DaymarkUser; kind: FollowListKind; returnTo: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [people, setPeople] = useState<FollowEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const title = kind === 'followers' ? '팔로워' : '팔로잉'

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  useEffect(() => {
    let active = true
    const request = kind === 'followers' ? getFollowers(user.uid) : getFollowing(user.uid)
    void request.then(nextPeople => {
      if (active) setPeople([...nextPeople].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)))
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user.uid, kind])

  return <dialog className="person-follow-dialog" ref={dialogRef} aria-labelledby="person-follow-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="person-follow-header"><div><p>{user.nickname}</p><h2 id="person-follow-title">{title}</h2></div>
      <button className="button-icon" type="button" onClick={onClose} aria-label="목록 닫기"><X size={20} aria-hidden="true" /></button>
    </div>
    <div className="person-follow-body">
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="follow-empty" role="status">목록을 불러오는 중입니다.</p>}
      {!loading && !error && people.length === 0 && <p className="follow-empty">아직 {title}가 없습니다.</p>}
      {!loading && people.length > 0 && <ul className="people-list" aria-label={`${title} 목록`}>
        {people.map(person => <li key={person.uid}><UserSummaryLink user={person} returnTo={returnTo} onOpen={onClose} /></li>)}
      </ul>}
    </div>
  </dialog>
}
