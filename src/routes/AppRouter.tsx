import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isPublicPolicyPath } from '../lib/policyNavigation'
import { InstallPrompt } from '../components/layout/InstallPrompt'
import { ChatListPage } from '../pages/ChatListPage'
import { ChatRoomPage } from '../pages/ChatRoomPage'
import { FeedPage } from '../pages/FeedPage'
import { LandingPage } from '../pages/LandingPage'
import { LoginPage } from '../pages/LoginPage'
import { MapPage } from '../pages/MapPage'
import { MyPostsPage } from '../pages/MyPostsPage'
import { NotificationsPage } from '../pages/NotificationsPage'
import { PeoplePage } from '../pages/PeoplePage'
import { PersonProfilePage } from '../pages/PersonProfilePage'
import { PostDetailPage } from '../pages/PostDetailPage'
import { ProfilePage } from '../pages/ProfilePage'
import { ProfileSettingsPage } from '../pages/ProfileSettingsPage'
import { SignupPage } from '../pages/SignupPage'
import { SupportPage } from '../pages/SupportPage'

const AdminPage = lazy(() => import('../pages/AdminPage').then(module => ({ default: module.AdminPage })))
const OpenSourceLicensesPage = lazy(() => import('../pages/OpenSourceLicensesPage').then(module => ({ default: module.OpenSourceLicensesPage })))
const PoliciesPage = lazy(() => import('../pages/PoliciesPage').then(module => ({ default: module.PoliciesPage })))

function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { currentUser, loading } = useAuth()

  if (loading) {
    return <div className="screen-message">로그인 상태를 확인하는 중입니다.</div>
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

function OnboardingGuard({ children }: { children: ReactNode }) {
  const { currentUser, profile, loading, profileError, refreshProfile } = useAuth()
  const location = useLocation()
  if (isPublicPolicyPath(location.pathname) || location.pathname === '/signup' || ['/admin', '/licenses'].includes(location.pathname.replace(/\/$/, ''))) return children
  if (loading) return <div className="screen-message">로그인 상태를 확인하는 중입니다.</div>
  if (currentUser && profileError) {
    return (
      <div className="screen-message" role="alert">
        <p>{profileError}</p>
        <button className="button button-primary" onClick={() => void refreshProfile().catch(() => undefined)}>
          다시 시도
        </button>
      </div>
    )
  }
  if (currentUser && profile?.onboardingComplete === false) return <Navigate to="/signup" replace />
  return children
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <OnboardingGuard>
        <Routes>
          <Route path="/admin" element={<Suspense fallback={<div className="screen-message">관리자 화면을 불러오는 중…</div>}><AdminPage /></Suspense>} />
          <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/licenses" element={<Suspense fallback={<div className="screen-message">라이선스를 불러오는 중입니다.</div>}><OpenSourceLicensesPage /></Suspense>} />
          <Route path="/policies/:policyId?" element={<Suspense fallback={<div className="screen-message">약관 및 정책을 불러오는 중입니다.</div>}><PoliciesPage /></Suspense>} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/posts/:postId" element={<PostDetailPage />} />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/people"
            element={
              <ProtectedRoute>
                <PeoplePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/people/:userId"
            element={
              <ProtectedRoute>
                <PersonProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chats"
            element={
              <ProtectedRoute>
                <ChatListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chats/:chatId"
            element={
              <ProtectedRoute>
                <ChatRoomPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my"
            element={
              <ProtectedRoute>
                <MyPostsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/profile/settings" element={<ProtectedRoute><ProfileSettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </OnboardingGuard>
      <InstallPrompt />
    </BrowserRouter>
  )
}
