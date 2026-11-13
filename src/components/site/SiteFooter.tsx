import { PolicyFooter } from '../layout/PolicyFooter'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-wrap site-footer-inner">
        <span>© {new Date().getFullYear()} 피노리</span>
        <PolicyFooter showCredit={false} />
      </div>
    </footer>
  )
}
