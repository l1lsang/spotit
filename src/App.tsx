import { ForegroundPushListener } from './components/layout/ForegroundPushListener'
import { InstallPrompt } from './components/layout/InstallPrompt'
import { PushPermissionPrompt } from './components/layout/PushPermissionPrompt'
import { AuthProvider } from './contexts/AuthContext'
import { AppRouter } from './routes/AppRouter'

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
      <ForegroundPushListener />
      <InstallPrompt />
      <PushPermissionPrompt />
    </AuthProvider>
  )
}
