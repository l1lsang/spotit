import { type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { FeedPage } from '../pages/FeedPage'
import { LandingPage } from '../pages/LandingPage'
import { LoginPage } from '../pages/LoginPage'
import { MapPage } from '../pages/MapPage'
import { MyPostsPage } from '../pages/MyPostsPage'
import { PeoplePage } from '../pages/PeoplePage'
import { PostDetailPage } from '../pages/PostDetailPage'
import { ProfilePage } from '../pages/ProfilePage'
import { SignupPage } from '../pages/SignupPage'

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

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/posts/:postId" element={<PostDetailPage />} />
        <Route
          path="/people"
          element={
            <ProtectedRoute>
              <PeoplePage />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
