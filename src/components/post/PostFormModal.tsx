import { Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getTodayDateKey } from '../../lib/date'
import type { LatLng } from '../../lib/kakaoMap'
import {
  DEFAULT_POST_PIN_GROUP,
  POST_PIN_GROUPS,
  type Post,
  type PostFormInput,
  type PostVisibility,
} from '../../types/post'
import { PhotoUploader } from './PhotoUploader'

export interface PostFormSubmitPayload extends PostFormInput {
  files: File[]
  existingPhotoUrls: string[]
}

interface PostFormModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  location?: LatLng | null
  placePrefill?: {
    placeName: string
    address: string
    location: LatLng
  } | null
  initialPost?: Post | null
  onClose: () => void
  onSubmit: (payload: PostFormSubmitPayload) => Promise<void>
}

function createInitialForm(
  initialPost?: Post | null,
  location?: LatLng | null,
  placePrefill?: PostFormModalProps['placePrefill'],
): PostFormInput {
  const fallbackLocation = placePrefill?.location || location

  return {
    title: initialPost?.title || '',
    content: initialPost?.content || '',
    placeName: initialPost?.placeName || placePrefill?.placeName || '',
    address: initialPost?.address || placePrefill?.address || '',
    lat: initialPost?.lat ?? fallbackLocation?.lat ?? 0,
    lng: initialPost?.lng ?? fallbackLocation?.lng ?? 0,
    dateKey: initialPost?.dateKey || getTodayDateKey(),
    visibility: initialPost?.visibility === 'public' ? 'followers' : initialPost?.visibility || 'followers',
    pinColor: initialPost?.pinColor || DEFAULT_POST_PIN_GROUP,
  }
}

export function PostFormModal({
  isOpen,
  mode,
  location,
  placePrefill = null,
  initialPost = null,
  onClose,
  onSubmit,
}: PostFormModalProps) {
  const [form, setForm] = useState<PostFormInput>(() => createInitialForm(initialPost, location, placePrefill))
  const [files, setFiles] = useState<File[]>([])
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm(createInitialForm(initialPost, location, placePrefill))
    setFiles([])
    setExistingPhotoUrls(initialPost?.photoUrls || [])
    setError('')
  }, [initialPost, isOpen, location, placePrefill])

  if (!isOpen) {
    return null
  }

  function updateField<Key extends keyof PostFormInput>(field: Key, value: PostFormInput[Key]) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.lat || !form.lng) {
      setError('지도에서 기록할 위치를 먼저 선택해 주세요.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await onSubmit({ ...form, files, existingPhotoUrls })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '기록 저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="post-form-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{mode === 'create' ? '새 장소 기록' : '기록 수정'}</p>
            <h2 id="post-form-title">오늘의 장소를 남겨요</h2>
          </div>
          <button className="button-icon" type="button" onClick={onClose} aria-label="닫기">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>제목</span>
            <input
              required
              maxLength={60}
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="예: 햇살 좋았던 점심 산책"
            />
          </label>

          <label className="field">
            <span>장소 이름</span>
            <input
              required
              maxLength={50}
              value={form.placeName}
              onChange={(event) => updateField('placeName', event.target.value)}
              placeholder="예: 서울시청 앞 광장"
            />
          </label>

          <label className="field">
            <span>주소 또는 위치 설명</span>
            <input
              value={form.address}
              onChange={(event) => updateField('address', event.target.value)}
              placeholder="정확한 주소를 몰라도 괜찮아요"
            />
          </label>

          <div className="form-row">
            <label className="field">
              <span>날짜</span>
              <input
                type="date"
                required
                value={form.dateKey}
                onChange={(event) => updateField('dateKey', event.target.value)}
              />
            </label>

            <fieldset className="field">
              <legend>공개 범위</legend>
              <div className="segmented">
                {(['followers', 'private'] as PostVisibility[]).map((visibility) => (
                  <button
                    key={visibility}
                    type="button"
                    className={form.visibility === visibility ? 'active' : ''}
                    onClick={() => updateField('visibility', visibility)}
                  >
                    {visibility === 'followers' ? '팔로워 공개' : '비공개'}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <fieldset className="field">
            <legend>내 지도 핀 그룹</legend>
            <div className="pin-group-palette">
              {POST_PIN_GROUPS.map((group) => (
                <button
                  key={group.id}
                  className={`color-swatch-button ${form.pinColor === group.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => updateField('pinColor', group.id)}
                  aria-pressed={form.pinColor === group.id}
                >
                  <i style={{ backgroundColor: group.value }} />
                  {group.label}
                </button>
              ))}
            </div>
            <small className="field-help">내 계정에서만 색깔 그룹으로 보이고, 다른 사람에게는 같은 색으로 보입니다.</small>
          </fieldset>

          <label className="field">
            <span>메모</span>
            <textarea
              required
              rows={5}
              value={form.content}
              onChange={(event) => updateField('content', event.target.value)}
              placeholder="그 장소에서 남기고 싶은 장면과 마음을 적어주세요"
            />
          </label>

          <PhotoUploader
            files={files}
            onFilesChange={setFiles}
            existingPhotoUrls={existingPhotoUrls}
            onRemoveExisting={(url) =>
              setExistingPhotoUrls((previous) => previous.filter((photoUrl) => photoUrl !== url))
            }
          />

          <p className="coordinate-note">
            좌표 {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
          </p>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button className="button button-secondary" type="button" onClick={onClose}>
              취소
            </button>
            <button className="button button-primary" type="submit" disabled={submitting}>
              <Save size={17} aria-hidden="true" />
              {submitting ? '저장 중' : '저장하기'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
