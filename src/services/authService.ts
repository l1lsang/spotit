import {
  createUserWithEmailAndPassword,
  OAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { requireAuth } from '../lib/firebase'
import { upsertUserProfile } from './userService'

export async function signupWithEmail(
  email: string,
  password: string,
  nickname: string,
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(requireAuth(), email, password)
  await updateProfile(credential.user, { displayName: nickname.trim() })
  await upsertUserProfile(credential.user, nickname)

  return credential.user
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(requireAuth(), email, password)
  await upsertUserProfile(credential.user)

  return credential.user
}

export async function loginWithKakao(): Promise<User> {
  const providerId = import.meta.env.VITE_FIREBASE_KAKAO_PROVIDER_ID || 'oidc.kakao'
  const provider = new OAuthProvider(providerId)
  provider.addScope('profile_nickname')
  provider.addScope('profile_image')

  const credential = await signInWithPopup(requireAuth(), provider)
  await upsertUserProfile(credential.user)

  return credential.user
}

export async function logout(): Promise<void> {
  await signOut(requireAuth())
}
