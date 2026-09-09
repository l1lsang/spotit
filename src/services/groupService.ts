import {
  collection, doc, getDoc, increment, onSnapshot, orderBy, query, runTransaction, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import { getGroupInputError, type GroupInput, type PinGroup } from '../types/group'

export function subscribeGroups(onChange: (groups: PinGroup[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(collection(requireDb(), 'groups'), orderBy('createdAt', 'desc')), snapshot => {
    onChange(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as PinGroup))
  }, onError)
}

export function subscribeMyGroupIds(uid: string, onChange: (ids: string[]) => void, onError: (error: Error) => void) {
  return onSnapshot(collection(requireDb(), 'users', uid, 'groupMemberships'), snapshot => {
    onChange(snapshot.docs.map(item => item.id))
  }, onError)
}

export async function createGroup(input: GroupInput, uid: string): Promise<string> {
  const error = getGroupInputError(input)
  if (error) throw new Error(error)
  const db = requireDb()
  const group = doc(collection(db, 'groups'))
  const membership = { uid, groupId: group.id, joinedAt: serverTimestamp() }
  const batch = writeBatch(db)
  batch.set(group, {
    name: input.name.trim(), description: input.description.trim(), ownerUid: uid,
    memberCount: 1, createdAt: serverTimestamp(),
  })
  batch.set(doc(group, 'members', uid), membership)
  batch.set(doc(db, 'users', uid, 'groupMemberships', group.id), membership)
  await batch.commit()
  return group.id
}

// The membership, personal index, and count change together, including when two tabs join at once.
export async function setGroupMembership(groupId: string, uid: string, joined: boolean): Promise<void> {
  const db = requireDb()
  const groupRef = doc(db, 'groups', groupId)
  const memberRef = doc(groupRef, 'members', uid)
  const indexRef = doc(db, 'users', uid, 'groupMemberships', groupId)
  try { await runTransaction(db, async transaction => {
    const group = await transaction.get(groupRef)
    const member = await transaction.get(memberRef)
    if (!group.exists()) throw new Error('그룹을 찾을 수 없습니다.')
    if (member.exists() === joined) return
    if (joined) {
      const membership = { uid, groupId, joinedAt: serverTimestamp() }
      transaction.set(memberRef, membership)
      transaction.set(indexRef, membership)
    } else {
      transaction.delete(memberRef)
      transaction.delete(indexRef)
    }
    transaction.update(groupRef, { memberCount: increment(joined ? 1 : -1) })
  }) } catch (error) {
    // A concurrent request may have committed the same join/leave before rules evaluate this write.
    // Only acknowledge success after reading the requested state under this user's own permissions.
    if ((error as { code?: string }).code === 'permission-denied' && (await getDoc(memberRef)).exists() === joined) return
    throw error
  }
}
