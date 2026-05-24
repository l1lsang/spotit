import type { User as FirebaseUser } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import type { DaymarkUser } from '../types/user'

export function getFallbackNickname(user: Pick<FirebaseUser, 'displayName' | 'email'>): string {
  return user.displayName || user.email?.split('@')[0] || 'daymarker'
}

export async function getUserProfile(uid: string): Promise<DaymarkUser | null> {
  const snapshot = await getDoc(doc(requireDb(), 'users', uid))

  if (!snapshot.exists()) {
    return null
  }

  return snapshot.data() as DaymarkUser
}

export async function upsertUserProfile(user: FirebaseUser, nickname?: string): Promise<DaymarkUser> {
  const db = requireDb()
  const userRef = doc(db, 'users', user.uid)
  const snapshot = await getDoc(userRef)
  const nextNickname = nickname?.trim() || getFallbackNickname(user)
  const baseProfile = {
    uid: user.uid,
    email: user.email || '',
    updatedAt: serverTimestamp(),
  }

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      ...baseProfile,
      photoURL: user.photoURL || '',
      nickname: nextNickname,
      followerCount: 0,
      followingCount: 0,
      createdAt: serverTimestamp(),
    })
  } else {
    await setDoc(
      userRef,
      {
        ...baseProfile,
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
        ...(nickname ? { nickname: nextNickname } : {}),
      },
      { merge: true },
    )
  }

  const updated = await getDoc(userRef)

  return updated.data() as DaymarkUser
}

export async function updateUserNickname(uid: string, nickname: string): Promise<void> {
  await updateDoc(doc(requireDb(), 'users', uid), {
    nickname: nickname.trim(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateUserPhotoURL(uid: string, photoURL: string): Promise<void> {
  await updateDoc(doc(requireDb(), 'users', uid), {
    photoURL,
    updatedAt: serverTimestamp(),
  })
}

export async function listUsers(): Promise<DaymarkUser[]> {
  const snapshot = await getDocs(collection(requireDb(), 'users'))

  return snapshot.docs.map((userDoc) => userDoc.data() as DaymarkUser)
}
