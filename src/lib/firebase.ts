import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const missingFirebaseEnvKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase()}`)

export const isFirebaseConfigured = missingFirebaseEnvKeys.length === 0

let initializedApp: FirebaseApp | null = null
let initializedAuth: Auth | null = null
let initializedDb: Firestore | null = null
let initializedStorage: FirebaseStorage | null = null
let initializationError = ''

if (isFirebaseConfigured) {
  try {
    initializedApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
    initializedAuth = getAuth(initializedApp)
    initializedDb = getFirestore(initializedApp)
    initializedStorage = getStorage(initializedApp)
  } catch (error) {
    initializationError =
      error instanceof Error ? error.message : 'Firebase 초기화 중 알 수 없는 오류가 발생했습니다.'
  }
}

export const firebaseApp = initializedApp
export const auth = initializedAuth
export const db = initializedDb
export const storage = initializedStorage
export const firebaseInitializationError = initializationError

export const firebaseConfigMessage = !isFirebaseConfigured
  ? `.env에 Firebase 환경변수가 필요합니다: ${missingFirebaseEnvKeys.join(', ')}`
  : initializationError

export function requireAuth(): Auth {
  if (!auth) {
    throw new Error(firebaseConfigMessage || 'Firebase Auth를 사용할 수 없습니다.')
  }

  return auth
}

export function requireDb(): Firestore {
  if (!db) {
    throw new Error(firebaseConfigMessage || 'Firestore를 사용할 수 없습니다.')
  }

  return db
}

export function requireStorage(): FirebaseStorage {
  if (!storage) {
    throw new Error(firebaseConfigMessage || 'Firebase Storage를 사용할 수 없습니다.')
  }

  return storage
}
