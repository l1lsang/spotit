import { ArrowUpRight } from 'lucide-react'
import { appStores } from '../../lib/appStores'

export function AppStoreButtons({ primary = false }: { primary?: boolean }) {
  return (
    <div className="store-buttons">
      {appStores.map(({ platform, name, url }) => url
        ? <a key={platform} className={`button ${primary ? 'button-primary' : 'button-secondary'} store-button`}
          href={url} target="_blank" rel="noopener noreferrer">
          {name}에서 받기 <ArrowUpRight size={16} aria-hidden="true" />
        </a>
        : <span key={platform} className="button button-secondary store-button" aria-disabled="true">
          {name} <small>준비 중</small>
        </span>)}
    </div>
  )
}
