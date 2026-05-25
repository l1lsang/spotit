import { ChevronDown, ChevronUp, KeyRound, Mail, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FirebaseNotice } from '../components/layout/FirebaseNotice'
import { useAuth } from '../hooks/useAuth'
import { loginWithEmail, loginWithKakao, sendPasswordReset } from '../services/authService'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { firebaseReady } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [showThirdPartyPrivacy, setShowThirdPartyPrivacy] = useState(false)
  const from = (location.state as LocationState | null)?.from || '/map'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setResetMessage('')

    try {
      await loginWithEmail(email, password)
      navigate(from, { replace: true })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '로그인에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleKakaoLogin() {
    setSubmitting(true)
    setError('')
    setResetMessage('')

    try {
      await loginWithKakao()
      navigate(from, { replace: true })
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : '카카오 로그인에 실패했습니다. Firebase OIDC 설정을 확인해 주세요.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePasswordReset() {
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('비밀번호 재설정 메일을 받을 이메일을 입력해 주세요.')
      setResetMessage('')
      return
    }

    setResetSubmitting(true)
    setError('')
    setResetMessage('')

    try {
      await sendPasswordReset(trimmedEmail)
      setResetMessage('비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해 주세요.')
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : '비밀번호 재설정 메일 발송에 실패했습니다.')
    } finally {
      setResetSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand-lockup auth-brand" to="/">
          <img className="brand-logo" src="/logo.png" alt="스팟온" />
        </Link>

        <FirebaseNotice />

        <div className="auth-heading">
          <p className="eyebrow">Welcome back</p>
          <h1>로그인</h1>
          <p>내 장소 기록을 이어서 남겨보세요.</p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field icon-field">
            <span>이메일</span>
            <Mail size={18} aria-hidden="true" />
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="field icon-field">
            <span>비밀번호</span>
            <KeyRound size={18} aria-hidden="true" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="6자 이상"
            />
          </label>

          {error && <p className="form-error">{error}</p>}
          {resetMessage && <p className="form-success">{resetMessage}</p>}

          <button className="button button-primary wide" type="submit" disabled={!firebaseReady || submitting}>
            {submitting ? '로그인 중' : '로그인'}
          </button>
          <button
            className="auth-text-button"
            type="button"
            disabled={!firebaseReady || resetSubmitting}
            onClick={() => void handlePasswordReset()}
          >
            {resetSubmitting ? '메일 보내는 중' : '비밀번호를 잊으셨나요?'}
          </button>
        </form>

        <div className="auth-divider">
          <span>또는</span>
        </div>

        <button
          className="button kakao-button wide"
          type="button"
          disabled={!firebaseReady || submitting}
          onClick={handleKakaoLogin}
        >
          <MessageCircle size={18} aria-hidden="true" />
          카카오로 로그인
        </button>

        <section className="privacy-consent">
          <button
            className="privacy-consent-toggle"
            type="button"
            onClick={() => setShowThirdPartyPrivacy((previous) => !previous)}
            aria-expanded={showThirdPartyPrivacy}
          >
            개인정보 제3자 제공에 동의합니다
            {showThirdPartyPrivacy ? (
              <ChevronUp size={15} aria-hidden="true" />
            ) : (
              <ChevronDown size={15} aria-hidden="true" />
            )}
          </button>

          {showThirdPartyPrivacy && (
            <div className="privacy-consent-detail">
              <p>
                스팟온은 회원 인증과 서비스 제공을 위해 아래 범위에서 개인정보를 제3자에게 제공할 수 있습니다.
              </p>
              <dl>
                <div>
                  <dt>제공받는 자</dt>
                  <dd>Google Firebase/Google Cloud, Kakao Corp.</dd>
                </div>
                <div>
                  <dt>제공 목적</dt>
                  <dd>회원 인증, 로그인 상태 유지, 프로필 동기화, 앱 데이터 저장 및 보안 관리</dd>
                </div>
                <div>
                  <dt>제공 항목</dt>
                  <dd>이메일, 닉네임, 프로필 이미지 URL, 로그인 제공자, 서비스 이용 중 생성되는 식별자와 기록 메타데이터</dd>
                </div>
                <div>
                  <dt>보유 및 이용 기간</dt>
                  <dd>회원 탈퇴 또는 제공 목적 달성 시까지 보관하며, 법령상 보관 의무가 있으면 해당 기간 동안 보관합니다.</dd>
                </div>
                <div>
                  <dt>동의 거부 권리</dt>
                  <dd>동의를 거부할 수 있으나, 거부 시 로그인과 회원 기반 기능 이용이 제한될 수 있습니다.</dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        <p className="auth-switch">
          계정이 없다면 <Link to="/signup">회원가입</Link>
        </p>
      </section>
    </main>
  )
}
