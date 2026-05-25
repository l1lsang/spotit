import { doc, getDoc, increment, runTransaction, serverTimestamp } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import type { NotificationActor } from '../types/notification'
import { createNotification } from './notificationService'

export async function getLikeStatus(postId: string, uid: string): Promise<boolean> {
  const snapshot = await getDoc(doc(requireDb(), 'posts', postId, 'likes', uid))

  return snapshot.exists()
}

export async function togglePostLike(
  postId: string,
  actor: NotificationActor,
  postOwnerUid: string,
  postTitle: string,
): Promise<boolean> {
  const db = requireDb()
  const likeRef = doc(db, 'posts', postId, 'likes', actor.uid)
  const postRef = doc(db, 'posts', postId)

  const liked = await runTransaction(db, async (transaction) => {
    const likeSnapshot = await transaction.get(likeRef)

    if (likeSnapshot.exists()) {
      transaction.delete(likeRef)
      transaction.update(postRef, {
        likeCount: increment(-1),
        updatedAt: serverTimestamp(),
      })

      return false
    }

    transaction.set(likeRef, {
      uid: actor.uid,
      createdAt: serverTimestamp(),
    })
    transaction.update(postRef, {
      likeCount: increment(1),
      updatedAt: serverTimestamp(),
    })

    return true
  })

  if (liked) {
    await createNotification({
      recipientUid: postOwnerUid,
      actor,
      type: 'like',
      title: '새 좋아요',
      message: `${actor.nickname}님이 "${postTitle}"을 좋아합니다.`,
      href: `/posts/${postId}`,
      postId,
    })
  }

  return liked
}
