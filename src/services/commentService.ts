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
import type { PostComment, PostReply } from '../types/comment'
import type { NotificationActor } from '../types/notification'
import { createNotification, createNotifications } from './notificationService'
import { getPostById } from './postService'

type CommentAuthor = NotificationActor

function toComment(snapshot: QueryDocumentSnapshot<DocumentData>): PostComment {
  const data = snapshot.data() as Omit<PostComment, 'id'> & { id?: string }

  return {
    ...data,
    id: data.id || snapshot.id,
    replyCount: data.replyCount || 0,
    replies: data.replies || [],
  }
}

function toReply(snapshot: QueryDocumentSnapshot<DocumentData>, commentId: string): PostReply {
  const data = snapshot.data() as Omit<PostReply, 'id' | 'commentId'> & { id?: string; commentId?: string }

  return {
    ...data,
    id: data.id || snapshot.id,
    commentId: data.commentId || commentId,
  }
}

export async function listComments(postId: string): Promise<PostComment[]> {
  const commentsRef = collection(requireDb(), 'posts', postId, 'comments')
  const snapshot = await getDocs(query(commentsRef, orderBy('createdAt', 'asc')))
  const comments = snapshot.docs.map(toComment)
  const commentsWithReplies = await Promise.all(
    comments.map(async (comment) => {
      const repliesSnapshot = await getDocs(
        query(collection(requireDb(), 'posts', postId, 'comments', comment.id, 'replies'), orderBy('createdAt', 'asc')),
      )

      return {
        ...comment,
        replies: repliesSnapshot.docs.map((replyDoc) => toReply(replyDoc, comment.id)),
      }
    }),
  )

  return commentsWithReplies
}

export async function addComment(
  postId: string,
  postOwnerUid: string,
  postTitle: string,
  author: CommentAuthor,
  content: string,
): Promise<void> {
  const trimmed = content.trim()

  if (!trimmed) {
    return
  }

  const db = requireDb()
  const commentRef = doc(collection(db, 'posts', postId, 'comments'))
  const batch = writeBatch(db)

  batch.set(commentRef, {
    id: commentRef.id,
    uid: author.uid,
    authorNickname: author.nickname,
    content: trimmed,
    replyCount: 0,
    createdAt: serverTimestamp(),
  })
  batch.update(doc(db, 'posts', postId), {
    commentCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()

  await createNotification({
    recipientUid: postOwnerUid,
    actor: author,
    type: 'comment',
    title: '새 댓글',
    message: `${author.nickname}님이 "${postTitle}"에 댓글을 남겼습니다.`,
    href: `/posts/${postId}`,
    postId,
    commentId: commentRef.id,
  })
}

export async function addReply(
  postId: string,
  postOwnerUid: string,
  postTitle: string,
  parentComment: Pick<PostComment, 'id' | 'uid' | 'authorNickname'>,
  author: CommentAuthor,
  content: string,
): Promise<void> {
  const trimmed = content.trim()

  if (!trimmed) {
    return
  }

  const db = requireDb()
  const commentRef = doc(db, 'posts', postId, 'comments', parentComment.id)
  const replyRef = doc(collection(db, 'posts', postId, 'comments', parentComment.id, 'replies'))
  const batch = writeBatch(db)

  batch.set(replyRef, {
    id: replyRef.id,
    commentId: parentComment.id,
    uid: author.uid,
    authorNickname: author.nickname,
    content: trimmed,
    createdAt: serverTimestamp(),
  })
  batch.update(commentRef, {
    replyCount: increment(1),
  })
  batch.update(doc(db, 'posts', postId), {
    commentCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()

  const recipients = new Set([parentComment.uid, postOwnerUid])

  await createNotifications(
    [...recipients].map((recipientUid) => ({
      recipientUid,
      actor: author,
      type: 'reply',
      title: recipientUid === parentComment.uid ? '내 댓글에 답글' : '새 답글',
      message:
        recipientUid === parentComment.uid
          ? `${author.nickname}님이 내 댓글에 답글을 남겼습니다.`
          : `${author.nickname}님이 "${postTitle}"에 답글을 남겼습니다.`,
      href: `/posts/${postId}`,
      postId,
      commentId: parentComment.id,
      replyId: replyRef.id,
    })),
  )
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

  const repliesSnapshot = await getDocs(collection(db, 'posts', postId, 'comments', commentId, 'replies'))
  const batch = writeBatch(db)
  repliesSnapshot.docs.forEach((replyDoc) => batch.delete(replyDoc.ref))
  batch.delete(commentRef)
  batch.update(doc(db, 'posts', postId), {
    commentCount: increment(-(1 + repliesSnapshot.size)),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function deleteReply(
  postId: string,
  commentId: string,
  replyId: string,
  requesterUid: string,
  postOwnerUid: string,
  commentOwnerUid: string,
): Promise<void> {
  const db = requireDb()
  const replyRef = doc(db, 'posts', postId, 'comments', commentId, 'replies', replyId)
  const replySnapshot = await getDoc(replyRef)

  if (!replySnapshot.exists()) {
    return
  }

  const reply = replySnapshot.data() as PostReply
  const canDelete = reply.uid === requesterUid || postOwnerUid === requesterUid || commentOwnerUid === requesterUid

  if (!canDelete) {
    throw new Error('답글 작성자, 댓글 작성자 또는 글 작성자만 삭제할 수 있습니다.')
  }

  const batch = writeBatch(db)

  batch.delete(replyRef)
  batch.update(doc(db, 'posts', postId, 'comments', commentId), {
    replyCount: increment(-1),
  })
  batch.update(doc(db, 'posts', postId), {
    commentCount: increment(-1),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function canReadComments(postId: string, viewerUid?: string): Promise<boolean> {
  return Boolean(await getPostById(postId, viewerUid))
}
