import { ArrowLeft, Compass, Map, MapPin, Plus, Share2, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GroupJoinButton } from '../components/group/GroupJoinButton'
import { PageContainer } from '../components/layout/PageContainer'
import { PostCard } from '../components/post/PostCard'
import { useAuth } from '../hooks/useAuth'
import { useGroups } from '../hooks/useGroups'
import { getGroupMapUrl } from '../lib/groupNavigation'
import { subscribeGroupPosts } from '../services/postService'
import type { Post } from '../types/post'
import '../styles/groups.css'

export function GroupDetailPage() {
  const { groupId = '' } = useParams()
  return <GroupHome key={groupId} groupId={groupId} />
}

function GroupHome({ groupId }: { groupId: string }) {
  const { currentUser, firebaseReady } = useAuth()
  const { groups, joinedIds, loading, error, retry } = useGroups()
  const group = groups.find(item => item.id === groupId)
  const joined = joinedIds.includes(groupId)
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState('')
  const [revision, setRevision] = useState(0)
  const [shareMessage, setShareMessage] = useState('')
  const uid = currentUser?.uid
  const mapUrl = getGroupMapUrl(groupId)

  useEffect(() => {
    if (!uid || !firebaseReady) return
    setPostsLoading(true)
    setPostsError('')
    return subscribeGroupPosts(groupId, next => {
      setPosts(next)
      setPostsLoading(false)
    }, () => { setPostsError('그룹 핀을 불러오지 못했습니다.'); setPostsLoading(false) })
  }, [groupId, uid, firebaseReady, revision])

  async function shareGroup() {
    try {
      const url = `${window.location.origin}/groups/${groupId}`
      if (navigator.share) await navigator.share({ title: group?.name, text: '함께 장소를 모아요. 클릭 한 번으로 가입할 수 있어요.', url })
      else { await navigator.clipboard.writeText(url); setShareMessage('그룹 링크를 복사했습니다.') }
    } catch (cause) { if ((cause as { name?: string }).name !== 'AbortError') setShareMessage('공유하지 못했습니다. 다시 시도해 주세요.') }
  }

  if (loading) return <PageContainer className="content-page"><p className="empty-text" role="status">그룹을 불러오는 중입니다.</p></PageContainer>
  if (error || !group) return <PageContainer className="content-page"><div className="empty-state"><h1>{error ? '그룹을 불러오지 못했어요' : '그룹을 찾을 수 없어요'}</h1>{error && <p role="alert">{error}</p>}{error && <button className="button button-secondary" type="button" onClick={retry}>다시 시도</button>}<Link className="button button-primary" to="/groups">그룹 둘러보기</Link></div></PageContainer>

  return (
    <PageContainer className="content-page groups-page">
      <Link className="group-back" to="/groups"><ArrowLeft size={17} aria-hidden="true" />그룹 둘러보기</Link>
      <section className="group-home-heading">
        <div className="group-home-title">
          <span className="group-symbol"><Compass size={30} aria-hidden="true" /></span>
          <div><p className="eyebrow">공개 그룹 · 누구나 가입 가능</p><h1>{group.name}</h1></div>
        </div>
        <p className="group-description">{group.description || '함께 발견한 좋은 장소들을 이곳에 모아요.'}</p>
        <div className="group-home-footer">
          <div className="group-stats">
            <span><UsersRound size={16} aria-hidden="true" />멤버 {group.memberCount}명</span>
            <span><MapPin size={16} aria-hidden="true" />{postsLoading ? '핀 불러오는 중' : `핀 ${posts.length}개`}</span>
            {group.ownerUid === uid && <span className="pill">내가 만든 그룹</span>}
          </div>
          <div className="group-home-actions">
            <button className="button button-secondary" type="button" onClick={() => void shareGroup()} aria-label="그룹 공유"><Share2 size={17} aria-hidden="true" />공유</button>
            <GroupJoinButton groupId={groupId} joined={joined} allowLeave />
          </div>
        </div>
        {shareMessage && <p className="group-note" role="status">{shareMessage}</p>}
      </section>
      <div className="group-participation group-map-invite">
        <div>
          <p>{joined ? '지도 탭에서 장소를 검색하거나 지도를 길게 눌러 그룹 핀을 남겨보세요.' : '이 그룹이 마음에 드나요? 바로 가입하고 나의 장소도 함께 모아보세요.'}</p>
          {joined && <small>탈퇴해도 남긴 핀은 유지되며, 내 핀은 언제든 수정·삭제할 수 있어요.</small>}
        </div>
        <Link className="button button-primary" to={mapUrl}>
          {joined ? <Plus size={17} aria-hidden="true" /> : <Map size={17} aria-hidden="true" />}
          {joined ? '지도에서 핀 남기기' : '지도에서 그룹 핀 보기'}
        </Link>
      </div>
      <div className="groups-tools">
        <h2 className="group-pins-heading">함께 모은 핀</h2>
        <Link className="button button-secondary" to={mapUrl}><Map size={16} aria-hidden="true" />지도에서 모아보기</Link>
      </div>
      {postsError && <p className="form-error" role="alert">{postsError} <button className="button button-secondary" type="button" onClick={() => setRevision(value => value + 1)}>다시 시도</button></p>}
      {postsLoading && <p className="empty-text" role="status">그룹 핀을 불러오는 중입니다.</p>}
      {!postsLoading && !postsError && posts.length === 0 && <div className="empty-state"><MapPin size={30} aria-hidden="true" /><h2>아직 모은 핀이 없어요</h2><p>{joined ? '지도 탭에서 좋아하는 장소에 이 그룹의 첫 핀을 남겨보세요.' : '가입하고 이 그룹의 첫 장소를 소개해 보세요.'}</p></div>}
      {posts.length > 0 && <div className="post-grid">{posts.map(post => <PostCard key={post.id} post={post} />)}</div>}
    </PageContainer>
  )
}
