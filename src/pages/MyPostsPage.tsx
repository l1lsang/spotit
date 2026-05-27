import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { PostCard } from '../components/post/PostCard'
import { PostFormModal, type PostFormSubmitPayload } from '../components/post/PostFormModal'
import { useAuth } from '../hooks/useAuth'
import { deletePost, getUserPosts, updatePost } from '../services/postService'
import type { Post, PostFormInput } from '../types/post'

export function MyPostsPage() {
  const { currentUser, firebaseReady, profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadPosts = useCallback(async () => {
    if (!firebaseReady || !currentUser) {
      return
    }

    setLoading(true)
    setError('')

    try {
      setPosts(await getUserPosts(currentUser.uid))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '내 기록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentUser, firebaseReady])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  async function handleDelete(post: Post) {
    if (!currentUser || !window.confirm('이 기록을 삭제할까요?')) {
      return
    }

    await deletePost(post.id, currentUser.uid)
    await loadPosts()
  }

  async function handleUpdate(payload: PostFormSubmitPayload) {
    if (!currentUser || !editingPost) {
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
    }

    await updatePost(editingPost.id, input, payload.existingPhotoUrls, payload.files, currentUser.uid)
    setEditingPost(null)
    await loadPosts()
  }

  return (
    <PageContainer className="content-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">My daymarks</p>
          <h1>내 기록</h1>
          <p>내가 남긴 공개/비공개 장소 기록을 관리합니다.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void loadPosts()}>
          <RefreshCw size={17} aria-hidden="true" />
          새로고침
        </button>
      </section>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="empty-text">내 기록을 불러오는 중입니다.</p>}

      {!loading && posts.length === 0 ? (
        <p className="empty-text">아직 남긴 기록이 없습니다. 지도에서 첫 장소를 찍어보세요.</p>
      ) : (
        <div className="post-grid">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              showVisibility
              actions={
                <>
                  <button className="button button-secondary" type="button" onClick={() => setEditingPost(post)}>
                    <Pencil size={16} aria-hidden="true" />
                    수정
                  </button>
                  <button className="button button-danger" type="button" onClick={() => void handleDelete(post)}>
                    <Trash2 size={16} aria-hidden="true" />
                    삭제
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      <PostFormModal
        isOpen={Boolean(editingPost)}
        mode="edit"
        initialPost={editingPost}
        pinGroupNames={profile?.pinGroupNames}
        onClose={() => setEditingPost(null)}
        onSubmit={handleUpdate}
      />
    </PageContainer>
  )
}
