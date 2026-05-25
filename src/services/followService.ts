import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import type { FollowEdge } from '../types/follow'
import type { DaymarkUser } from '../types/user'

type FollowPerson = Pick<DaymarkUser, 'uid' | 'nickname' | 'photoURL'>

function toFollowEdge(person: FollowPerson): Omit<FollowEdge, 'createdAt'> {
  return {
    uid: person.uid,
    nickname: person.nickname,
    photoURL: person.photoURL || '',
  }
}

export async function isFollowing(viewerUid: string, targetUid: string): Promise<boolean> {
  if (viewerUid === targetUid) {
    return true
  }

  const snapshot = await getDoc(doc(requireDb(), 'users', viewerUid, 'following', targetUid))

  return snapshot.exists()
}

export async function followUser(currentUser: FollowPerson, targetUser: FollowPerson): Promise<void> {
  if (currentUser.uid === targetUser.uid) {
    throw new Error('자기 자신은 팔로우할 수 없습니다.')
  }

  const db = requireDb()
  const followingRef = doc(db, 'users', currentUser.uid, 'following', targetUser.uid)
  const followerRef = doc(db, 'users', targetUser.uid, 'followers', currentUser.uid)
  const existing = await getDoc(followingRef)

  if (existing.exists()) {
    return
  }

  const batch = writeBatch(db)
  batch.set(followingRef, {
    ...toFollowEdge(targetUser),
    createdAt: serverTimestamp(),
  })
  batch.set(followerRef, {
    ...toFollowEdge(currentUser),
    createdAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', currentUser.uid), {
    followingCount: increment(1),
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', targetUser.uid), {
    followerCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function unfollowUser(currentUid: string, targetUid: string): Promise<void> {
  const db = requireDb()
  const followingRef = doc(db, 'users', currentUid, 'following', targetUid)
  const followerRef = doc(db, 'users', targetUid, 'followers', currentUid)
  const existing = await getDoc(followingRef)

  if (!existing.exists()) {
    return
  }

  const batch = writeBatch(db)
  batch.delete(followingRef)
  batch.delete(followerRef)
  batch.update(doc(db, 'users', currentUid), {
    followingCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', targetUid), {
    followerCount: increment(-1),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function removeFollower(ownerUid: string, followerUid: string): Promise<void> {
  await unfollowUser(followerUid, ownerUid)
}

export async function getFollowingIds(uid: string): Promise<string[]> {
  const snapshot = await getDocs(collection(requireDb(), 'users', uid, 'following'))

  return snapshot.docs.map((followDoc) => followDoc.id)
}

export async function getFollowers(uid: string): Promise<FollowEdge[]> {
  const snapshot = await getDocs(collection(requireDb(), 'users', uid, 'followers'))

  return snapshot.docs.map((followDoc) => followDoc.data() as FollowEdge)
}

export async function getFollowing(uid: string): Promise<FollowEdge[]> {
  const snapshot = await getDocs(collection(requireDb(), 'users', uid, 'following'))

  return snapshot.docs.map((followDoc) => followDoc.data() as FollowEdge)
}
