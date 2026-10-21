import { ArrowRight, Check, Compass, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { PinGroup } from '../../types/group'
import { GroupJoinButton } from '../group/GroupJoinButton'

interface MapScopeSheetProps {
  groups: PinGroup[]
  currentGroupId: string
  loading: boolean
  error: string
  aboveFab?: boolean
  onRetry: () => void
  onSelect: (groupId: string) => void
  onClose: () => void
}

export function MapScopeSheet({ groups, currentGroupId, loading, error, aboveFab = false, onRetry, onSelect, onClose }: MapScopeSheetProps) {
  const currentRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { currentRef.current?.focus() }, [])
  const options = [
    { id: '', name: '내 지도 · 나와 팔로잉', detail: '내 핀과 팔로우한 사람들의 핀' },
    ...groups.map((group) => ({ id: group.id, name: group.name, detail: `${group.visibility === 'private' ? '비공개' : '공개'} 그룹 · 멤버 ${group.memberCount}명` })),
  ]

  return (
    <>
      <div className="map-scope-backdrop" aria-hidden="true" onClick={onClose} />
      <section className={`map-scope-sheet${aboveFab ? ' above-fab' : ''}`} role="dialog" aria-modal="true" aria-labelledby="map-scope-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}>
        <span className="map-scope-handle" aria-hidden="true" />
        <header className="map-scope-header">
          <h2 id="map-scope-title">지도에 표시할 그룹</h2>
          <button className="button-icon ghost" type="button" onClick={onClose} aria-label="닫기"><X size={18} aria-hidden="true" /></button>
        </header>
        <ul className="map-scope-options">
          {options.map((option) => {
            const current = option.id === currentGroupId
            return (
              <li key={option.id || 'mine'}>
                <button ref={current ? currentRef : undefined} type="button" aria-current={current ? 'true' : undefined}
                  onClick={() => onSelect(option.id)}>
                  <span><strong>{option.name}</strong><small>{option.detail}</small></span>
                  {current && <Check className="map-scope-check" size={18} aria-hidden="true" />}
                </button>
              </li>
            )
          })}
          {currentGroupId && !groups.some((group) => group.id === currentGroupId) && (
            <li><button type="button" aria-current="true" disabled>
              <span><strong>{loading ? '그룹 불러오는 중…' : '그룹을 찾을 수 없습니다'}</strong></span>
            </button></li>
          )}
        </ul>
        {loading && <p className="map-scope-status" role="status">가입한 그룹을 불러오는 중이에요.</p>}
        {error && <p className="map-scope-status is-error" role="alert">{error} <button type="button" onClick={onRetry}>다시 시도</button></p>}
        <Link className="map-scope-browse" to="/groups" onClick={onClose}>
          그룹 둘러보기<ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </>
  )
}

interface MapScopeChipProps {
  group?: PinGroup
  loading: boolean
  canJoin: boolean
}

// Shows which group the map is scoped to, with its home and a way back to my map.
export function MapScopeChip({ group, loading, canJoin }: MapScopeChipProps) {
  return (
    <>
      <div className="map-scope-chip" role="group" aria-label="지도에 표시 중인 그룹">
        <Compass size={16} aria-hidden="true" />
        <strong>{group?.name || (loading ? '그룹 불러오는 중…' : '그룹')}</strong>
        {group && <Link className="map-scope-home" to={`/groups/${group.id}`}>그룹 홈</Link>}
        <Link className="map-scope-exit" to="/map" aria-label="내 지도로 돌아가기" title="내 지도로 돌아가기"><X size={16} aria-hidden="true" /></Link>
      </div>
      {group && canJoin && <GroupJoinButton groupId={group.id} visibility={group.visibility} joined={false} />}
    </>
  )
}
