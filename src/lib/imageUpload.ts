export function fitImageSize(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export async function compressUploadImage(file: File, maxDimension = 1600): Promise<File> {
  // Preserve animation. Unsupported decoders retain the already validated file.
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file) } catch { return file }
  try {
    const canvas = document.createElement('canvas')
    const size = fitImageSize(bitmap.width, bitmap.height, maxDimension)
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82))
    if (!blob || (blob.size >= file.size && bitmap.width === size.width && bitmap.height === size.height)) return file
    const extension = blob.type === 'image/webp' ? 'webp' : 'png'
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, { type: blob.type, lastModified: file.lastModified })
  } finally { bitmap.close() }
}
