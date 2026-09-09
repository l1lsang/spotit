import { Grid3X3, Lock, MapPin, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getProfilePosts } from '../../services/postService'
import { PinAlbumGrid } from './PinAlbumGrid'

export function ProfilePinAlbum({ ownerUid, refreshKey = 0 }: { ownerUid: string; refreshKey?: number }) {
  const { currentUser } = useAuth()
  const viewerUid = currentUser?.uid
  const [album, setAlbum] = useState<Awaited<ReturnType<typeof getProfilePosts>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const ownAlbum = viewerUid === ownerUid

  useEffect(() => {
    let active = true
    setLoading(true)
    setAlbum(null)
    setError('')
    void getProfilePosts(ownerUid, viewerUid).then(result => {
      if (active) setAlbum(result)
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : '핀을 불러오지 못했습니다.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [ownerUid, viewerUid, refreshKey, revision])

  return <section className="profile-pin-album" aria-labelledby="profile-pin-album-title">
    <div className="pin-album-heading">
      <h2 id="profile-pin-album-title"><Grid3X3 size={18} aria-hidden="true" />{ownAlbum ? '내 핀' : '핀'}
        {album && album.access !== 'locked' && <span>{album.posts.length}</span>}
      </h2>
      <button className="button-icon subtle" type="button" disabled={loading} onClick={() => setRevision(value => value + 1)} aria-label="핀 앨범 새로고침"><RefreshCw size={17} aria-hidden="true" /></button>
    </div>
    {loading && <p className="pin-album-state" role="status">핀을 불러오는 중입니다.</p>}
    {error && <div className="pin-album-state" role="alert"><p>{error}</p>
      <button className="button button-secondary" type="button" onClick={() => setRevision(value => value + 1)}>다시 시도</button>
    </div>}
    {!loading && album?.access === 'locked' && <div className="pin-album-state"><Lock size={26} aria-hidden="true" /><p>비공개 계정입니다.</p><small>팔로우 요청이 승인되면 공개된 핀을 볼 수 있어요.</small></div>}
    {!loading && album && album.access !== 'locked' && (album.posts.length ? <PinAlbumGrid posts={album.posts} showVisibility={ownAlbum} />
      : <div className="pin-album-state"><MapPin size={28} aria-hidden="true" /><p>{ownAlbum ? '아직 남긴 핀이 없습니다.' : '볼 수 있는 핀이 없습니다.'}</p></div>)}
  </section>
}
