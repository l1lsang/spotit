import { Camera, MapPin, MapPinOff, Save, Sparkles, Star, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatClockTime, getTodayDateKey } from '../../lib/date'
import type { LatLng } from '../../lib/mapLocation'
import { isValidLocation } from '../../lib/mapLocation'
import { useAuth } from '../../hooks/useAuth'
import { useGroups } from '../../hooks/useGroups'
import { useNearbyPlaces, type PhotoRecordPrefill } from '../../hooks/usePhotoRecordFlow'
import { useLocationConsent } from '../../contexts/locationConsentCore'
import {
  FOLLOWING_PIN_COLOR,
  FOLLOWING_PIN_COLOR_ERROR,
  normalizePinColor,
  getPostPinColor,
  parsePinColorCode,
  type Post,
  type PostFormInput,
  type PostVisibility,
} from '../../types/post'
import { PhotoUploader } from './PhotoUploader'
import { PinThemePicker } from './PinThemePicker'
import '../../styles/photoRecord.css'

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
  photoPrefill?: PhotoRecordPrefill | null
  initialPost?: Post | null
  initialGroupId?: string
  lockGroup?: boolean
  onClose: () => void
  onChangeLocation?: () => void
  onSubmit: (payload: PostFormSubmitPayload) => Promise<void>
}

const PLACE_NAME_MAX_LENGTH = 50

