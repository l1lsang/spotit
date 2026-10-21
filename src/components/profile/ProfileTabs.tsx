import { Grid3X3, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'

export type ProfileTab = 'pins' | 'likes'

// Tabs replace the URL entry, so returning from a pin lands on the same tab.
export function ProfileTabs({ active }: { active: ProfileTab }) {
  return <nav className="profile-view-tabs" aria-label="프로필 핀 보기">
    <Link className="profile-view-tab" to={{ search: '' }} replace aria-current={active === 'pins' ? 'page' : undefined}>
      <Grid3X3 size={18} aria-hidden="true" />핀
    </Link>
    <Link className="profile-view-tab" to={{ search: '?tab=likes' }} replace aria-current={active === 'likes' ? 'page' : undefined}>
      <Heart size={18} aria-hidden="true" />좋아요
    </Link>
  </nav>
}

export function ProfileSingleTab({ label }: { label: string }) {
  return <div className="profile-view-tabs">
    <h2 className="profile-view-tab is-active"><Grid3X3 size={18} aria-hidden="true" />{label}</h2>
  </div>
}
