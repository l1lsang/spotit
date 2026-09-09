export const EDITABLE_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif'
export const IMAGE_INPUT_MAX_BYTES = 20 * 1024 * 1024

export interface ImageEdit {
  rotation: number
  flip: boolean
  zoom: number
  panX: number
  panY: number
}

export const INITIAL_IMAGE_EDIT: ImageEdit = { rotation: 0, flip: false, zoom: 1, panX: 0, panY: 0 }

export function getEditableImageError(file: Pick<File, 'type' | 'size'>): string {
  if (!EDITABLE_IMAGE_TYPES.split(',').includes(file.type)) return 'JPG, PNG, WebP, GIF 이미지를 선택해 주세요.'
  if (file.size > IMAGE_INPUT_MAX_BYTES) return '사진은 20MB 이하로 선택해 주세요.'
  return ''
}

export function getRotatedSize(width: number, height: number, rotation: number) {
  return Math.abs(rotation % 180) === 90 ? { width: height, height: width } : { width, height }
}

export function getImagePlacement(imageWidth: number, imageHeight: number, width: number, height: number, edit: ImageEdit) {
  const rotated = getRotatedSize(imageWidth, imageHeight, edit.rotation)
  const scale = Math.max(width / rotated.width, height / rotated.height) * Math.max(1, edit.zoom)
  const maxX = Math.max(0, (rotated.width * scale - width) / 2)
  const maxY = Math.max(0, (rotated.height * scale - height) / 2)
  return {
    scale, maxX, maxY,
    offsetX: Math.max(-1, Math.min(1, edit.panX)) * maxX,
    offsetY: Math.max(-1, Math.min(1, edit.panY)) * maxY,
  }
}

export function getExportSize(imageWidth: number, imageHeight: number, ratio: number, edit: ImageEdit, maxDimension = 2048) {
  const { scale } = getImagePlacement(imageWidth, imageHeight, ratio, 1, edit)
  const factor = Math.min(1 / scale, maxDimension / Math.max(ratio, 1))
  return { width: Math.max(1, Math.round(ratio * factor)), height: Math.max(1, Math.round(factor)) }
}

// Preview and export share exactly the same crop and transform calculations.
export function drawEditedImage(canvas: HTMLCanvasElement, image: ImageBitmap, edit: ImageEdit, opaque = false) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('이 브라우저에서 사진을 편집할 수 없습니다.')
  const { width, height } = canvas
  const placement = getImagePlacement(image.width, image.height, width, height, edit)
  context.clearRect(0, 0, width, height)
  if (opaque) {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
  }
  context.save()
  context.translate(width / 2 + placement.offsetX, height / 2 + placement.offsetY)
  context.scale(edit.flip ? -1 : 1, 1)
  context.rotate(edit.rotation * Math.PI / 180)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, -image.width * placement.scale / 2, -image.height * placement.scale / 2,
    image.width * placement.scale, image.height * placement.scale)
  context.restore()
}

export async function exportEditedImage(image: ImageBitmap, source: File | string, ratio: number, edit: ImageEdit): Promise<File> {
  const transparent = typeof source === 'string' ? /\.(png|webp)(?:\?|$)/i.test(source) : ['image/png', 'image/webp'].includes(source.type)
  const type = transparent ? 'image/png' : 'image/jpeg'
  const canvas = document.createElement('canvas')
  const size = getExportSize(image.width, image.height, ratio, edit)
  canvas.width = size.width
  canvas.height = size.height
  for (let attempt = 0; attempt < 8; attempt += 1) {
    drawEditedImage(canvas, image, edit, !transparent)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('사진을 저장하지 못했습니다. 다시 시도해 주세요.')), type, 0.9)
    })
    if (blob.size <= 5 * 1024 * 1024) {
      const name = typeof source === 'string' ? 'photo' : source.name.replace(/\.[^.]+$/, '')
      return new File([blob], `${name}-edited.${transparent ? 'png' : 'jpg'}`, { type, lastModified: Date.now() })
    }
    canvas.width = Math.max(1, Math.floor(canvas.width * 0.8))
    canvas.height = Math.max(1, Math.floor(canvas.height * 0.8))
  }
  throw new Error('편집한 사진의 용량이 너무 큽니다. 영역을 더 작게 잘라 주세요.')
}
