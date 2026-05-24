import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import type { Post, PostFormInput } from '../types/post'
import { uploadPostPhotos } from './storageService'

interface AuthorInfo {
  uid: string
  nickname: string
}

interface TimestampLike {
  toMillis: () => number
}

function hasToMillis(value: unknown): value is TimestampLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  )
}

function toPost(
  snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): Post | null {
  const data = snapshot.data()

  if (!data) {
    return null
  }

  const post = data as Omit<Post, 'id'> & { id?: string }

  return {
    ...post,
    id: post.id || snapshot.id,
    photoUrls: post.photoUrls || [],
    likeCount: post.likeCount || 0,
    commentCount: post.commentCount || 0,
  }
}

function sortPostsByCreatedAtDesc(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    const left = hasToMillis(a.createdAt) ? a.createdAt.toMillis() : 0
    const right = hasToMillis(b.createdAt) ? b.createdAt.toMillis() : 0

    return right - left
  })
}

function assertOwner(post: Post, uid: string): void {
  if (post.uid !== uid) {
    throw new Error('작성자만 수정하거나 삭제할 수 있습니다.')
  }
}

export async function createPost(
  input: PostFormInput,
  files: File[],
  author: AuthorInfo,
): Promise<string> {
  const db = requireDb()
  const postRef = doc(collection(db, 'posts'))
  const photoUrls = files.length > 0 ? await uploadPostPhotos(author.uid, postRef.id, files) : []

  await setDoc(postRef, {
    id: postRef.id,
    uid: author.uid,
    authorNickname: author.nickname,
    ...input,
    photoUrls,
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return postRef.id
}

export async function getVisiblePosts(uid?: string, maxCount = 80): Promise<Post[]> {
  const db = requireDb()
  const posts = new Map<string, Post>()
  const publicSnapshot = await getDocs(query(collection(db, 'posts'), where('visibility', '==', 'public')))

  publicSnapshot.docs.forEach((snapshot) => {
    const post = toPost(snapshot)

    if (post) {
      posts.set(post.id, post)
    }
  })

  if (uid) {
    const mySnapshot = await getDocs(query(collection(db, 'posts'), where('uid', '==', uid)))
    mySnapshot.docs.forEach((snapshot) => {
      const post = toPost(snapshot)

      if (post) {
        posts.set(post.id, post)
      }
    })
  }

  return sortPostsByCreatedAtDesc([...posts.values()]).slice(0, maxCount)
}

export async function getUserPosts(uid: string): Promise<Post[]> {
  const snapshot = await getDocs(query(collection(requireDb(), 'posts'), where('uid', '==', uid)))
  const posts = snapshot.docs.map(toPost).filter((post): post is Post => Boolean(post))

  return sortPostsByCreatedAtDesc(posts)
}

export async function getPostById(postId: string, viewerUid?: string): Promise<Post | null> {
  const snapshot = await getDoc(doc(requireDb(), 'posts', postId))
  const post = toPost(snapshot)

  if (!post) {
    return null
  }

  if (post.visibility === 'private' && post.uid !== viewerUid) {
    return null
  }

  return post
}

export async function updatePost(
  postId: string,
  input: PostFormInput,
  existingPhotoUrls: string[],
  files: File[],
  uid: string,
): Promise<void> {
  const post = await getPostById(postId, uid)

  if (!post) {
    throw new Error('기록을 찾을 수 없습니다.')
  }

  assertOwner(post, uid)

  const uploadedPhotoUrls =
    files.length > 0 ? await uploadPostPhotos(uid, postId, files) : []

  await updateDoc(doc(requireDb(), 'posts', postId), {
    ...input,
    photoUrls: [...existingPhotoUrls, ...uploadedPhotoUrls],
    updatedAt: serverTimestamp(),
  })
}

export async function deletePost(postId: string, uid: string): Promise<void> {
  const post = await getPostById(postId, uid)

  if (!post) {
    throw new Error('기록을 찾을 수 없습니다.')
  }

  assertOwner(post, uid)
  await deleteDoc(doc(requireDb(), 'posts', postId))
}
