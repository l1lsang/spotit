import { RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { UserSummaryLink } from '../components/profile/UserSummaryLink'
import { useAuth } from '../hooks/useAuth'
import { listUsers } from '../services/userService'
import type { DaymarkUser } from '../types/user'
import '../styles/people.css'

export function PeoplePage() {
  const { currentUser, firebaseReady } = useAuth()
  const [users, setUsers] = useState<DaymarkUser[]>([])
  const [searchParams, setSearchParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const keyword = searchParams.get('q') || ''
  const viewerUid = currentUser?.uid
  const returnTo = `/people${searchParams.size ? `?${searchParams.toString()}` : ''}`

  useEffect(() => {
    if (!firebaseReady || !viewerUid) { setLoading(false); return }
    let active = true
    setLoading(true)
    setError('')
    void listUsers().then(nextUsers => {
      if (active) setUsers(nextUsers.filter(user => user.uid !== viewerUid))
    }).catch(loadError => {
      if (active) setError(loadError instanceof Error ? loadError.message : '사용자 목록을 불러오지 못했습니다.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [viewerUid, firebaseReady, revision])

  const filteredUsers = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase()
    return trimmed ? users.filter(user => user.nickname.toLowerCase().includes(trimmed)
      || (user.username || '').toLowerCase().includes(trimmed.replace(/^@/, ''))) : users
  }, [keyword, users])

  return (
    <PageContainer className="content-page people-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Follow network</p>
          <h1>사람 찾기</h1>
          <p>프로필을 눌러 친구의 소개를 보고 소통해 보세요.</p>
        </div>
        <button className="button button-secondary" type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>
          <RefreshCw size={17} aria-hidden="true" />새로고침
        </button>
      </section>
      <label className="people-search">
        <Search size={18} aria-hidden="true" />
        <input value={keyword} onChange={event => {
          const next = new URLSearchParams(searchParams)
          if (event.target.value) next.set('q', event.target.value)
          else next.delete('q')
          setSearchParams(next, { replace: true })
        }} placeholder="사용자 이름 또는 닉네임 검색" aria-label="사용자 검색" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="empty-text" role="status">사람들을 불러오는 중입니다.</p>}
      {!loading && !error && filteredUsers.length === 0 && <p className="empty-text">검색된 사용자가 없습니다.</p>}
      {!loading && filteredUsers.length > 0 && (
        <ul className="people-list" aria-label="사용자 목록">
          {filteredUsers.map(user => <li key={user.uid}><UserSummaryLink user={user} returnTo={returnTo} /></li>)}
        </ul>
      )}
    </PageContainer>
  )
}
