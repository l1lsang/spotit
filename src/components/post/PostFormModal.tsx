import { Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getTodayDateKey } from '../../lib/date'
import type { LatLng } from '../../lib/kakaoMap'
import { isValidLocation } from '../../lib/mapLocation'
import { useAuth } from '../../hooks/useAuth'
import { useGroups } from '../../hooks/useGroups'
import { useLocationConsent } from '../../contexts/locationConsentCore'
import {
  normalizePinColor,
  getPostPinColor,
  parsePinColorCode,
  type Post,
  type PostFormInput,
  type PostVisibility,
} from '../../types/post'
import { PhotoUploader } from './PhotoUploader'
import { PinThemePicker } from './PinThemePicker'

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
  initialGroupId?: string
  lockGroup?: boolean
  onClose: () => void
  onSubmit: (payload: PostFormSubmitPayload) => Promise<void>
}

function createInitialForm(
  initialPost?: Post | null,
  location?: LatLng | null,
  placePrefill?: PostFormModalProps['placePrefill'],
  initialGroupId = '',
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
    visibility: initialPost?.groupId || initialGroupId ? 'public' : initialPost?.visibility || 'followers',
    groupId: initialPost?.groupId || initialGroupId,
    pinColor: normalizePinColor(initialPost?.pinColor),
    pinThemeId: initialPost?.pinThemeId || '',
  }
}

export function PostFormModal({
  isOpen,
  mode,
  location,
  placePrefill = null,
  initialPost = null,
  initialGroupId = '',
  lockGroup = false,
  onClose,
  onSubmit,
}: PostFormModalProps) {
  const { profile } = useAuth()
  const groupOptions = useGroups(isOpen)
  const ensureLocationConsent = useLocationConsent()
  const [form, setForm] = useState<PostFormInput>(() => createInitialForm(initialPost, location, placePrefill, initialGroupId))
  const [files, setFiles] = useState<File[]>([])
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm(createInitialForm(initialPost, location, placePrefill, initialGroupId))
    setFiles([])
    setExistingPhotoUrls(initialPost?.photoUrls || [])
    setError('')
  }, [initialPost, isOpen, location, placePrefill, initialGroupId])

  if (!isOpen) {
    return null
  }

  function updateField<Key extends keyof PostFormInput>(field: Key, value: PostFormInput[Key]) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (!form.pinThemeId && !parsePinColorCode(form.pinColor)) {
      setError('올바른 HEX 색상 코드를 입력해 주세요.')
      return
    }

    if ((!initialPost && !location && !placePrefill) || !isValidLocation(form)) {
      setError('지도에서 기록할 위치를 먼저 선택해 주세요.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      if (!await ensureLocationConsent(true)) {
        setError('장소를 기록하려면 위치기반서비스 이용약관에 동의해 주세요.')
        return
      }
      await onSubmit({ ...form, pinColor: getPostPinColor(form, profile?.pinThemes), files, existingPhotoUrls })
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
            <span>핀을 모을 곳</span>
            <select value={form.groupId || ''} disabled={lockGroup || groupOptions.loading || submitting} onChange={event => {
              const groupId = event.target.value
              setForm(previous => ({ ...previous, groupId, visibility: groupId ? 'public' : 'followers' }))
            }}>
              <option value="">개인 기록</option>
              {groupOptions.groups.filter(group => groupOptions.joinedIds.includes(group.id) || group.id === form.groupId).map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
              {form.groupId && !groupOptions.groups.some(group => group.id === form.groupId) && <option value={form.groupId}>선택한 그룹</option>}
            </select>
            <small>{form.groupId ? (groupOptions.groups.find(group => group.id === form.groupId)?.visibility === 'private' || (initialPost?.groupId === form.groupId && initialPost.visibility === 'group') ? '비공개 그룹의 핀은 그룹 멤버만 볼 수 있어요.' : '공개 그룹의 핀은 모든 로그인 사용자에게 공개돼요.') : '가입한 그룹을 선택하면 멤버들과 핀을 함께 모을 수 있어요.'}</small>
          </label>
          {groupOptions.error && <p className="form-error" role="alert">{groupOptions.error} <button type="button" className="text-button" onClick={groupOptions.retry}>다시 시도</button></p>}
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
                {(['followers', 'public', 'private'] as PostVisibility[]).map((visibility) => (
                  <button
                    key={visibility}
                    type="button"
                    className={form.visibility === visibility ? 'active' : ''}
                    disabled={Boolean(form.groupId) || submitting}
                    onClick={() => updateField('visibility', visibility)}
                  >
                    {visibility === 'followers'
                      ? '팔로워'
                      : visibility === 'public'
                        ? '전체'
                        : '비공개'}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <PinThemePicker value={form} onChange={(selection) => setForm((previous) => ({ ...previous, ...selection }))} />

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
            disabled={submitting}
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
