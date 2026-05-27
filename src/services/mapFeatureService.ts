import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import type { DaymarkUser } from '../types/user'
import {
  DEFAULT_PROJECT_PIN_COLOR,
  isLivePlaceStatusKey,
  isProjectPinColor,
  type LivePlaceStatusInput,
  type LivePlaceStatusUpdate,
  type PlaceProject,
  type PlaceProjectInput,
  type ProjectPin,
  type ProjectPinColor,
  type ProjectPinInput,
} from '../types/mapFeature'

interface AuthorInfo {
  uid: string
  nickname: string
  email?: string
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

function getCreatedAtMillis(value: unknown): number {
  return hasToMillis(value) ? value.toMillis() : 0
}

function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase()
}

function normalizePinColor(pinColor: unknown): ProjectPinColor {
  return typeof pinColor === 'string' && isProjectPinColor(pinColor)
    ? pinColor
    : DEFAULT_PROJECT_PIN_COLOR
}

function toLivePlaceStatusUpdate(
  snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): LivePlaceStatusUpdate | null {
  const data = snapshot.data()

  if (!data) {
    return null
  }

  const status = data as Omit<LivePlaceStatusUpdate, 'id' | 'tags'> & {
    id?: string
    tags?: unknown[]
  }
  const tags = Array.isArray(status.tags)
    ? status.tags.filter((tag): tag is LivePlaceStatusUpdate['tags'][number] =>
        typeof tag === 'string' && isLivePlaceStatusKey(tag),
      )
    : []

  return {
    ...status,
    id: status.id || snapshot.id,
    tags,
    note: status.note || '',
  }
}

function toPlaceProject(
  snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): PlaceProject | null {
  const data = snapshot.data()

  if (!data) {
    return null
  }

  const project = data as Omit<PlaceProject, 'id' | 'pinColor'> & {
    id?: string
    pinColor?: unknown
  }

  return {
    ...project,
    id: project.id || snapshot.id,
    description: project.description || '',
    pinColor: normalizePinColor(project.pinColor),
    memberUids: project.memberUids || [],
    memberEmails: project.memberEmails || [],
    memberNicknames: project.memberNicknames || [],
    pinCount: project.pinCount || 0,
  }
}

function toProjectPin(
  snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): ProjectPin | null {
  const data = snapshot.data()

  if (!data) {
    return null
  }

  const pin = data as Omit<ProjectPin, 'id'> & { id?: string }

  return {
    ...pin,
    id: pin.id || snapshot.id,
    note: pin.note || '',
  }
}

function sortLiveStatusUpdates(updates: LivePlaceStatusUpdate[]): LivePlaceStatusUpdate[] {
  return [...updates].sort(
    (left, right) => getCreatedAtMillis(right.createdAt) - getCreatedAtMillis(left.createdAt),
  )
}

function sortProjects(projects: PlaceProject[]): PlaceProject[] {
  return [...projects].sort(
    (left, right) => getCreatedAtMillis(right.updatedAt) - getCreatedAtMillis(left.updatedAt),
  )
}

function sortProjectPins(pins: ProjectPin[]): ProjectPin[] {
  return [...pins].sort(
    (left, right) => getCreatedAtMillis(right.createdAt) - getCreatedAtMillis(left.createdAt),
  )
}

async function getPlaceProjectById(projectId: string): Promise<PlaceProject> {
  const snapshot = await getDoc(doc(requireDb(), 'placeProjects', projectId))
  const project = toPlaceProject(snapshot)

  if (!project) {
    throw new Error('프로젝트를 찾을 수 없습니다.')
  }

  return project
}

function isProjectMember(project: PlaceProject, uid: string, email?: string): boolean {
  const normalizedEmail = normalizeEmail(email)

  return (
    project.memberUids.includes(uid) ||
    Boolean(normalizedEmail && project.memberEmails.includes(normalizedEmail))
  )
}

function assertProjectMember(project: PlaceProject, uid: string, email?: string): void {
  if (!isProjectMember(project, uid, email)) {
    throw new Error('프로젝트 멤버만 변경할 수 있습니다.')
  }
}

