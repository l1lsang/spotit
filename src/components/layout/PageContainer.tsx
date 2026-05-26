import type { PropsWithChildren } from 'react'
import { BottomNav } from './BottomNav'
import { FirebaseNotice } from './FirebaseNotice'
import { Header } from './Header'

interface PageContainerProps {
  className?: string
  fullBleed?: boolean
  hideBottomNav?: boolean
}

export function PageContainer({
  children,
  className = '',
  fullBleed = false,
  hideBottomNav = false,
}: PropsWithChildren<PageContainerProps>) {
  return (
    <div className={`app-shell ${hideBottomNav ? 'app-shell-no-bottom-nav' : ''}`}>
      <Header />
      <FirebaseNotice />
      <main className={`${fullBleed ? 'page page-full' : 'page'} ${className}`}>{children}</main>
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
