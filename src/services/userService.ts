import type { User as FirebaseUser } from 'firebase/auth'
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import type { DaymarkUser } from '../types/user'
import type { PostPinGroup } from '../types/post'

type BatchOperation = (batch: WriteBatch) => void

export function getFallbackNickname(user: Pick<FirebaseUser, 'displayName' | 'email'>): string {
  return user.displayName || user.email?.split('@')[0] || 'daymarker'
}

export async function getUserProfile(uid: string): Promise<DaymarkUser | null> {
  const snapshot = await getDoc(doc(requireDb(), 'users', uid))

  if (!snapshot.exists()) {
    return null
  }

  return snapshot.data() as DaymarkUser
}

export async function upsertUserProfile(user: FirebaseUser, nickname?: string): Promise<DaymarkUser> {
  const db = requireDb()
  const userRef = doc(db, 'users', user.uid)
  const snapshot = await getDoc(userRef)
  const nextNickname = nickname?.trim() || getFallbackNickname(user)
  const baseProfile = {
    uid: user.uid,
    email: user.email || '',
    updatedAt: serverTimestamp(),
  }

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      ...baseProfile,
      photoURL: user.photoURL || '',
      nickname: nextNickname,
      isPrivate: false,
      followerCount: 0,
      followingCount: 0,
      createdAt: serverTimestamp(),
    })
  } else {
    await setDoc(
      userRef,
      {
        ...baseProfile,
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
        ...(nickname ? { nickname: nextNickname } : {}),
      },
      { merge: true },
    )
  }

  const updated = await getDoc(userRef)

  return updated.data() as DaymarkUser
}

