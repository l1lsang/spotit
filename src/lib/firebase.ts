import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'

// The web only calls Cloud Functions from the admin page; auth, Firestore and Storage are used by the app.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let initializedApp: FirebaseApp | null = null
if (Object.values(firebaseConfig).every(Boolean)) {
  try {
    initializedApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
  } catch {
    initializedApp = null
  }
}

export const firebaseApp = initializedApp
