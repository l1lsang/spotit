import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLinkPage } from '../pages/AppLinkPage'
import { LandingPage } from '../pages/LandingPage'

const CompanyPage = lazy(() => import('../pages/CompanyPage').then(module => ({ default: module.CompanyPage })))
const AdminPage = lazy(() => import('../pages/AdminPage').then(module => ({ default: module.AdminPage })))
const OpenSourceLicensesPage = lazy(() => import('../pages/OpenSourceLicensesPage').then(module => ({ default: module.OpenSourceLicensesPage })))
const PoliciesPage = lazy(() => import('../pages/PoliciesPage').then(module => ({ default: module.PoliciesPage })))

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="screen-message">화면을 불러오는 중입니다.</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/company" element={<CompanyPage />} />

          {/* Shared links. With the app installed, universal/app links (public/.well-known) open the app
              directly; otherwise the browser lands here and offers the store. */}
          <Route path="/posts/:id" element={<AppLinkPage kind="post" />} />
          <Route path="/feed/:id" element={<AppLinkPage kind="post" />} />
          <Route path="/groups/:id" element={<AppLinkPage kind="group" />} />
          <Route path="/people/:id" element={<AppLinkPage kind="profile" />} />
          <Route path="/chats/:id" element={<AppLinkPage kind="chat" />} />

          <Route path="/policies/:policyId?" element={<PoliciesPage />} />
          <Route path="/licenses" element={<OpenSourceLicensesPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
