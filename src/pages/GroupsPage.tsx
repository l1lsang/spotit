import { ArrowUpRight, Compass, Plus, Search, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CreateGroupDialog } from '../components/group/CreateGroupDialog'
import { GroupJoinButton } from '../components/group/GroupJoinButton'
import { PageContainer } from '../components/layout/PageContainer'
import { useGroups } from '../hooks/useGroups'
import '../styles/groups.css'

export function GroupsPage() {
  const { groups, joinedIds, loading, error, retry } = useGroups()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'joined'>('all')
  const [keyword, setKeyword] = useState('')
  const [creating, setCreating] = useState(false)
  const term = keyword.trim().toLocaleLowerCase()
  const filtered = groups.filter(group => (tab === 'all' || joinedIds.includes(group.id))
    && `${group.name} ${group.description}`.toLocaleLowerCase().includes(term))

  return (
    <PageContainer className="content-page groups-page">
      <section className="groups-intro">
        <div><p className="eyebrow">GROUPS · 함께 찾는 즐거움</p><h1>취향이 닿는 곳,<br />함께 핀을 모아요.</h1><p>동네 맛집부터 나만 아는 산책길까지.<br />마음에 드는 그룹에 가입하고 나의 장소를 나눠보세요.</p></div>
        <button type="button" className="button button-primary" onClick={() => setCreating(true)}><Plus size={18} aria-hidden="true" />그룹 만들기</button>
      </section>
      <div className="groups-tools">
        <div className="groups-filter-toggle" role="group" aria-label="그룹 필터">
          <button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>
            <Compass size={16} aria-hidden="true" />
            그룹 둘러보기
          </button>
          <button type="button" aria-pressed={tab === 'joined'} onClick={() => setTab('joined')}>
            <UsersRound size={16} aria-hidden="true" />
            내 그룹
            {!loading && !error && <span className="groups-filter-count">{joinedIds.length}</span>}
          </button>
        </div>
        <label className="groups-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="그룹 검색" placeholder="이름이나 관심사로 그룹 찾기" value={keyword} onChange={event => setKeyword(event.target.value)} /></label>
      </div>
      {error && <div className="form-error" role="alert">{error} <button className="button button-secondary" type="button" onClick={retry}>다시 시도</button></div>}
      {loading && <p className="empty-text" role="status">함께할 그룹을 불러오는 중입니다.</p>}
      {!loading && !error && filtered.length === 0 && <div className="empty-state"><Compass size={36} aria-hidden="true" /><h2>{term ? '검색 결과가 없어요' : tab === 'joined' ? '아직 가입한 그룹이 없어요' : '첫 그룹을 만들어 보세요'}</h2><p>{term ? '다른 이름이나 관심사로 찾아보세요.' : '좋아하는 장소를 모으며 같은 취향의 사람들을 만나보세요.'}</p>{tab === 'joined' && !term && <button type="button" className="button button-secondary" onClick={() => setTab('all')}>그룹 둘러보기</button>}</div>}
      {!loading && !error && filtered.length > 0 && <ul className="groups-grid" aria-label="그룹 목록">
        {filtered.map(group => <li key={group.id} className="group-card">
          <Link className="group-card-main" to={`/groups/${group.id}`}>
            <div className="group-card-top"><span className="group-symbol"><Compass size={27} aria-hidden="true" /></span><span className="group-public">공개 그룹 <ArrowUpRight size={15} aria-hidden="true" /></span></div>
            <h2>{group.name}</h2><p>{group.description || '함께 발견한 좋은 장소들을 이곳에 모아요.'}</p>
          </Link>
          <div className="group-card-bottom"><span><UsersRound size={16} aria-hidden="true" />멤버 {group.memberCount}명</span><GroupJoinButton groupId={group.id} joined={joinedIds.includes(group.id)} /></div>
        </li>)}
      </ul>}
      {creating && <CreateGroupDialog onClose={() => setCreating(false)} onCreated={id => { setCreating(false); navigate(`/groups/${id}`) }} />}
    </PageContainer>
  )
}
