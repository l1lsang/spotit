import { useAuth } from '../hooks/useAuth'
import { PersonProfile } from './PersonProfilePage'

export function ProfilePage() {
  const { currentUser } = useAuth()
  return currentUser ? <PersonProfile key={currentUser.uid} userId={currentUser.uid} /> : null
}
