import { updateProfile } from 'firebase/auth'
import { Camera, LogOut, Save, UserMinus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { logout } from '../services/authService'
import { getFollowers, getFollowing, removeFollower, unfollowUser } from '../services/followService'
import { uploadProfilePhoto } from '../services/storageService'
import { updateUserNickname, updateUserPhotoURL } from '../services/userService'
import type { FollowEdge } from '../types/follow'

type FollowListKind = 'followers' | 'following'

function sortFollowEdgesByCreatedAtDesc(edges: FollowEdge[]): FollowEdge[] {
  return [...edges].sort((a, b) => {
    const left = a.createdAt?.toMillis?.() || 0
    const right = b.createdAt?.toMillis?.() || 0

    return right - left
  })
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { currentUser, profile, refreshProfile } = useAuth()
  const [nickname, setNickname] = useState(profile?.nickname || '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [followListKind, setFollowListKind] = useState<FollowListKind | null>(null)
  const [followList, setFollowList] = useState<FollowEdge[]>([])
  const [followListLoading, setFollowListLoading] = useState(false)
  const [followListError, setFollowListError] = useState('')
  const [followActionUid, setFollowActionUid] = useState('')
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

  async function loadFollowList(kind: FollowListKind) {
    if (!currentUser) {
      return
    }

    setFollowListLoading(true)
    setFollowListError('')

    try {
      const nextList =
        kind === 'followers'
          ? await getFollowers(currentUser.uid)
          : await getFollowing(currentUser.uid)

      setFollowList(sortFollowEdgesByCreatedAtDesc(nextList))
    } catch (loadError) {
      setFollowListError(
        loadError instanceof Error ? loadError.message : '목록을 불러오지 못했습니다.',
      )
    } finally {
      setFollowListLoading(false)
    }
  }

  async function handleOpenFollowList(kind: FollowListKind) {
    setFollowListKind(kind)
    setFollowList([])
    await loadFollowList(kind)
  }

  function handleCloseFollowList() {
    setFollowListKind(null)
    setFollowList([])
    setFollowListError('')
    setFollowActionUid('')
  }

  async function handleRemoveFollow(edge: FollowEdge) {
    if (!currentUser || !followListKind) {
      return
    }

    setFollowActionUid(edge.uid)
    setFollowListError('')

    try {
      if (followListKind === 'followers') {
        await removeFollower(currentUser.uid, edge.uid)
      } else {
        await unfollowUser(currentUser.uid, edge.uid)
      }

      setFollowList((previous) => previous.filter((item) => item.uid !== edge.uid))
      await refreshProfile()
    } catch (removeError) {
      setFollowListError(
        removeError instanceof Error ? removeError.message : '팔로우 관계를 변경하지 못했습니다.',
      )
    } finally {
      setFollowActionUid('')
    }
  }

  const followListTitle = followListKind === 'followers' ? '팔로워' : '팔로잉'

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
          <button type="button" onClick={() => void handleOpenFollowList('followers')}>
            <strong>{profile?.followerCount || 0}</strong>
            <span>팔로워</span>
          </button>
          <button type="button" onClick={() => void handleOpenFollowList('following')}>
            <strong>{profile?.followingCount || 0}</strong>
            <span>팔로잉</span>
          </button>
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

      {followListKind && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal follow-modal" role="dialog" aria-modal="true" aria-labelledby="follow-list-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Network</p>
                <h2 id="follow-list-title">{followListTitle}</h2>
              </div>
              <button className="button-icon" type="button" onClick={handleCloseFollowList} aria-label="닫기">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {followListError && <p className="form-error">{followListError}</p>}
            {followListLoading && <p className="follow-empty">목록을 불러오는 중입니다.</p>}

            {!followListLoading && followList.length === 0 ? (
              <p className="follow-empty">아직 {followListTitle} 목록이 없습니다.</p>
            ) : (
              <div className="follow-list">
                {followList.map((edge) => (
                  <article className="follow-row" key={edge.uid}>
                    {edge.photoURL ? (
                      <img className="chat-avatar" src={edge.photoURL} alt={`${edge.nickname} 프로필`} />
                    ) : (
                      <span className="profile-avatar small">{edge.nickname.slice(0, 1) || 'D'}</span>
                    )}
                    <div className="person-info">
                      <h2>{edge.nickname}</h2>
                      <small>{followListKind === 'followers' ? '나를 팔로우 중' : '내가 팔로우 중'}</small>
                    </div>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => void handleRemoveFollow(edge)}
                      disabled={followActionUid === edge.uid}
                    >
                      <UserMinus size={17} aria-hidden="true" />
                      {followActionUid === edge.uid
                        ? '처리 중'
                        : followListKind === 'followers'
                          ? '제거'
                          : '팔로잉 취소'}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PageContainer>
  )
}
