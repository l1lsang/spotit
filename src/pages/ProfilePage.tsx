import { updateProfile } from 'firebase/auth'
import { Camera, LogOut, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { logout } from '../services/authService'
import { uploadProfilePhoto } from '../services/storageService'
import { updateUserNickname, updateUserPhotoURL } from '../services/userService'

export function ProfilePage() {
  const navigate = useNavigate()
  const { currentUser, profile, refreshProfile } = useAuth()
  const [nickname, setNickname] = useState(profile?.nickname || '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setNickname(profile?.nickname || '')
  }, [profile?.nickname])

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentUser || !nickname.trim()) {
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      let uploadedPhotoURL = ''

      if (photoFile) {
        uploadedPhotoURL = await uploadProfilePhoto(currentUser.uid, photoFile)
        await updateUserPhotoURL(currentUser.uid, uploadedPhotoURL)
      }

      await updateProfile(currentUser, {
        displayName: nickname.trim(),
        ...(uploadedPhotoURL ? { photoURL: uploadedPhotoURL } : {}),
      })
      await updateUserNickname(currentUser.uid, nickname)
      await refreshProfile()
      setPhotoFile(null)
      setPhotoPreview('')
      setMessage(photoFile ? '프로필을 저장했습니다.' : '닉네임을 저장했습니다.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '프로필 저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }

    setError('')
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <PageContainer className="content-page profile-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>프로필</h1>
          <p>내 계정과 표시 이름을 관리합니다.</p>
        </div>
      </section>

      <section className="profile-panel">
        {profile?.photoURL || photoPreview ? (
          <img
            className="profile-photo"
            src={photoPreview || profile?.photoURL}
            alt={`${nickname || '사용자'} 프로필 사진`}
          />
        ) : (
          <div className="profile-avatar">{nickname.slice(0, 1) || 'D'}</div>
        )}
        <div>
          <span className="muted-label">이메일</span>
          <p>{currentUser?.email || '카카오 계정'}</p>
        </div>
        <div className="profile-stats">
          <span>
            <strong>{profile?.followerCount || 0}</strong>
            팔로워
          </span>
          <span>
            <strong>{profile?.followingCount || 0}</strong>
            팔로잉
          </span>
        </div>
      </section>

      <form className="form profile-form" onSubmit={handleSubmit}>
        <label className="profile-photo-picker">
          <Camera size={18} aria-hidden="true" />
          <span>{photoFile ? photoFile.name : '프로필 사진 변경'}</span>
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
        </label>

        <label className="field">
          <span>닉네임</span>
          <input
            required
            maxLength={24}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>

        {message && <p className="form-success">{message}</p>}
        {error && <p className="form-error">{error}</p>}

        <div className="profile-actions">
          <button className="button button-primary" type="submit" disabled={submitting}>
            <Save size={17} aria-hidden="true" />
            {submitting ? '저장 중' : '저장'}
          </button>
          <button className="button button-secondary" type="button" onClick={handleLogout}>
            <LogOut size={17} aria-hidden="true" />
            로그아웃
          </button>
        </div>
      </form>
    </PageContainer>
  )
}