function createInitialForm(
  initialPost?: Post | null,
  location?: LatLng | null,
  placePrefill?: PostFormModalProps['placePrefill'],
  initialGroupId = '',
  photoPrefill?: PhotoRecordPrefill | null,
): PostFormInput {
  const fallbackLocation = placePrefill?.location || photoPrefill?.location || location

  return {
    title: initialPost?.title || '',
    content: initialPost?.content || '',
    placeName: initialPost?.placeName || placePrefill?.placeName || photoPrefill?.place?.name.slice(0, PLACE_NAME_MAX_LENGTH) || '',
    address: initialPost?.address || placePrefill?.address || photoPrefill?.place?.address || '',
    lat: initialPost?.lat ?? fallbackLocation?.lat ?? 0,
    lng: initialPost?.lng ?? fallbackLocation?.lng ?? 0,
    dateKey: initialPost?.dateKey || photoPrefill?.takenAt?.dateKey || getTodayDateKey(),
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
  photoPrefill = null,
  initialPost = null,
  initialGroupId = '',
  lockGroup = false,
  onClose,
  onChangeLocation,
  onSubmit,
}: PostFormModalProps) {
  const { profile } = useAuth()
  const groupOptions = useGroups(isOpen)
  const ensureLocationConsent = useLocationConsent()
  const [form, setForm] = useState<PostFormInput>(() => createInitialForm(initialPost, location, placePrefill, initialGroupId, photoPrefill))
  const [files, setFiles] = useState<File[]>([])
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const nearby = useNearbyPlaces(isOpen && photoPrefill ? photoPrefill.location : null)
  const nearestPlace = nearby.places[0]

  useEffect(() => {
    if (!isOpen) {
      // Photos from a closed session must not flash in the next one.
      setFiles((previous) => previous.length ? [] : previous)
      return
    }

    setForm(createInitialForm(initialPost, location, placePrefill, initialGroupId, photoPrefill))
    setFiles(photoPrefill?.files || [])
    setExistingPhotoUrls(initialPost?.photoUrls || [])
    setError('')
  }, [initialPost, isOpen, location, placePrefill, initialGroupId, photoPrefill])

  // The nearest place fills empty fields once; anything the user typed stays.
  useEffect(() => {
    if (!isOpen || !nearestPlace) return
    setForm((previous) => previous.placeName || previous.address ? previous : {
      ...previous,
      placeName: nearestPlace.name.slice(0, PLACE_NAME_MAX_LENGTH),
      address: nearestPlace.address,
    })
  }, [isOpen, nearestPlace])

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

    if (!form.pinThemeId && parsePinColorCode(form.pinColor) === FOLLOWING_PIN_COLOR) {
      setError(FOLLOWING_PIN_COLOR_ERROR)
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

  const photoUploader = (
    <PhotoUploader
      disabled={submitting}
      files={files}
      onFilesChange={setFiles}
      existingPhotoUrls={existingPhotoUrls}
      onRemoveExisting={(url) =>
        setExistingPhotoUrls((previous) => previous.filter((photoUrl) => photoUrl !== url))
      }
      badgeFor={photoPrefill ? (file) => (
        photoPrefill.source === 'photo' && file === photoPrefill.files[0]
          ? <><Star size={11} aria-hidden="true" />대표</>
          : photoPrefill.filesWithoutLocation.includes(file) ? <><MapPinOff size={11} aria-hidden="true" />위치 없음</> : null
      ) : undefined}
    />
  )
  const takenAt = photoPrefill?.takenAt
  const placeFromSuggestion = nearby.places.some((place) => place.name.slice(0, PLACE_NAME_MAX_LENGTH) === form.placeName)

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="post-form-title">
        <div className="modal-header">
          <div>
            <h2 id="post-form-title">{mode === 'edit' ? '장소 기록 수정' : photoPrefill ? '사진으로 기록하기' : '오늘의 장소를 남겨요'}</h2>
          </div>
          <button className="button-icon" type="button" onClick={onClose} aria-label="닫기">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          {photoPrefill && (
            <>
              {photoUploader}
              <section className="photo-location-summary" aria-label="기록 위치">
                <MapPin size={18} aria-hidden="true" />
                <p>
                  <strong>{photoPrefill.source === 'photo' ? '사진을 찍은 위치' : '지도에서 고른 위치'}</strong>
                  <small>좌표 {form.lat.toFixed(5)}, {form.lng.toFixed(5)}</small>
                </p>
                {onChangeLocation && (
                  <button className="text-action" type="button" onClick={onChangeLocation} disabled={submitting}>위치 변경</button>
                )}
              </section>
            </>
          )}
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

          <div className="photo-place-field">
            <label className="field">
              <span className="photo-field-label">
                장소 이름
                {photoPrefill && placeFromSuggestion && <small className="photo-chip"><Sparkles size={11} aria-hidden="true" />주변 장소 추천</small>}
              </span>
              <input
                required
                maxLength={PLACE_NAME_MAX_LENGTH}
                value={form.placeName}
                onChange={(event) => updateField('placeName', event.target.value)}
                placeholder="예: 서울시청 앞 광장"
              />
            </label>
            {photoPrefill && (nearby.loading || nearby.places.length > 0) && (
              <div className="place-suggestions" role="group" aria-label="사진 위치 주변 장소">
                {nearby.loading ? <small role="status">주변 장소를 찾는 중…</small> : nearby.places.slice(0, 5).map((place) => {
                  const name = place.name.slice(0, PLACE_NAME_MAX_LENGTH)
                  return (
                    <button key={place.id} type="button" aria-pressed={form.placeName === name} disabled={submitting}
                      onClick={() => setForm((previous) => ({ ...previous, placeName: name, address: place.address }))}>
                      {name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

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
              <span className="photo-field-label">
                날짜
                {takenAt && form.dateKey === takenAt.dateKey && <small className="photo-chip"><Camera size={11} aria-hidden="true" />사진 촬영일</small>}
              </span>
              <input
                type="date"
                required
                value={form.dateKey}
                onChange={(event) => updateField('dateKey', event.target.value)}
              />
              {photoPrefill && (
                <small>{takenAt
                  ? `사진을 찍은 날로 자동 입력됐어요 (${formatClockTime(takenAt.time)}).`
                  : '사진에 촬영 날짜가 없어 오늘 날짜를 넣었어요.'}</small>
              )}
            </label>

            <fieldset className="field">
              <legend>공개 범위</legend>
              <ul className="segmented" aria-label="공개 범위 선택">
                {(['followers', 'public', 'private'] as PostVisibility[]).map((visibility) => (
                  <li key={visibility}><button
                    type="button"
                    className={form.visibility === visibility ? 'active' : ''}
                    aria-pressed={form.visibility === visibility}
                    disabled={Boolean(form.groupId) || submitting}
                    onClick={() => updateField('visibility', visibility)}
                  >
                    {visibility === 'followers'
                      ? '팔로워'
                      : visibility === 'public'
                        ? '전체'
                        : '비공개'}
                  </button></li>
                ))}
              </ul>
              {photoPrefill && <small>사진 위치가 집 근처라면 공개 범위를 한 번 더 확인해 주세요.</small>}
            </fieldset>
          </div>

          <PinThemePicker value={form} onChange={(selection) => setForm((previous) => ({ ...previous, ...selection }))} />

          <label className="field">
            <span>메모{photoPrefill && <small> 선택</small>}</span>
            <textarea
              required={!photoPrefill}
              rows={5}
              value={form.content}
              onChange={(event) => updateField('content', event.target.value)}
              placeholder={photoPrefill ? '어떤 순간이었나요? 메모 없이 사진만으로도 저장할 수 있어요.' : '그 장소에서 남기고 싶은 장면과 마음을 적어주세요'}
            />
          </label>

          {!photoPrefill && (
            <>
              {photoUploader}
              <p className="coordinate-note">
                좌표 {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
              </p>
            </>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button className="button button-secondary" type="button" onClick={onClose}>
              취소
            </button>
            <button className="button button-primary" type="submit" disabled={submitting}>
              {photoPrefill ? <MapPin size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
              {submitting ? '저장 중' : photoPrefill ? '핀 찍고 기록 저장' : '저장하기'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
