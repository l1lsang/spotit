import { Lock, MapPin } from 'lucide-react'
import { PinAlbumGrid } from './PinAlbumGrid'
import type { ProfileAlbumState } from './useProfileAlbum'

export function ProfilePinAlbum({ state, own }: { state: ProfileAlbumState; own: boolean }) {
  const { album, loading, error, retry } = state
  return <section className="profile-view-album" aria-label={own ? '내 핀' : '핀'} aria-busy={loading}>
    {loading && <p className="pin-album-state" role="status">핀을 불러오는 중입니다.</p>}
    {error && <div className="pin-album-state" role="alert"><p>{error}</p>
      <button className="button button-secondary" type="button" onClick={retry}>다시 시도</button>
    </div>}
    {!loading && album?.access === 'locked' && <div className="pin-album-state"><Lock size={26} aria-hidden="true" /><p>비공개 계정입니다.</p><small>팔로우 요청이 승인되면 공개된 핀을 볼 수 있어요.</small></div>}
    {!loading && album && album.access !== 'locked' && (album.posts.length ? <PinAlbumGrid posts={album.posts} showVisibility={own} />
      : <div className="pin-album-state"><MapPin size={28} aria-hidden="true" /><p>{own ? '아직 남긴 핀이 없습니다.' : '볼 수 있는 핀이 없습니다.'}</p></div>)}
  </section>
}
