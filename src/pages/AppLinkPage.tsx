import { ArrowUpRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { AppStoreButtons } from '../components/layout/AppStoreButtons'
import { BrandLogo } from '../components/layout/BrandLogo'
import { PolicyFooter } from '../components/layout/PolicyFooter'
import { androidIntentUrl, isAndroid } from '../lib/appStores'

export type AppLinkKind = 'post' | 'group' | 'profile' | 'chat'

const copy: Record<AppLinkKind, { title: string; body: string }> = {
  post: { title: '공유받은 핀이 있어요', body: '피노리 앱에서 사진과 장소를 확인해 보세요.' },
  group: { title: '그룹에 초대받았어요', body: '피노리 앱에서 그룹을 둘러보고 함께 장소를 모아보세요.' },
  profile: { title: '프로필을 공유받았어요', body: '피노리 앱에서 이 사람이 남긴 장소를 둘러보세요.' },
  chat: { title: '채팅방 링크예요', body: '피노리 앱에서 대화를 이어가세요.' },
}

export function AppLinkPage({ kind }: { kind: AppLinkKind }) {
  const { pathname, search } = useLocation()
  const { title, body } = copy[kind]

  return (
    <div className="app-link-page">
      <header className="app-link-header">
        <Link to="/" aria-label="피노리 홈"><BrandLogo /></Link>
      </header>
      <main id="main-content" className="app-link-main">
        <img className="app-link-icon" src="/icon-512.png" alt="" width="88" height="88" />
        <h1>{title}</h1>
        <p>{body}</p>
        {isAndroid() && (
          <a className="button button-primary app-link-open" href={androidIntentUrl(pathname + search)}>
            앱에서 열기 <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        )}
        <p className="app-link-hint">앱이 없다면 설치한 뒤 링크를 다시 눌러주세요.</p>
        <AppStoreButtons />
      </main>
      <footer className="app-link-footer"><PolicyFooter showCredit={false} /></footer>
    </div>
  )
}
