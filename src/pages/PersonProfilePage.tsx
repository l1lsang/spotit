import { ChevronLeft, Clock, MessageCircle, Settings, UserPlus, UserRoundCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { LikedPinAlbum } from '../components/profile/LikedPinAlbum'
import { ProfileHeader } from '../components/profile/ProfileHeader'
import { ProfileMoreMenu } from '../components/profile/ProfileMoreMenu'
import { ProfilePinAlbum } from '../components/profile/ProfilePinAlbum'
import { ProfileSingleTab, ProfileTabs } from '../components/profile/ProfileTabs'
import { UserSummaryLink } from '../components/profile/UserSummaryLink'
import { useLikedPosts, useProfileAlbum } from '../components/profile/useProfileAlbum'
import { useAuth } from '../hooks/useAuth'
import { getOrCreateDirectChat } from '../services/chatService'
import { cancelFollowRequest, followUser, getFollowers, getFollowing, hasPendingFollowRequest, isFollowing, unfollowUser } from '../services/followService'
import { getUserProfile } from '../services/userService'
import type { FollowEdge } from '../types/follow'
import type { DaymarkUser } from '../types/user'
import '../styles/people.css'
import '../styles/profile.css'

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
  const [searchParams] = useSearchParams()
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
  const tab = ownProfile && searchParams.get('tab') === 'likes' ? 'likes' : 'pins'
  const albumState = useProfileAlbum(userId, viewerUid, revision)
  const likedState = useLikedPosts(viewerUid, ownProfile && tab === 'likes')
  const pinCount = albumState.album && albumState.album.access !== 'locked' ? albumState.album.posts.length : null

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
  const handle = user ? (user.username ? `@${user.username}` : user.nickname || '스팟잇 사용자') : (ownProfile ? '내 프로필' : '프로필')

  return (
    <PageContainer className="content-page person-profile-page profile-view-page">
      <header className="profile-view-topbar">
        {!ownProfile && <Link className="profile-view-icon-button" to={returnTo} aria-label="사람 목록으로 돌아가기" title="사람 목록">
          <ChevronLeft size={24} aria-hidden="true" />
        </Link>}
        <p className="profile-view-handle">{handle}</p>
        {ownProfile ? <Link className="profile-view-icon-button" to="/profile/settings" aria-label="프로필 설정" title="프로필 설정">
          <Settings size={22} aria-hidden="true" />
        </Link> : user && <ProfileMoreMenu user={user} />}
      </header>
      {loading && !details && <p className="empty-text" role="status">프로필을 불러오는 중입니다.</p>}
      {loadError && <div className="person-profile-error" role="alert"><p>{loadError}</p>
        <button className="button button-secondary" type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>다시 시도</button>
      </div>}
      {!loading && !loadError && !user && <div className="empty-state"><h1>프로필을 찾을 수 없습니다.</h1><p>탈퇴했거나 아직 프로필을 완성하지 않은 사용자입니다.</p></div>}
      {user && <ProfileHeader user={user} own={ownProfile} pinCount={pinCount} onOpenFollowList={setFollowListKind}>
        {ownProfile ? <Link className="button button-secondary" to="/profile/settings">프로필 편집</Link> : <>
          <button className={`button ${details.followed || details.requested ? 'button-secondary' : 'button-primary'}`} type="button"
            onClick={() => void handleFollow()} disabled={Boolean(action) || loading || Boolean(loadError) || !profile}>
            {details.followed ? <UserRoundCheck size={17} aria-hidden="true" /> : details.requested ? <Clock size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
            {action === 'follow' ? '처리 중…' : followLabel}
          </button>
          <button className="button button-secondary" type="button" onClick={() => void handleChat()} disabled={Boolean(action) || !profile}>
            <MessageCircle size={17} aria-hidden="true" />{action === 'chat' ? '채팅 여는 중…' : '채팅'}
          </button>
        </>}
      </ProfileHeader>}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {user && <>
        {ownProfile ? <ProfileTabs active={tab} /> : <ProfileSingleTab label="핀" />}
        <div className="profile-view-grid">
          {tab === 'likes' ? <LikedPinAlbum state={likedState} /> : <ProfilePinAlbum state={albumState} own={ownProfile} />}
        </div>
      </>}
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
