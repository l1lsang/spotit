import { onAuthStateChanged, type User } from 'firebase/auth'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from 'react'
import { auth, isFirebaseConfigured } from '../lib/firebase'
import { getUserProfile, upsertUserProfile } from '../services/userService'
import type { DaymarkUser } from '../types/user'
import { AuthContext } from './authContextCore'

export function AuthProvider({ children }: PropsWithChildren): ReactElement {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<DaymarkUser | null>(null)
  const [loading, setLoading] = useState(Boolean(auth) && isFirebaseConfigured)

  const refreshProfile = useCallback(async () => {
    if (!currentUser) {
      setProfile(null)
      return
    }

    const nextProfile = await getUserProfile(currentUser.uid)
    setProfile(nextProfile)
  }, [currentUser])

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      return undefined
    }

    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)

      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        const userProfile = await upsertUserProfile(user)
        setProfile(userProfile)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const value = useMemo(
    () => ({
      currentUser,
      profile,
      loading,
      firebaseReady: Boolean(auth) && isFirebaseConfigured,
      refreshProfile,
    }),
    [currentUser, loading, profile, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
