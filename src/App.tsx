import { AuthProvider } from './contexts/AuthContext'
import { AppRouter } from './routes/AppRouter'

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
