import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { requireAuth } from '../lib/firebase'
import { getSignupRequirementsError, type SignupRequirements } from '../lib/signupRequirements'
import { deleteUserAccountData, upsertUserProfile } from './userService'

export async function signupWithEmail(
  email: string,
  password: string,
  requirements: SignupRequirements,
): Promise<User> {
  const error = getSignupRequirementsError(requirements)
  if (error) throw new Error(error)
  const credential = await createUserWithEmailAndPassword(requireAuth(), email.trim(), password)

  return credential.user
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(requireAuth(), email, password)
  await upsertUserProfile(credential.user)

  return credential.user
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(requireAuth(), email.trim())
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

export async function loginWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const credential = await signInWithPopup(requireAuth(), provider)
  await upsertUserProfile(credential.user)
  return credential.user
}

export async function logout(): Promise<void> {
  await signOut(requireAuth())
}

export async function deleteAccount(user: User): Promise<void> {
  await deleteUserAccountData(user.uid)
  await deleteUser(user)
}
