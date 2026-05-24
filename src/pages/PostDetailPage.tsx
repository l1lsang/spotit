import { Heart, MessageCircle, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { KakaoMapView } from '../components/map/KakaoMapView'
import { CommentList } from '../components/post/CommentList'
import { PostFormModal, type PostFormSubmitPayload } from '../components/post/PostFormModal'
import { useAuth } from '../hooks/useAuth'
import type { PostComment } from '../types/comment'
import type { Post, PostFormInput } from '../types/post'
import { formatDateKey, formatTimestamp } from '../lib/date'
import { addComment, deleteComment, listComments } from '../services/commentService'
import { getLikeStatus, togglePostLike } from '../services/likeService'
import { deletePost, getPostById, updatePost } from '../services/postService'

export function PostDetailPage() {
  const { postId = '' } = useParams()
  const navigate = useNavigate()
  const { currentUser, profile, firebaseReady } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentContent, setCommentContent] = useState('')
  const [liked, setLiked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)

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

      if (nextPost) {
        setComments(await listComments(nextPost.id))
        setLiked(currentUser ? await getLikeStatus(nextPost.id, currentUser.uid) : false)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '기록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentUser, firebaseReady, postId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  async function handleToggleLike() {
    if (!currentUser || !post) {
      navigate('/login')
      return
    }

    const nextLiked = await togglePostLike(post.id, currentUser.uid)
    setLiked(nextLiked)
    setPost({
      ...post,
      likeCount: Math.max(0, post.likeCount + (nextLiked ? 1 : -1)),
    })
  }

  async function handleAddComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentUser || !profile || !post) {
      navigate('/login')
      return
    }

    if (!commentContent.trim()) {
      return
    }

    await addComment(post.id, { uid: currentUser.uid, nickname: profile.nickname }, commentContent)
    setCommentContent('')
    await loadDetail()
  }

  async function handleDeletePost() {
    if (!currentUser || !post || !window.confirm('이 기록을 삭제할까요?')) {
      return
    }

    await deletePost(post.id, currentUser.uid)
    navigate('/my')
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
    <PageContainer className="content-page">
      <article className="detail-layout">
        <section className="detail-main">
          <div className="detail-heading">
            <p className="eyebrow">{formatDateKey(post.dateKey)}</p>
            <h1>{post.title}</h1>
            <p>
              {post.placeName} · {post.authorNickname}
            </p>
          </div>

          {post.photoUrls.length > 0 && (
            <div className="photo-gallery">
              {post.photoUrls.map((url) => (
                <img key={url} src={url} alt={`${post.title} 사진`} />
              ))}
            </div>
          )}

          <p className="detail-content">{post.content}</p>

          <div className="detail-actions">
            <button
              className={`button ${liked ? 'button-primary' : 'button-secondary'}`}
              type="button"
              onClick={handleToggleLike}
            >
              <Heart size={18} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
              좋아요 {post.likeCount}
            </button>
            <span className="comment-count">
              <MessageCircle size={18} aria-hidden="true" />
              댓글 {post.commentCount}
            </span>
            {isOwner && (
              <>
                <button className="button button-secondary" type="button" onClick={() => setIsEditOpen(true)}>
                  <Pencil size={17} aria-hidden="true" />
                  수정
                </button>
                <button className="button button-danger" type="button" onClick={handleDeletePost}>
                  <Trash2 size={17} aria-hidden="true" />
                  삭제
                </button>
              </>
            )}
          </div>

          <section className="comments-section">
            <h2>댓글</h2>
            <CommentList
              comments={comments}
              currentUserUid={currentUser?.uid}
              postOwnerUid={post.uid}
              onDelete={(commentId) => {
                if (!currentUser) {
                  navigate('/login')
                  return
                }

                void deleteComment(post.id, commentId, currentUser.uid, post.uid).then(loadDetail)
              }}
            />

            <form className="comment-form" onSubmit={handleAddComment}>
              <textarea
                value={commentContent}
                onChange={(event) => setCommentContent(event.target.value)}
                placeholder={currentUser ? '댓글을 남겨보세요' : '로그인 후 댓글을 남길 수 있습니다'}
                disabled={!currentUser}
                rows={3}
              />
              <button className="button button-primary" type="submit" disabled={!currentUser}>
                댓글 작성
              </button>
            </form>
          </section>
        </section>

        <aside className="detail-aside">
          <div className="info-panel">
            <h2>장소</h2>
            <p>{post.address || post.placeName}</p>
            <small>
              좌표 {post.lat.toFixed(5)}, {post.lng.toFixed(5)}
            </small>
          </div>
          <KakaoMapView
            className="mini-map"
            center={{ lat: post.lat, lng: post.lng }}
            posts={[post]}
            onMapClick={() => undefined}
            onMarkerClick={() => undefined}
          />
          <div className="info-panel">
            <h2>기록 정보</h2>
            <p>{post.visibility === 'public' ? '공개 기록' : '비공개 기록'}</p>
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
