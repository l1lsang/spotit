import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { ReportButton } from '../components/moderation/ReportButton'
import { MapView } from '../components/map/MapView'
import { getExternalMapUrl } from '../lib/mapLocation'
import { PostInteractions } from '../components/post/PostInteractions'
import { PostActionsMenu } from '../components/post/PostActionsMenu'
import { PostFormModal, type PostFormSubmitPayload } from '../components/post/PostFormModal'
import { useAuth } from '../hooks/useAuth'
import type { Post, PostFormInput } from '../types/post'
import { formatDateKey, formatTimestamp } from '../lib/date'
import { deletePost, getPostById, updatePost } from '../services/postService'

export function PostDetailPage() {
  const { postId = '' } = useParams()
  const navigate = useNavigate()
  const { currentUser, firebaseReady } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState('')

  const isOwner = Boolean(currentUser && post?.uid === currentUser.uid)

  const loadDetail = useCallback(async () => {
    if (!firebaseReady || !postId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const nextPost = await getPostById(postId, currentUser?.uid)
      setPost(nextPost)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '기록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentUser, firebaseReady, postId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  async function handleDeletePost() {
    if (!currentUser || !post || !isOwner || deleting || !window.confirm('이 기록을 삭제할까요?')) {
      return
    }

    setDeleting(true)
    setActionError('')
    try {
      await deletePost(post.id, currentUser.uid)
      navigate('/my')
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : '기록을 삭제하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSharePost() {
    if (!post) {
      return
    }

    const shareUrl = `${window.location.origin}/posts/${post.id}`
    const shareData = {
      title: post.title,
      text: `${post.placeName} 핀을 공유합니다.`,
      url: shareUrl,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
        setShareMessage('공유 창을 열었습니다.')
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setShareMessage('공유 링크를 복사했습니다.')
      }
    } catch (shareError) {
      if ((shareError as { name?: string }).name !== 'AbortError') {
        setShareMessage('공유 링크를 만들지 못했습니다.')
      }
    }
  }

  async function handleUpdatePost(payload: PostFormSubmitPayload) {
    if (!currentUser || !post) {
      return
    }

    const input: PostFormInput = {
      title: payload.title,
      content: payload.content,
      placeName: payload.placeName,
      address: payload.address,
      lat: payload.lat,
      lng: payload.lng,
      dateKey: payload.dateKey,
      visibility: payload.visibility,
      pinColor: payload.pinColor,
      pinThemeId: payload.pinThemeId || '',
      groupId: payload.groupId || '',
    }

    await updatePost(post.id, input, payload.existingPhotoUrls, payload.files, currentUser.uid)
    setIsEditOpen(false)
    await loadDetail()
  }

  if (loading) {
    return (
      <PageContainer className="content-page">
        <p className="empty-text">기록을 불러오는 중입니다.</p>
      </PageContainer>
    )
  }

  if (error || !post) {
    return (
      <PageContainer className="content-page">
        <div className="empty-state">
          <h1>기록을 찾을 수 없습니다.</h1>
          <p>{error || '비공개 기록이거나 삭제된 기록입니다.'}</p>
          <Link className="button button-primary" to="/feed">
            피드로 돌아가기
          </Link>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="content-page post-detail-page">
      <article className="detail-layout">
        <section className="detail-main">
          <div className="detail-heading">
            {post.groupId && <Link className="pill" to={`/groups/${post.groupId}`}>이 핀의 그룹 둘러보기 →</Link>}
            <div className="detail-title-row">
              <div className="detail-title">
                <p className="eyebrow">{formatDateKey(post.dateKey)}</p>
                <h1>{post.title}</h1>
              </div>
              <PostActionsMenu key={post.id} post={post} isOwner={isOwner} canReport={Boolean(currentUser) && !isOwner}
                busy={deleting} onEdit={() => setIsEditOpen(true)} onShare={() => void handleSharePost()} onDelete={() => void handleDeletePost()} />
            </div>
          </div>

          {post.photoUrls.length > 0 && (
            <div className="photo-gallery">
              {post.photoUrls.map((url, index) => (
                <figure className="reportable-post-photo" key={`${url}-${index}`}>
                  <img src={url} alt={`${post.title} 사진 ${index + 1}`} />
                  {!isOwner && <figcaption>
                    <span>사진 {index + 1}</span>
                    {currentUser ? <ReportButton compact label="사진 신고" target={{ kind: 'photo', sourceKind: 'pin', targetId: post.id, photoUrl: url, label: `${post.title} 사진 ${index + 1}` }} />
                      : <Link to="/login" state={{ from: `/posts/${post.id}` }}>로그인 후 사진 신고</Link>}
                  </figcaption>}
                </figure>
              ))}
            </div>
          )}

          <p className="detail-content">{post.content}</p>

          {actionError && <p className="form-error compact-message" role="alert">{actionError}</p>}
          {shareMessage && <p className="form-success compact-message" role="status">{shareMessage}</p>}

          <PostInteractions key={post.id} post={post} expanded />
        </section>

        <aside className="detail-aside">
          <div className="info-panel">
            <h2>장소</h2>
            <p>{post.address || post.placeName}</p>
            <small>
              좌표 {post.lat.toFixed(5)}, {post.lng.toFixed(5)}
            </small>
            <a className="preview-map-link" href={getExternalMapUrl(post)} target="_blank" rel="noopener noreferrer">지도에서 위치 열기</a>
          </div>
          <MapView
            className="mini-map"
            center={{ lat: post.lat, lng: post.lng }}
            posts={[post]}
            onMapClick={() => undefined}
            onMarkerClick={() => undefined}
            currentUserUid={currentUser?.uid}
          />
          <div className="info-panel">
            <h2>기록 정보</h2>
            <p>
              {post.visibility === 'private'
                ? '비공개 기록'
                : post.visibility === 'public'
                  ? '전체 공개 기록'
                  : post.visibility === 'group' ? '그룹 멤버 공개 기록' : '팔로워 공개 기록'}
            </p>
            <small>작성 {formatTimestamp(post.createdAt)}</small>
          </div>
        </aside>
      </article>

      <PostFormModal
        isOpen={isEditOpen}
        mode="edit"
        initialPost={post}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleUpdatePost}
      />
    </PageContainer>
  )
}
