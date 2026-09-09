import type { PropsWithChildren } from 'react'
import { BottomNav } from './BottomNav'
import { FirebaseNotice } from './FirebaseNotice'
import { Header } from './Header'

interface PageContainerProps {
  className?: string
  fullBleed?: boolean
  fillViewport?: boolean
  hideBottomNav?: boolean
  hideFirebaseNotice?: boolean
  hideHeader?: boolean
}

export function PageContainer({
  children,
  className = '',
  fullBleed = false,
  fillViewport = false,
  hideBottomNav = false,
  hideFirebaseNotice = false,
  hideHeader = false,
}: PropsWithChildren<PageContainerProps>) {
  return (
    <div className={`app-shell ${hideBottomNav ? 'app-shell-no-bottom-nav' : ''} ${fillViewport ? 'app-shell-viewport' : ''}`}>
      {!hideHeader && <Header />}
      {!hideFirebaseNotice && <FirebaseNotice />}
      <main className={`${fullBleed ? 'page page-full' : 'page'} ${className}`}>{children}</main>
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