async function findInviteUser(inviteValue: string): Promise<DaymarkUser | null> {
  const db = requireDb()
  const trimmed = inviteValue.trim()

  if (!trimmed) {
    return null
  }

  const usersRef = collection(db, 'users')
  const email = normalizeEmail(trimmed)

  if (trimmed.includes('@')) {
    const emailSnapshot = await getDocs(query(usersRef, where('email', '==', email)))
    const exactEmailUser = emailSnapshot.docs[0]?.data() as DaymarkUser | undefined

    if (exactEmailUser) {
      return exactEmailUser
    }
  }

  const nicknameSnapshot = await getDocs(query(usersRef, where('nickname', '==', trimmed)))

  return (nicknameSnapshot.docs[0]?.data() as DaymarkUser | undefined) || null
}

export async function createLivePlaceStatus(
  input: LivePlaceStatusInput,
  author: AuthorInfo,
): Promise<string> {
  const db = requireDb()
  const statusRef = doc(collection(db, 'livePlaceStatusUpdates'))
  const tags = input.tags.filter(isLivePlaceStatusKey)

  if (tags.length === 0) {
    throw new Error('장소 상태를 하나 이상 선택해 주세요.')
  }

  await setDoc(statusRef, {
    id: statusRef.id,
    ...input,
    tags,
    note: input.note.trim(),
    uid: author.uid,
    authorNickname: author.nickname,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return statusRef.id
}

export function subscribePlaceStatusUpdates(
  placeId: string,
  onChange: (updates: LivePlaceStatusUpdate[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const statusQuery = query(
    collection(requireDb(), 'livePlaceStatusUpdates'),
    where('placeId', '==', placeId),
  )

  return onSnapshot(
    statusQuery,
    (snapshot) => {
      const updates = snapshot.docs
        .map(toLivePlaceStatusUpdate)
        .filter((update): update is LivePlaceStatusUpdate => Boolean(update))

      onChange(sortLiveStatusUpdates(updates))
    },
    onError,
  )
}

export async function createPlaceProject(
  input: PlaceProjectInput,
  owner: AuthorInfo,
): Promise<string> {
  const db = requireDb()
  const projectRef = doc(collection(db, 'placeProjects'))
  const pinColor = normalizePinColor(input.pinColor)
  const ownerEmail = normalizeEmail(owner.email)

  await setDoc(projectRef, {
    id: projectRef.id,
    name: input.name.trim(),
    description: input.description.trim(),
    pinColor,
    ownerUid: owner.uid,
    ownerNickname: owner.nickname,
    memberUids: [owner.uid],
    memberEmails: ownerEmail ? [ownerEmail] : [],
    memberNicknames: [owner.nickname],
    pinCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return projectRef.id
}

export function subscribePlaceProjectsForUser(
  uid: string,
  email: string | null | undefined,
  onChange: (projects: PlaceProject[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const projectsRef = collection(requireDb(), 'placeProjects')
  const normalizedEmail = normalizeEmail(email)
  let uidProjects: PlaceProject[] = []
  let emailProjects: PlaceProject[] = []
  let uidReady = false
  let emailReady = !normalizedEmail
  const unsubscribers: Unsubscribe[] = []

  const emit = () => {
    if (!uidReady || !emailReady) {
      return
    }

    const merged = new Map<string, PlaceProject>()

    uidProjects.forEach((project) => merged.set(project.id, project))
    emailProjects.forEach((project) => merged.set(project.id, project))
    onChange(sortProjects([...merged.values()]))
  }

  unsubscribers.push(
    onSnapshot(
      query(projectsRef, where('memberUids', 'array-contains', uid)),
      (snapshot) => {
        uidProjects = snapshot.docs
          .map(toPlaceProject)
          .filter((project): project is PlaceProject => Boolean(project))
        uidReady = true
        emit()
      },
      onError,
    ),
  )

  if (normalizedEmail) {
    unsubscribers.push(
      onSnapshot(
        query(projectsRef, where('memberEmails', 'array-contains', normalizedEmail)),
        (snapshot) => {
          emailProjects = snapshot.docs
            .map(toPlaceProject)
            .filter((project): project is PlaceProject => Boolean(project))
          emailReady = true
          emit()
        },
        onError,
      ),
    )
  }

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  }
}

export async function invitePlaceProjectMember(
  projectId: string,
  inviteValue: string,
  actor: AuthorInfo,
): Promise<void> {
  const db = requireDb()
  const trimmed = inviteValue.trim()

  if (!trimmed) {
    throw new Error('초대할 친구의 이메일 또는 닉네임을 입력해 주세요.')
  }

  const project = await getPlaceProjectById(projectId)
  assertProjectMember(project, actor.uid, actor.email)

  const inviteUser = await findInviteUser(trimmed)
  const memberEmails = []
  const memberNicknames = []
  const memberUids = []
  const actorEmail = normalizeEmail(actor.email)

  if (!project.memberUids.includes(actor.uid)) {
    memberUids.push(actor.uid)
  }

  if (actorEmail && !project.memberEmails.includes(actorEmail)) {
    memberEmails.push(actorEmail)
  }

  if (actor.nickname && !project.memberNicknames.includes(actor.nickname)) {
    memberNicknames.push(actor.nickname)
  }

  if (inviteUser) {
    memberUids.push(inviteUser.uid)
    memberNicknames.push(inviteUser.nickname)

    if (inviteUser.email) {
      memberEmails.push(normalizeEmail(inviteUser.email))
    }
  } else if (trimmed.includes('@')) {
    memberEmails.push(normalizeEmail(trimmed))
  } else {
    throw new Error('해당 닉네임의 사용자를 찾지 못했습니다.')
  }

  await updateDoc(doc(db, 'placeProjects', projectId), {
    ...(memberUids.length > 0 ? { memberUids: arrayUnion(...memberUids) } : {}),
    ...(memberEmails.length > 0 ? { memberEmails: arrayUnion(...memberEmails) } : {}),
    ...(memberNicknames.length > 0 ? { memberNicknames: arrayUnion(...memberNicknames) } : {}),
    updatedAt: serverTimestamp(),
  })
}

export async function updatePlaceProjectColor(
  projectId: string,
  pinColor: ProjectPinColor,
  actorUid: string,
): Promise<void> {
  if (!isProjectPinColor(pinColor)) {
    throw new Error('정해진 핀 색상만 사용할 수 있습니다.')
  }

  const project = await getPlaceProjectById(projectId)

  if (project.ownerUid !== actorUid) {
    throw new Error('프로젝트 소유자만 핀 색을 바꿀 수 있습니다.')
  }

  await updateDoc(doc(requireDb(), 'placeProjects', projectId), {
    pinColor,
    updatedAt: serverTimestamp(),
  })
}

export function subscribeProjectPins(
  projectIds: string[],
  onChange: (pins: ProjectPin[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const uniqueProjectIds = [...new Set(projectIds)].filter(Boolean)

  if (uniqueProjectIds.length === 0) {
    onChange([])
    return () => undefined
  }

  const db = requireDb()
  const chunks: string[][] = []

  for (let index = 0; index < uniqueProjectIds.length; index += 10) {
    chunks.push(uniqueProjectIds.slice(index, index + 10))
  }

  const chunkPins = chunks.map((): ProjectPin[] => [])
  const readyChunks = chunks.map(() => false)
  const emit = () => {
    if (!readyChunks.every(Boolean)) {
      return
    }

    const merged = new Map<string, ProjectPin>()

    chunkPins.flat().forEach((pin) => merged.set(pin.id, pin))
    onChange(sortProjectPins([...merged.values()]))
  }

  const unsubscribers = chunks.map((chunk, index) =>
    onSnapshot(
      query(collection(db, 'placeProjectPins'), where('projectId', 'in', chunk)),
      (snapshot) => {
        chunkPins[index] = snapshot.docs
          .map(toProjectPin)
          .filter((pin): pin is ProjectPin => Boolean(pin))
        readyChunks[index] = true
        emit()
      },
      onError,
    ),
  )

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  }
}

export async function addProjectPin(input: ProjectPinInput, author: AuthorInfo): Promise<string> {
  const db = requireDb()
  const project = await getPlaceProjectById(input.projectId)
  assertProjectMember(project, author.uid, author.email)

  const pinRef = doc(collection(db, 'placeProjectPins'))
  const authorEmail = normalizeEmail(author.email)

  await setDoc(pinRef, {
    id: pinRef.id,
    ...input,
    note: input.note.trim(),
    uid: author.uid,
    authorNickname: author.nickname,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await updateDoc(doc(db, 'placeProjects', input.projectId), {
    memberUids: arrayUnion(author.uid),
    ...(authorEmail ? { memberEmails: arrayUnion(authorEmail) } : {}),
    memberNicknames: arrayUnion(author.nickname),
    pinCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  return pinRef.id
}
