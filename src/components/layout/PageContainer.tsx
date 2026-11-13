import type { PropsWithChildren } from 'react'

export function PageContainer({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className="app-shell app-shell-no-bottom-nav">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <main id="main-content" tabIndex={-1} className={`page ${className}`}>{children}</main>
    </div>
  )
}
