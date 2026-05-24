import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { requireStorage } from '../lib/firebase'

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function uploadPostPhotos(
  uid: string,
  postId: string,
  files: File[],
): Promise<string[]> {
  const storage = requireStorage()

  return Promise.all(
    files.map(async (file, index) => {
      const filename = `${Date.now()}-${index}-${sanitizeFilename(file.name)}`
      const storageRef = ref(storage, `posts/${uid}/${postId}/${filename}`)
      const snapshot = await uploadBytes(storageRef, file)

      return getDownloadURL(snapshot.ref)
    }),
  )
}
