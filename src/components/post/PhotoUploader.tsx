import { Crop, ImagePlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EDITABLE_IMAGE_TYPES, getEditableImageError } from '../../lib/imageEditing'
import { ImageEditorModal } from '../image/ImageEditorModal'

interface FilePreview {
  name: string
  url: string
}

interface PhotoUploaderProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  existingPhotoUrls: string[]
  onRemoveExisting: (url: string) => void
  disabled?: boolean
}

export function PhotoUploader({
  files,
  onFilesChange,
  existingPhotoUrls,
  onRemoveExisting,
  disabled = false,
}: PhotoUploaderProps) {
  const [previews, setPreviews] = useState<FilePreview[]>([])
  const [editing, setEditing] = useState<{ source: File | string; index?: number; existingUrl?: string } | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [error, setError] = useState('')

  function applyPhoto(file: File) {
    if (!editing) return
    onFilesChange(editing.index === undefined ? [...files, file] : files.map((previous, index) => index === editing.index ? file : previous))
    if (editing.existingUrl) onRemoveExisting(editing.existingUrl)
    setEditing(pendingFiles.length ? { source: pendingFiles[0] } : null)
    setPendingFiles(previous => previous.slice(1))
  }

  useEffect(() => {
    const nextPreviews = files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }))
    setPreviews(nextPreviews)

    return () => {
      nextPreviews.forEach((preview) => URL.revokeObjectURL(preview.url))
    }
  }, [files])

  return (
    <div className="photo-uploader">
      <label className="upload-dropzone">
        <ImagePlus size={22} aria-hidden="true" />
        <span>사진 선택</span>
        <input
          type="file"
          accept={EDITABLE_IMAGE_TYPES}
          multiple
          disabled={disabled}
          onChange={(event) => {
            const selectedFiles = Array.from(event.target.files || [])
            event.target.value = ''
            const invalidFile = selectedFiles.find(file => getEditableImageError(file))
            setError(invalidFile ? `${invalidFile.name}: ${getEditableImageError(invalidFile)}` : '')
            const validFiles = selectedFiles.filter(file => !getEditableImageError(file))
            if (!validFiles.length) return
            setEditing({ source: validFiles[0] })
            setPendingFiles(validFiles.slice(1))
          }}
        />
      </label>
      <p className="photo-upload-hint">사진을 선택하면 자르기·회전 편집을 할 수 있어요.</p>
      {error && <p className="form-error" role="alert">{error}</p>}

      {(existingPhotoUrls.length > 0 || previews.length > 0) && (
        <div className="photo-preview-grid">
          {existingPhotoUrls.map((url) => (
            <figure key={url} className="photo-preview">
              <img src={url} alt="등록된 장소 사진" />
              <button type="button" onClick={() => onRemoveExisting(url)} disabled={disabled} aria-label="사진 제거">
                <X size={16} aria-hidden="true" />
              </button>
              <button className="photo-preview-edit" type="button" disabled={disabled} onClick={() => setEditing({ source: url, existingUrl: url })} aria-label="등록된 사진 편집">
                <Crop size={14} aria-hidden="true" />편집
              </button>
            </figure>
          ))}
          {previews.map((preview, index) => (
            <figure key={preview.url} className="photo-preview">
              <img src={preview.url} alt={preview.name} />
              <button
                type="button"
                onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
                aria-label="선택한 사진 제거"
                disabled={disabled}
              >
                <X size={16} aria-hidden="true" />
              </button>
              <button className="photo-preview-edit" type="button" disabled={disabled} onClick={() => setEditing({ source: files[index], index })} aria-label={`${preview.name} 편집`}>
                <Crop size={14} aria-hidden="true" />편집
              </button>
            </figure>
          ))}
        </div>
      )}
      {editing && <ImageEditorModal key={typeof editing.source === 'string' ? editing.source : `${editing.source.name}-${editing.source.lastModified}-${pendingFiles.length}`}
        source={editing.source} allowOriginal onApply={applyPhoto} onClose={() => { setEditing(null); setPendingFiles([]) }} />}
    </div>
  )
}
