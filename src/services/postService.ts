import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
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
import { getProfilePinAccess, type ProfilePinAccess } from '../lib/profilePinAccess'
import type { LatLng } from '../lib/kakaoMap'
import {
  normalizePinColor,
  type Post,
  type PostFormInput,
} from '../types/post'
import { getFollowingIds, isFollowing } from './followService'
import { uploadPostPhotos } from './storageService'
import { getUserProfile } from './userService'

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
    pinColor: normalizePinColor(post.pinColor),
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

function normalizeVisibility(visibility: Post['visibility']): Post['visibility'] {
  return visibility === 'public' ? 'public' : visibility
}

function canFollowerSee(post: Post): boolean {
  return post.visibility === 'followers' || post.visibility === 'public'
}

function distanceKm(from: LatLng, to: LatLng): number {
  const earthRadiusKm = 6371
  const latDelta = ((to.lat - from.lat) * Math.PI) / 180
  const lngDelta = ((to.lng - from.lng) * Math.PI) / 180
  const fromLat = (from.lat * Math.PI) / 180
  const toLat = (to.lat * Math.PI) / 180
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2)

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function getPostsByAuthor(uid: string, viewerUid: string): Promise<Post[]> {
  const postsRef = collection(requireDb(), 'posts')
  const postsQuery = uid === viewerUid
    ? query(postsRef, where('uid', '==', uid))
    : query(postsRef, where('uid', '==', uid), where('visibility', 'in', ['followers', 'public']))
  const snapshot = await getDocs(postsQuery)

  return snapshot.docs
    .map(toPost)
    .filter((post): post is Post => Boolean(post))
    .filter((post) => uid === viewerUid || canFollowerSee(post))
}

export async function createPost(
  input: PostFormInput,
  files: File[],
  author: AuthorInfo,
): Promise<string> {
  const db = requireDb()
  const groupId = input.groupId || ''
  await assertGroupPostingAccess(groupId, input.visibility, author.uid)
  const postRef = doc(collection(db, 'posts'))
  const photoUrls = files.length > 0 ? await uploadPostPhotos(author.uid, postRef.id, files) : []

  await setDoc(postRef, {
    id: postRef.id,
    uid: author.uid,
    authorNickname: author.nickname,
    ...input,
    groupId,
    visibility: normalizeVisibility(input.visibility),
    pinColor: normalizePinColor(input.pinColor),
    photoUrls,
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return postRef.id
}

async function assertGroupPostingAccess(groupId: string, visibility: Post['visibility'], uid: string, previousGroupId = '') {
  if (!groupId) return
  if (groupId.includes('/') || groupId.length > 128) throw new Error('그룹 정보를 확인해 주세요.')
  if (visibility !== 'public') throw new Error('그룹 핀의 공개 범위는 전체 공개입니다.')
  if (groupId !== previousGroupId && !(await getDoc(doc(requireDb(), 'groups', groupId, 'members', uid))).exists()) {
    throw new Error('그룹에 가입한 뒤 핀을 올려 주세요.')
  }
}

export function subscribeGroupPosts(groupId: string, onChange: (posts: Post[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(collection(requireDb(), 'posts'), where('groupId', '==', groupId), where('visibility', '==', 'public')), snapshot => {
    onChange(sortPostsByCreatedAtDesc(snapshot.docs.map(toPost).filter((post): post is Post => Boolean(post))))
  }, onError)
}

export async function getVisiblePosts(uid?: string, maxCount = 80): Promise<Post[]> {
  const posts = new Map<string, Post>()

  if (!uid) {
    return []
  }

  const followingIds = await getFollowingIds(uid)
  const authorIds = [uid, ...followingIds]
  const authorPosts = await Promise.all(
    authorIds.map((authorUid) => getPostsByAuthor(authorUid, uid)),
  )

  authorPosts.flat().forEach((post) => {
    if (post.uid === uid || canFollowerSee(post)) {
      posts.set(post.id, {
        ...post,
        visibility: normalizeVisibility(post.visibility),
      })
    }
  })

  return sortPostsByCreatedAtDesc([...posts.values()]).slice(0, maxCount)
}

export async function getNearbyVisiblePosts(
  uid: string | undefined,
  center: LatLng,
  radiusKm: number,
  maxCount = 80,
): Promise<Post[]> {
  const posts = await getVisiblePosts(uid, Infinity)

  return posts
    .filter((post) => distanceKm(center, { lat: post.lat, lng: post.lng }) <= radiusKm)
    .slice(0, maxCount)
}

export async function getUserPosts(uid: string): Promise<Post[]> {
  const snapshot = await getDocs(query(collection(requireDb(), 'posts'), where('uid', '==', uid)))
  const posts = snapshot.docs.map(toPost).filter((post): post is Post => Boolean(post))

  return sortPostsByCreatedAtDesc(posts)
}

export async function getProfilePosts(ownerUid: string, viewerUid?: string): Promise<{ posts: Post[]; access: ProfilePinAccess }> {
  if (!viewerUid) return { posts: [], access: 'locked' }
  if (ownerUid === viewerUid) return { posts: await getUserPosts(ownerUid), access: 'owner' }

  const [owner, followsOwner] = await Promise.all([getUserProfile(ownerUid), isFollowing(viewerUid, ownerUid)])
  if (!owner || owner.onboardingComplete === false) return { posts: [], access: 'locked' }
  const access = getProfilePinAccess(ownerUid, viewerUid, Boolean(owner.isPrivate), followsOwner)
  if (access === 'locked') return { posts: [], access }

  // Scope the Firestore query itself: never fetch another user's private pins.
  const visibility = access === 'following'
    ? where('visibility', 'in', ['public', 'followers'])
    : where('visibility', '==', 'public')
  const snapshot = await getDocs(query(collection(requireDb(), 'posts'), where('uid', '==', ownerUid), visibility))
  const posts = snapshot.docs.map(toPost).filter((post): post is Post => Boolean(post))
  return { posts: sortPostsByCreatedAtDesc(posts), access }
}

export async function getPostById(postId: string, viewerUid?: string): Promise<Post | null> {
  const snapshot = await getDoc(doc(requireDb(), 'posts', postId))
  const post = toPost(snapshot)

  if (!post) {
    return null
  }

  const normalizedPost = {
    ...post,
    visibility: normalizeVisibility(post.visibility),
  }

  if (normalizedPost.uid === viewerUid) {
    return normalizedPost
  }

  if (!viewerUid) {
    return null
  }

  if (normalizedPost.visibility === 'private') {
    return null
  }

  if (normalizedPost.visibility === 'public') {
    return normalizedPost
  }

  if (!(await isFollowing(viewerUid, normalizedPost.uid))) {
    return null
  }

  return normalizedPost
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

  const groupId = input.groupId ?? post.groupId ?? ''
  await assertGroupPostingAccess(groupId, input.visibility, uid, post.groupId)
  const uploadedPhotoUrls =
    files.length > 0 ? await uploadPostPhotos(uid, postId, files) : []

  await updateDoc(doc(requireDb(), 'posts', postId), {
    ...input,
    groupId,
    pinColor: normalizePinColor(input.pinColor),
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
