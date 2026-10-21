import { Heart, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PinAlbumGrid } from './PinAlbumGrid'
import type { LikedPostsState } from './useProfileAlbum'

export function LikedPinAlbum({ state }: { state: LikedPostsState }) {
  const { posts, loading, error, retry } = state
  return <section className="profile-view-album" aria-label="좋아요한 핀" aria-busy={loading}>
    {loading && <p className="pin-album-state" role="status">좋아요한 핀을 불러오는 중이에요.</p>}
    {error && <div className="pin-album-state" role="alert"><p>{error}</p>
      <button className="button button-secondary" type="button" onClick={retry}><RefreshCw size={17} aria-hidden="true" />다시 시도</button>
    </div>}
    {!loading && !error && (posts.length ? <PinAlbumGrid posts={posts} />
      : <div className="pin-album-state"><Heart size={28} aria-hidden="true" /><p>아직 좋아요한 핀이 없어요.</p>
        <small>피드나 지도에서 마음에 드는 핀에 좋아요를 눌러보세요.</small>
        <Link className="button button-secondary" to="/feed">피드 둘러보기</Link>
      </div>)}
  </section>
}
