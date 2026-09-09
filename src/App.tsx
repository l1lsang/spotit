import { ForegroundPushListener } from './components/layout/ForegroundPushListener'
import { PushPermissionPrompt } from './components/layout/PushPermissionPrompt'
import { AuthProvider } from './contexts/AuthContext'
import { LocationConsentProvider } from './contexts/LocationConsentProvider'
import { AppRouter } from './routes/AppRouter'

export function App() {
  return (
    <AuthProvider>
      <LocationConsentProvider><AppRouter /></LocationConsentProvider>
      <ForegroundPushListener />
      <PushPermissionPrompt />
    </AuthProvider>
  )
}
