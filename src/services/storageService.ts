import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { requireStorage } from '../lib/firebase'
import { getProfilePhotoError } from '../lib/userProfile'
import { compressUploadImage } from '../lib/imageUpload'

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function uploadPostPhotos(
  uid: string,
  postId: string,
  files: File[],
): Promise<string[]> {
  return (await uploadPostPhotosWithThumbnails(uid, postId, files)).photoUrls
}

export async function uploadPostPhotosWithThumbnails(uid: string, postId: string, files: File[]) {
  const storage = requireStorage()

  const photos = await Promise.all(
    files.map(async (file, index) => {
      const compressed = await compressUploadImage(file)
      const thumbnail = await compressUploadImage(compressed, 480)
      const filename = `${Date.now()}-${crypto.randomUUID()}-${index}-${sanitizeFilename(compressed.name)}`
      const upload = async (name: string, image: File) => {
        const snapshot = await uploadBytes(ref(storage, `posts/${uid}/${postId}/${name}`), image,
          { contentType: image.type, cacheControl: 'private,max-age=31536000,immutable' })
        return getDownloadURL(snapshot.ref)
      }
      const photo = upload(filename, compressed)
      const small = thumbnail === compressed ? photo : upload(`thumb-${crypto.randomUUID()}-${sanitizeFilename(thumbnail.name)}`, thumbnail)
      const [photoUrl, thumbnailUrl] = await Promise.all([photo, small])
      return { photoUrl, thumbnailUrl }
    }),
  )
  return { photoUrls: photos.map(photo => photo.photoUrl), photoThumbnailUrls: photos.map(photo => photo.thumbnailUrl) }
}

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  const validationError = getProfilePhotoError(file)
  if (validationError) throw new Error(validationError)
  const storage = requireStorage()
  const compressed = await compressUploadImage(file, 384)
  const filename = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(compressed.name)}`
  const storageRef = ref(storage, `profiles/${uid}/${filename}`)
  const snapshot = await uploadBytes(storageRef, compressed, { contentType: compressed.type, cacheControl: 'private,max-age=31536000,immutable' })

  return getDownloadURL(snapshot.ref)
}

export async function uploadChatPhoto(uid: string, chatId: string, file: File): Promise<string> {
  const storage = requireStorage()
  const compressed = await compressUploadImage(file)
  const filename = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(compressed.name)}`
  const storageRef = ref(storage, `chats/${chatId}/${uid}/${filename}`)
  const snapshot = await uploadBytes(storageRef, compressed, { contentType: compressed.type, cacheControl: 'private,max-age=31536000,immutable' })

  return getDownloadURL(snapshot.ref)
}
