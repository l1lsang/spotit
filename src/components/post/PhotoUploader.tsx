import { ImagePlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface FilePreview {
  name: string
  url: string
}

interface PhotoUploaderProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  existingPhotoUrls: string[]
  onRemoveExisting: (url: string) => void
}

export function PhotoUploader({
  files,
  onFilesChange,
  existingPhotoUrls,
  onRemoveExisting,
}: PhotoUploaderProps) {
  const [previews, setPreviews] = useState<FilePreview[]>([])

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
          accept="image/*"
          multiple
          onChange={(event) => {
            const selectedFiles = Array.from(event.target.files || [])
            onFilesChange([...files, ...selectedFiles])
            event.target.value = ''
          }}
        />
      </label>

      {(existingPhotoUrls.length > 0 || previews.length > 0) && (
        <div className="photo-preview-grid">
          {existingPhotoUrls.map((url) => (
            <figure key={url} className="photo-preview">
              <img src={url} alt="등록된 장소 사진" />
              <button type="button" onClick={() => onRemoveExisting(url)} aria-label="사진 제거">
                <X size={16} aria-hidden="true" />
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
              >
                <X size={16} aria-hidden="true" />
              </button>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
