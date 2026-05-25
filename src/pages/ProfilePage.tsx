import { updateProfile } from 'firebase/auth'
import { BookOpen, Camera, Check, Lock, LogOut, Save, Trash2, UserMinus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { deleteAccount, logout } from '../services/authService'
import {
  acceptFollowRequest,
  declineFollowRequest,
  getFollowers,
  getFollowing,
  getIncomingFollowRequests,
  removeFollower,
  unfollowUser,
} from '../services/followService'
import { uploadProfilePhoto } from '../services/storageService'
import { updateUserNickname, updateUserPhotoURL, updateUserPrivacy } from '../services/userService'
import type { FollowEdge, FollowRequest } from '../types/follow'

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
  const [isPrivate, setIsPrivate] = useState(Boolean(profile?.isPrivate))
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([])
  const [followRequestLoading, setFollowRequestLoading] = useState(false)
  const [followRequestError, setFollowRequestError] = useState('')
  const [followRequestActionUid, setFollowRequestActionUid] = useState('')
  const [followListKind, setFollowListKind] = useState<FollowListKind | null>(null)
  const [followList, setFollowList] = useState<FollowEdge[]>([])
  const [followListLoading, setFollowListLoading] = useState(false)
  const [followListError, setFollowListError] = useState('')
  const [followActionUid, setFollowActionUid] = useState('')
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setNickname(profile?.nickname || '')
    setIsPrivate(Boolean(profile?.isPrivate))
  }, [profile?.isPrivate, profile?.nickname])

  const loadFollowRequests = useCallback(async () => {
    if (!currentUser) {
      setFollowRequests([])
      return
    }

    setFollowRequestLoading(true)
    setFollowRequestError('')

    try {
      const nextRequests = await getIncomingFollowRequests(currentUser.uid)
      setFollowRequests(sortFollowEdgesByCreatedAtDesc(nextRequests))
    } catch (loadError) {
      setFollowRequestError(
        loadError instanceof Error ? loadError.message : '팔로우 요청을 불러오지 못했습니다.',
      )
    } finally {
      setFollowRequestLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    void loadFollowRequests()
  }, [loadFollowRequests])

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
      await updateUserPrivacy(currentUser.uid, isPrivate)
      await refreshProfile()
      setPhotoFile(null)
      setPhotoPreview('')
      setMessage('프로필을 저장했습니다.')
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

  async function handleDeleteAccount() {
    if (!currentUser) {
      return
    }

    setDeletingAccount(true)
    setError('')
    setMessage('')

    try {
      await deleteAccount(currentUser)
      navigate('/', { replace: true })
    } catch (deleteError) {
      const errorCode = (deleteError as { code?: string }).code

      setError(
        errorCode === 'auth/requires-recent-login'
          ? '보안을 위해 최근 로그인 후 다시 탈퇴를 진행해 주세요.'
          : deleteError instanceof Error
            ? deleteError.message
            : '계정 탈퇴에 실패했습니다.',
      )
      setIsDeleteOpen(false)
    } finally {
      setDeletingAccount(false)
    }
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

  async function handleAcceptFollowRequest(request: FollowRequest) {
    if (!profile) {
      return
    }

    setFollowRequestActionUid(request.uid)
    setFollowRequestError('')
    setMessage('')

    try {
      await acceptFollowRequest(profile, request)
      setFollowRequests((previous) => previous.filter((item) => item.uid !== request.uid))
      await refreshProfile()
      setMessage('팔로우 요청을 승인했습니다.')
    } catch (acceptError) {
      setFollowRequestError(
        acceptError instanceof Error ? acceptError.message : '팔로우 요청을 승인하지 못했습니다.',
      )
    } finally {
      setFollowRequestActionUid('')
    }
  }

  async function handleDeclineFollowRequest(request: FollowRequest) {
    if (!currentUser) {
      return
    }

    setFollowRequestActionUid(request.uid)
    setFollowRequestError('')
    setMessage('')

    try {
      await declineFollowRequest(currentUser.uid, request.uid)
      setFollowRequests((previous) => previous.filter((item) => item.uid !== request.uid))
      setMessage('팔로우 요청을 거절했습니다.')
    } catch (declineError) {
      setFollowRequestError(
        declineError instanceof Error ? declineError.message : '팔로우 요청을 거절하지 못했습니다.',
      )
    } finally {
      setFollowRequestActionUid('')
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
          {profile?.isPrivate && (
            <span className="private-account-badge">
              <Lock size={13} aria-hidden="true" />
              비공개
            </span>
          )}
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

      {(profile?.isPrivate || followRequests.length > 0 || followRequestLoading) && (
        <section className="follow-request-panel">
          <div className="follow-request-heading">
            <div>
              <span className="muted-label">팔로우 요청</span>
              <strong>{followRequests.length}</strong>
            </div>
            <button className="button button-secondary" type="button" onClick={() => void loadFollowRequests()}>
              새로고침
            </button>
          </div>

          {followRequestError && <p className="form-error">{followRequestError}</p>}
          {followRequestLoading && <p className="follow-empty">요청을 불러오는 중입니다.</p>}
          {!followRequestLoading && followRequests.length === 0 ? (
            <p className="follow-empty">대기 중인 요청이 없습니다.</p>
          ) : (
            <div className="follow-list">
              {followRequests.map((request) => (
                <article className="follow-row request-row" key={request.uid}>
                  {request.photoURL ? (
                    <img className="chat-avatar" src={request.photoURL} alt={`${request.nickname} 프로필`} />
                  ) : (
                    <span className="profile-avatar small">{request.nickname.slice(0, 1) || 'D'}</span>
                  )}
                  <div className="person-info">
                    <h2>{request.nickname}</h2>
                    <small>승인 대기 중</small>
                  </div>
                  <div className="request-actions">
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => void handleAcceptFollowRequest(request)}
                      disabled={followRequestActionUid === request.uid}
                    >
                      <Check size={17} aria-hidden="true" />
                      승인
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => void handleDeclineFollowRequest(request)}
                      disabled={followRequestActionUid === request.uid}
                    >
                      <X size={17} aria-hidden="true" />
                      거절
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

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

        <label className="privacy-setting">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(event) => setIsPrivate(event.target.checked)}
          />
          <span>
            <Lock size={17} aria-hidden="true" />
            비공개 계정
          </span>
          <small>새 팔로우를 승인제로 받기</small>
        </label>

        {message && <p className="form-success">{message}</p>}
        {error && <p className="form-error">{error}</p>}

        <div className="profile-actions">
          <button className="button button-secondary" type="button" onClick={() => navigate('/my')}>
            <BookOpen size={17} aria-hidden="true" />
            내 기록
          </button>
          <button className="button button-primary" type="submit" disabled={submitting}>
            <Save size={17} aria-hidden="true" />
            {submitting ? '저장 중' : '저장'}
          </button>
          <button className="button button-secondary" type="button" onClick={handleLogout}>
            <LogOut size={17} aria-hidden="true" />
            로그아웃
          </button>
          <button className="button button-danger" type="button" onClick={() => setIsDeleteOpen(true)}>
            <Trash2 size={17} aria-hidden="true" />
            계정 탈퇴
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

      {isDeleteOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal account-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Delete account</p>
                <h2 id="delete-account-title">계정을 탈퇴할까요?</h2>
              </div>
              <button
                className="button-icon"
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                aria-label="닫기"
                disabled={deletingAccount}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="delete-account-copy">
              <p>탈퇴하면 프로필, 팔로우 관계, 내가 작성한 기록, 댓글, 좋아요가 삭제됩니다.</p>
              <p>채팅방에 남아 있던 내 메시지는 탈퇴한 사용자 메시지로 익명 처리됩니다.</p>
            </div>

            <div className="modal-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                disabled={deletingAccount}
              >
                취소
              </button>
              <button
                className="button button-danger"
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={deletingAccount}
              >
                <Trash2 size={17} aria-hidden="true" />
                {deletingAccount ? '탈퇴 처리 중' : '탈퇴하기'}
              </button>
            </div>
          </section>
        </div>
      )}
    </PageContainer>
  )
}
