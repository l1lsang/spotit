import { doc, getDoc, increment, runTransaction, serverTimestamp } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'

export async function getLikeStatus(postId: string, uid: string): Promise<boolean> {
  const snapshot = await getDoc(doc(requireDb(), 'posts', postId, 'likes', uid))

  return snapshot.exists()
}

export async function togglePostLike(postId: string, uid: string): Promise<boolean> {
  const db = requireDb()
  const likeRef = doc(db, 'posts', postId, 'likes', uid)
  const postRef = doc(db, 'posts', postId)

  return runTransaction(db, async (transaction) => {
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
      uid,
      createdAt: serverTimestamp(),
    })
    transaction.update(postRef, {
      likeCount: increment(1),
      updatedAt: serverTimestamp(),
    })

    return true
  })
}
