import type { PropsWithChildren } from 'react'
import { BottomNav } from './BottomNav'
import { FirebaseNotice } from './FirebaseNotice'
import { Header } from './Header'

interface PageContainerProps {
  className?: string
  fullBleed?: boolean
}

export function PageContainer({
  children,
  className = '',
  fullBleed = false,
}: PropsWithChildren<PageContainerProps>) {
  return (
    <div className="app-shell">
      <Header />
      <FirebaseNotice />
      <main className={`${fullBleed ? 'page page-full' : 'page'} ${className}`}>{children}</main>
      <BottomNav />
    </div>
  )
}
