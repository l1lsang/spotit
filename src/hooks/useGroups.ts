import { useEffect, useState } from 'react'
import { subscribeGroups, subscribeMyGroupIds } from '../services/groupService'
import type { PinGroup } from '../types/group'
import { useAuth } from './useAuth'

export function useGroups(enabled = true) {
  const { currentUser, firebaseReady } = useAuth()
  const uid = currentUser?.uid
  const [groups, setGroups] = useState<PinGroup[]>([])
  const [joinedIds, setJoinedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    setGroups([])
    setJoinedIds([])
    setError('')
    if (!enabled || !uid || !firebaseReady) { setLoading(false); return }
    setLoading(true)
    let groupsReady = false
    let membershipsReady = false
    const failed = () => { setError('그룹을 불러오지 못했습니다. 다시 시도해 주세요.'); setLoading(false) }
    const stopGroups = subscribeGroups(next => {
      setGroups(next)
      groupsReady = true
      if (membershipsReady) setLoading(false)
    }, failed)
    const stopMemberships = subscribeMyGroupIds(uid, ids => {
      setJoinedIds(ids)
      membershipsReady = true
      if (groupsReady) setLoading(false)
    }, failed)
    return () => { stopGroups(); stopMemberships() }
  }, [uid, firebaseReady, enabled, revision])

  return { groups, joinedIds, loading, error, retry: () => setRevision(value => value + 1) }
}
