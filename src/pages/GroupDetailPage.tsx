import { ArrowLeft, Compass, List, Map, MapPin, Plus, Search, Share2, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GroupJoinButton } from '../components/group/GroupJoinButton'
import { PageContainer } from '../components/layout/PageContainer'
import { MapView } from '../components/map/MapView'
import { MapPinList } from '../components/map/MapPinList'
import { MapPostPreview } from '../components/map/MapPostPreview'
import { PostCard } from '../components/post/PostCard'
import { PostFormModal, type PostFormSubmitPayload } from '../components/post/PostFormModal'
import { useAuth } from '../hooks/useAuth'
import { useGroups } from '../hooks/useGroups'
import { SEOUL_CITY_HALL } from '../hooks/useCurrentLocation'
import { getMapProvider, type LatLng, type PlaceSearchResult } from '../lib/mapLocation'
import { searchPlaces } from '../lib/placeSearch'
import { createPost, subscribeGroupPosts } from '../services/postService'
import type { Post } from '../types/post'
import '../styles/groups.css'

export function GroupDetailPage() {
  const { groupId = '' } = useParams()
  // Reset map selections and unfinished forms when navigating between groups.
  return <GroupHome key={groupId} groupId={groupId} />
}

function GroupHome({ groupId }: { groupId: string }) {
  const { currentUser, profile, firebaseReady } = useAuth()
  const { groups, joinedIds, loading, error, retry } = useGroups()
  const group = groups.find(item => item.id === groupId)
  const joined = joinedIds.includes(groupId)
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState('')
  const [revision, setRevision] = useState(0)
  const [tab, setTab] = useState<'map' | 'list'>('map')
  const [center, setCenter] = useState<LatLng>(SEOUL_CITY_HALL)
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [clusterIds, setClusterIds] = useState<string[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<PlaceSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const searchRequest = useRef(0)
  const selectedPost = posts.find(post => post.id === selectedId)
  const placePrefill = useMemo(() => selectedPlace ? { placeName: selectedPlace.name, address: selectedPlace.address, location: selectedPlace.location } : null, [selectedPlace])
  const clusterPosts = posts.filter(post => clusterIds.includes(post.id))
  const uid = currentUser?.uid

  useEffect(() => {
    if (!uid || !firebaseReady) return
    let first = true
    setPostsLoading(true)
    setPostsError('')
    return subscribeGroupPosts(groupId, next => {
      setPosts(next)
      setPostsLoading(false)
      if (first && next[0]) setCenter({ lat: next[0].lat, lng: next[0].lng })
      first = false
    }, () => { setPostsError('그룹 핀을 불러오지 못했습니다.'); setPostsLoading(false) })
  }, [groupId, uid, firebaseReady, revision])

  useEffect(() => () => { searchRequest.current += 1 }, [])

  async function findPlaces(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!keyword.trim()) return
    const request = ++searchRequest.current
    setSearching(true)
    setSearchMessage('')
    try {
      const next = await searchPlaces(keyword, center, getMapProvider(center))
      if (request !== searchRequest.current) return
      setResults(next)
      if (!next.length) setSearchMessage('검색 결과가 없습니다.')
    } catch { if (request === searchRequest.current) { setResults([]); setSearchMessage('장소 검색에 실패했습니다. 다시 시도해 주세요.') } }
    finally { if (request === searchRequest.current) setSearching(false) }
  }

  function selectLocation(location: LatLng, place: PlaceSearchResult | null = null) {
    setSelectedLocation(location)
    setSelectedPlace(place)
    setSelectedId('')
    setClusterIds([])
    if (place) { setCenter(location); setResults([]); setSearchMessage('') }
  }

  async function savePin(payload: PostFormSubmitPayload) {
    if (!currentUser || !profile || !joined) throw new Error('그룹에 가입한 뒤 핀을 올려 주세요.')
    const { files, existingPhotoUrls, ...input } = payload
    void existingPhotoUrls
    await createPost({ ...input, groupId, visibility: 'public' }, files, { uid: currentUser.uid, nickname: profile.nickname })
    setFormOpen(false)
    setSelectedLocation(null)
    setSelectedPlace(null)
  }

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
        <div className="group-home-title"><span className="group-symbol"><Compass size={30} aria-hidden="true" /></span><div><p className="eyebrow">공개 그룹 · 누구나 가입 가능</p><h1>{group.name}</h1></div></div>
        <p className="group-description">{group.description || '함께 발견한 좋은 장소들을 이곳에 모아요.'}</p>
        <div className="group-home-footer"><div className="group-stats"><span><UsersRound size={16} aria-hidden="true" />멤버 {group.memberCount}명</span><span><MapPin size={16} aria-hidden="true" />{postsLoading ? '핀 불러오는 중' : `핀 ${posts.length}개`}</span>{group.ownerUid === uid && <span className="pill">내가 만든 그룹</span>}</div><div className="group-home-actions"><button className="button button-secondary" type="button" onClick={() => void shareGroup()} aria-label="그룹 공유"><Share2 size={17} aria-hidden="true" />공유</button><GroupJoinButton groupId={groupId} joined={joined} allowLeave /></div></div>
        {shareMessage && <p className="group-note" role="status">{shareMessage}</p>}
      </section>
      <div className="group-participation"><p>{joined ? '지도를 길게 누르거나 장소를 검색해 그룹에 핀을 남겨보세요.' : '이 그룹이 마음에 드나요? 바로 가입하고 나의 장소도 함께 모아보세요.'}</p>{joined && <small>탈퇴해도 남긴 핀은 유지되며, 내 핀은 언제든 수정·삭제할 수 있어요.</small>}</div>
      <div className="groups-tools"><h2 className="group-pins-heading">함께 모은 핀</h2><div className="segmented" aria-label="핀 보기 방식"><button type="button" className={tab === 'map' ? 'active' : ''} aria-pressed={tab === 'map'} onClick={() => setTab('map')}><Map size={16} aria-hidden="true" />지도</button><button type="button" className={tab === 'list' ? 'active' : ''} aria-pressed={tab === 'list'} onClick={() => setTab('list')}><List size={16} aria-hidden="true" />목록</button></div></div>
      {postsError && <p className="form-error" role="alert">{postsError} <button className="button button-secondary" type="button" onClick={() => setRevision(value => value + 1)}>다시 시도</button></p>}
      {tab === 'map' && <>
        <form className="groups-search group-place-search" onSubmit={findPlaces}><Search size={18} aria-hidden="true" /><input aria-label="그룹 지도에서 장소 검색" value={keyword} onChange={event => { searchRequest.current += 1; setSearching(false); setResults([]); setKeyword(event.target.value) }} placeholder="핀을 남길 장소 검색" /><button className="button button-secondary" type="submit" disabled={searching || !keyword.trim()}>{searching ? '검색 중…' : '검색'}</button></form>
        {searchMessage && <p className="group-note" role="status">{searchMessage}</p>}
        {results.length > 0 && <ul className="group-place-results" aria-label="장소 검색 결과">{results.map(place => <li key={place.id}><button type="button" onClick={() => selectLocation(place.location, place)}><strong>{place.name}</strong><span>{place.address}</span></button></li>)}</ul>}
        <div className="group-map-shell">
          <MapView center={center} posts={posts} selectedLocation={selectedLocation} selectedPostId={selectedId} onMapClick={location => selectLocation(location)} onMarkerClick={post => { setSelectedId(post.id); setSelectedLocation(null); setClusterIds([]) }} onClusterClick={next => { setClusterIds(next.map(post => post.id)); setSelectedId(''); setSelectedLocation(null) }} currentUserUid={uid} pinThemes={profile?.pinThemes} />
          {clusterPosts.length > 1 && !selectedPost && <MapPinList posts={clusterPosts} onSelect={post => setSelectedId(post.id)} onClose={() => setClusterIds([])} />}
          {selectedPost && <MapPostPreview key={selectedPost.id} post={selectedPost} onClose={() => { setSelectedId(''); setClusterIds([]) }} onBack={clusterPosts.length > 1 ? () => setSelectedId('') : undefined} />}
          {selectedLocation && !selectedPost && <div className="group-map-selection"><p><strong>{selectedPlace?.name || '선택한 위치'}</strong><span>{selectedPlace?.address || `${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)}`}</span></p>{joined ? <button className="button button-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={17} aria-hidden="true" />여기에 그룹 핀 남기기</button> : <GroupJoinButton groupId={groupId} joined={false} />}</div>}
        </div>
      </>}
      {postsLoading && <p className="empty-text" role="status">그룹 핀을 불러오는 중입니다.</p>}
      {!postsLoading && !postsError && posts.length === 0 && <div className="empty-state"><MapPin size={30} aria-hidden="true" /><h2>아직 모은 핀이 없어요</h2><p>{joined ? '좋아하는 장소에 이 그룹의 첫 핀을 남겨보세요.' : '가입하고 이 그룹의 첫 장소를 소개해 보세요.'}</p>{joined && tab === 'list' && <button className="button button-primary" type="button" onClick={() => setTab('map')}>지도에서 핀 남기기</button>}</div>}
      {tab === 'list' && posts.length > 0 && <div className="post-grid">{posts.map(post => <PostCard key={post.id} post={post} />)}</div>}
      <PostFormModal isOpen={formOpen && joined} mode="create" location={selectedLocation} placePrefill={placePrefill} initialGroupId={groupId} lockGroup onClose={() => setFormOpen(false)} onSubmit={savePin} />
    </PageContainer>
  )
}
