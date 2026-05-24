import { LogOut, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { useAuth } from '../hooks/useAuth'
import { logout } from '../services/authService'
import { updateUserNickname } from '../services/userService'

export function ProfilePage() {
  const navigate = useNavigate()
  const { currentUser, profile, refreshProfile } = useAuth()
  const [nickname, setNickname] = useState(profile?.nickname || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setNickname(profile?.nickname || '')
  }, [profile?.nickname])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentUser || !nickname.trim()) {
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await updateUserNickname(currentUser.uid, nickname)
      await refreshProfile()
      setMessage('닉네임을 저장했습니다.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '프로필 저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
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
        <div className="profile-avatar">{nickname.slice(0, 1) || 'D'}</div>
        <div>
          <span className="muted-label">이메일</span>
          <p>{currentUser?.email}</p>
        </div>
      </section>

      <form className="form profile-form" onSubmit={handleSubmit}>
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