export async function updateUserNickname(uid: string, nickname: string): Promise<void> {
  await updateDoc(doc(requireDb(), 'users', uid), {
    nickname: nickname.trim(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateUserPhotoURL(uid: string, photoURL: string): Promise<void> {
  await updateDoc(doc(requireDb(), 'users', uid), {
    photoURL,
    updatedAt: serverTimestamp(),
  })
}

export async function updateUserPrivacy(uid: string, isPrivate: boolean): Promise<void> {
  await updateDoc(doc(requireDb(), 'users', uid), {
    isPrivate,
    updatedAt: serverTimestamp(),
  })
}

export async function updateUserPinGroupNames(
  uid: string,
  pinGroupNames: Partial<Record<PostPinGroup, string>>,
): Promise<void> {
  await updateDoc(doc(requireDb(), 'users', uid), {
    pinGroupNames,
    updatedAt: serverTimestamp(),
  })
}

export async function listUsers(): Promise<DaymarkUser[]> {
  const snapshot = await getDocs(collection(requireDb(), 'users'))

  return snapshot.docs.map((userDoc) => userDoc.data() as DaymarkUser)
}

async function commitBatchOperations(db: Firestore, operations: BatchOperation[]): Promise<void> {
  const chunkSize = 450

  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = writeBatch(db)
    operations.slice(index, index + chunkSize).forEach((operation) => operation(batch))
    await batch.commit()
  }
}

function addDeleteOperation(
  operations: BatchOperation[],
  deletedPaths: Set<string>,
  reference: DocumentReference,
): void {
  if (deletedPaths.has(reference.path)) {
    return
  }

  deletedPaths.add(reference.path)
  operations.push((batch) => batch.delete(reference))
}

export async function deleteUserAccountData(uid: string): Promise<void> {
  const db = requireDb()
  const operations: BatchOperation[] = []
  const deletedPaths = new Set<string>()
  const userRef = doc(db, 'users', uid)

  const [
    followersSnapshot,
    followingSnapshot,
    incomingFollowRequestsSnapshot,
    sentFollowRequestsSnapshot,
    notificationsSnapshot,
    actorNotificationsSnapshot,
    postsSnapshot,
    commentsSnapshot,
    repliesSnapshot,
    likesSnapshot,
    chatsSnapshot,
  ] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'followers')),
      getDocs(collection(db, 'users', uid, 'following')),
      getDocs(collection(db, 'users', uid, 'followRequests')),
      getDocs(collection(db, 'users', uid, 'sentFollowRequests')),
      getDocs(collection(db, 'users', uid, 'notifications')),
      getDocs(query(collectionGroup(db, 'notifications'), where('actorUid', '==', uid))),
      getDocs(query(collection(db, 'posts'), where('uid', '==', uid))),
      getDocs(query(collectionGroup(db, 'comments'), where('uid', '==', uid))),
      getDocs(query(collectionGroup(db, 'replies'), where('uid', '==', uid))),
      getDocs(query(collectionGroup(db, 'likes'), where('uid', '==', uid))),
      getDocs(query(collection(db, 'chats'), where('participantIds', 'array-contains', uid))),
    ])

  const myPostIds = new Set(postsSnapshot.docs.map((postDoc) => postDoc.id))

  followersSnapshot.docs.forEach((followerDoc) => {
    addDeleteOperation(operations, deletedPaths, followerDoc.ref)
    addDeleteOperation(operations, deletedPaths, doc(db, 'users', followerDoc.id, 'following', uid))
    operations.push((batch) =>
      batch.update(doc(db, 'users', followerDoc.id), {
        followingCount: increment(-1),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  followingSnapshot.docs.forEach((followingDoc) => {
    addDeleteOperation(operations, deletedPaths, followingDoc.ref)
    addDeleteOperation(operations, deletedPaths, doc(db, 'users', followingDoc.id, 'followers', uid))
    operations.push((batch) =>
      batch.update(doc(db, 'users', followingDoc.id), {
        followerCount: increment(-1),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  incomingFollowRequestsSnapshot.docs.forEach((requestDoc) => {
    addDeleteOperation(operations, deletedPaths, requestDoc.ref)
    addDeleteOperation(operations, deletedPaths, doc(db, 'users', requestDoc.id, 'sentFollowRequests', uid))
  })

  sentFollowRequestsSnapshot.docs.forEach((requestDoc) => {
    addDeleteOperation(operations, deletedPaths, requestDoc.ref)
    addDeleteOperation(operations, deletedPaths, doc(db, 'users', requestDoc.id, 'followRequests', uid))
  })

  notificationsSnapshot.docs.forEach((notificationDoc) => addDeleteOperation(operations, deletedPaths, notificationDoc.ref))
  actorNotificationsSnapshot.docs.forEach((notificationDoc) =>
    addDeleteOperation(operations, deletedPaths, notificationDoc.ref),
  )

  await Promise.all(
    postsSnapshot.docs.map(async (postDoc) => {
      const [postCommentsSnapshot, postLikesSnapshot] = await Promise.all([
        getDocs(collection(db, 'posts', postDoc.id, 'comments')),
        getDocs(collection(db, 'posts', postDoc.id, 'likes')),
      ])
      const postCommentReplySnapshots = await Promise.all(
        postCommentsSnapshot.docs.map((commentDoc) => getDocs(collection(commentDoc.ref, 'replies'))),
      )

      postCommentReplySnapshots.forEach((replySnapshot) => {
        replySnapshot.docs.forEach((replyDoc) => addDeleteOperation(operations, deletedPaths, replyDoc.ref))
      })
      postCommentsSnapshot.docs.forEach((commentDoc) => addDeleteOperation(operations, deletedPaths, commentDoc.ref))
      postLikesSnapshot.docs.forEach((likeDoc) => addDeleteOperation(operations, deletedPaths, likeDoc.ref))
      addDeleteOperation(operations, deletedPaths, postDoc.ref)
    }),
  )

  const commentReplyEntries = await Promise.all(
    commentsSnapshot.docs.map(async (commentDoc) => ({
      commentDoc,
      repliesSnapshot: await getDocs(collection(commentDoc.ref, 'replies')),
    })),
  )

  commentReplyEntries.forEach(({ commentDoc, repliesSnapshot }) => {
    const parentPostRef = commentDoc.ref.parent.parent

    repliesSnapshot.docs.forEach((replyDoc) => addDeleteOperation(operations, deletedPaths, replyDoc.ref))
    addDeleteOperation(operations, deletedPaths, commentDoc.ref)

    if (parentPostRef && !myPostIds.has(parentPostRef.id)) {
      operations.push((batch) =>
        batch.update(parentPostRef, {
          commentCount: increment(-(1 + ((commentDoc.data() as { replyCount?: number }).replyCount || 0))),
          updatedAt: serverTimestamp(),
        }),
      )
    }
  })

  repliesSnapshot.docs.forEach((replyDoc) => {
    const parentCommentRef = replyDoc.ref.parent.parent
    const parentPostRef = parentCommentRef?.parent.parent

    addDeleteOperation(operations, deletedPaths, replyDoc.ref)

    if (
      parentCommentRef &&
      parentPostRef &&
      !deletedPaths.has(parentCommentRef.path) &&
      !myPostIds.has(parentPostRef.id)
    ) {
      operations.push((batch) => {
        batch.update(parentCommentRef, {
          replyCount: increment(-1),
        })
        batch.update(parentPostRef, {
          commentCount: increment(-1),
          updatedAt: serverTimestamp(),
        })
      })
    }
  })

  likesSnapshot.docs.forEach((likeDoc) => {
    const parentPostRef = likeDoc.ref.parent.parent

    addDeleteOperation(operations, deletedPaths, likeDoc.ref)

    if (parentPostRef && !myPostIds.has(parentPostRef.id)) {
      operations.push((batch) =>
        batch.update(parentPostRef, {
          likeCount: increment(-1),
          updatedAt: serverTimestamp(),
        }),
      )
    }
  })

  await Promise.all(
    chatsSnapshot.docs.map(async (chatDoc) => {
      const chat = chatDoc.data() as { lastMessageUid?: string }
      const messagesSnapshot = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'))

      operations.push((batch) =>
        batch.update(chatDoc.ref, {
          [`participants.${uid}.nickname`]: '탈퇴한 사용자',
          [`participants.${uid}.photoURL`]: '',
          ...(chat.lastMessageUid === uid
            ? {
                lastMessage: '탈퇴한 사용자의 메시지입니다.',
                lastMessageUid: '',
              }
            : {}),
          updatedAt: serverTimestamp(),
        }),
      )

      messagesSnapshot.docs.forEach((messageDoc) => {
        const message = messageDoc.data() as { uid?: string }

        if (message.uid !== uid) {
          return
        }

        operations.push((batch) =>
          batch.update(messageDoc.ref, {
            uid: 'deleted-user',
            authorNickname: '탈퇴한 사용자',
            content: '탈퇴한 사용자의 메시지입니다.',
            photoUrl: '',
            photoName: '',
          }),
        )
      })
    }),
  )

  addDeleteOperation(operations, deletedPaths, userRef)
  await commitBatchOperations(db, operations)
}
