import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging'
import { firebaseApp, requireDb } from '../lib/firebase'

export type PushPermissionStatus = 'unsupported' | 'not-configured' | 'granted' | 'denied' | 'prompt'

const vapidKey = import.meta.env.VITE_FIREBASE_MESSAGING_VAPID_KEY
const tokenDocIdStorageKey = 'spotit-fcm-token-doc-id'

export const isPushConfigured = Boolean(vapidKey)

async function hashToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))

  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.')
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration('/')

  if (existingRegistration) {
    return existingRegistration
  }

  return navigator.serviceWorker.register('/sw.js')
}

export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!isPushConfigured) {
    return 'not-configured'
  }

  if (!('Notification' in window) || !(await isSupported())) {
    return 'unsupported'
  }

  return Notification.permission === 'default' ? 'prompt' : Notification.permission
}

export async function enablePushNotifications(uid: string): Promise<void> {
  if (!firebaseApp) {
    throw new Error('Firebase가 아직 준비되지 않았습니다.')
  }

  if (!isPushConfigured) {
    throw new Error('.env에 VITE_FIREBASE_MESSAGING_VAPID_KEY를 설정해 주세요.')
  }

  if (!('Notification' in window) || !(await isSupported())) {
    throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.')
  }

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()

  if (permission !== 'granted') {
    throw new Error('브라우저 알림 권한이 허용되지 않았습니다.')
  }

  const registration = await getServiceWorkerRegistration()
  const token = await getToken(getMessaging(firebaseApp), {
    vapidKey,
    serviceWorkerRegistration: registration,
  })

  if (!token) {
    throw new Error('푸시 알림 토큰을 발급받지 못했습니다.')
  }

  const tokenDocId = await hashToken(token)
  const tokenRef = doc(requireDb(), 'users', uid, 'fcmTokens', tokenDocId)

  await setDoc(
    tokenRef,
    {
      token,
      tokenDocId,
      platform: 'web',
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  window.localStorage.setItem(tokenDocIdStorageKey, tokenDocId)
}

export async function disablePushNotifications(uid: string): Promise<void> {
  const tokenDocId = window.localStorage.getItem(tokenDocIdStorageKey)

  if (!tokenDocId) {
    return
  }

  await deleteDoc(doc(requireDb(), 'users', uid, 'fcmTokens', tokenDocId))
  window.localStorage.removeItem(tokenDocIdStorageKey)
}

export async function subscribeToForegroundPushMessages(
  onPushMessage: (payload: MessagePayload) => void,
): Promise<() => void> {
  if (!firebaseApp || !isPushConfigured || !(await isSupported())) {
    return () => undefined
  }

  return onMessage(getMessaging(firebaseApp), onPushMessage)
}
