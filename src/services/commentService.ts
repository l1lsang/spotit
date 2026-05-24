import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import type { PostComment } from '../types/comment'
import { getPostById } from './postService'

interface CommentAuthor {
  uid: string
  nickname: string
}

function toComment(snapshot: QueryDocumentSnapshot<DocumentData>): PostComment {
  const data = snapshot.data() as Omit<PostComment, 'id'> & { id?: string }

  return {
    ...data,
    id: data.id || snapshot.id,
  }
}

export async function listComments(postId: string): Promise<PostComment[]> {
  const commentsRef = collection(requireDb(), 'posts', postId, 'comments')
  const snapshot = await getDocs(query(commentsRef, orderBy('createdAt', 'asc')))

  return snapshot.docs.map(toComment)
}

export async function addComment(
  postId: string,
  author: CommentAuthor,
  content: string,
): Promise<void> {
  const db = requireDb()
  const commentRef = doc(collection(db, 'posts', postId, 'comments'))
  const batch = writeBatch(db)

  batch.set(commentRef, {
    id: commentRef.id,
    uid: author.uid,
    authorNickname: author.nickname,
    content: content.trim(),
    createdAt: serverTimestamp(),
  })
  batch.update(doc(db, 'posts', postId), {
    commentCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function deleteComment(
  postId: string,
  commentId: string,
  requesterUid: string,
  postOwnerUid: string,
): Promise<void> {
  const db = requireDb()
  const commentRef = doc(db, 'posts', postId, 'comments', commentId)
  const commentSnapshot = await getDoc(commentRef)

  if (!commentSnapshot.exists()) {
    return
  }

  const comment = commentSnapshot.data() as PostComment
  const canDelete = comment.uid === requesterUid || postOwnerUid === requesterUid

  if (!canDelete) {
    throw new Error('댓글 작성자 또는 글 작성자만 삭제할 수 있습니다.')
  }

  const batch = writeBatch(db)
  batch.delete(commentRef)
  batch.update(doc(db, 'posts', postId), {
    commentCount: increment(-1),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function canReadComments(postId: string, viewerUid?: string): Promise<boolean> {
  return Boolean(await getPostById(postId, viewerUid))
}
