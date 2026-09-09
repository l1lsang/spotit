import { KeyRound, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FirebaseNotice } from '../components/layout/FirebaseNotice'
import { PolicyFooter } from '../components/layout/PolicyFooter'
import { GoogleSignInNotice } from '../components/layout/GoogleSignInNotice'
import { GoogleLogo } from '../components/layout/GoogleLogo'
import { useAuth } from '../hooks/useAuth'
import { loginWithEmail, loginWithGoogle, loginWithKakao, sendPasswordReset } from '../services/authService'

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
  const [socialProvider, setSocialProvider] = useState<'google' | 'kakao' | null>(null)
  const [resetMessage, setResetMessage] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
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
    setSocialProvider('kakao')
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
      setSocialProvider(null)
      setSubmitting(false)
    }
  }

  async function handleGoogleLogin() {
    setSubmitting(true)
    setSocialProvider('google')
    setError('')
    setResetMessage('')
    try {
      await loginWithGoogle()
      navigate(from, { replace: true })
    } catch (loginError) {
      const code = (loginError as { code?: string }).code
      const messages: Record<string, string> = {
        'auth/popup-blocked': '팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해 주세요.',
        'auth/operation-not-allowed': '구글 로그인이 아직 준비되지 않았습니다. 이메일로 로그인해 주세요.',
        'auth/account-exists-with-different-credential': '같은 이메일로 가입한 계정이 있습니다. 기존 로그인 방법을 이용해 주세요.',
        'auth/unauthorized-domain': '이 주소에서는 구글 로그인을 사용할 수 없습니다. 서비스 주소를 확인해 주세요.',
      }
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(messages[code || ''] || '구글 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      setSubmitting(false)
      setSocialProvider(null)
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
          <img className="brand-logo" src="/logo.png" alt="스팟잇" />
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
            {submitting && !socialProvider ? '로그인 중' : '로그인'}
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
          className="button google-button wide"
          aria-describedby="google-signin-notice"
          type="button"
          disabled={!firebaseReady || submitting}
          onClick={handleGoogleLogin}
        >
          <GoogleLogo />
          {socialProvider === 'google' ? '구글 로그인 중' : '구글로 로그인하기'}
        </button>
        <GoogleSignInNotice />

        <button
          className="button kakao-button wide"
          type="button"
          disabled={!firebaseReady || submitting}
          onClick={handleKakaoLogin}
        >
          <svg width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M11.5 2.38989C17.2177 2.38989 21.85 6.04474 21.85 10.5513C21.85 15.0579 17.2177 18.7127 11.5 18.7127C10.8711 18.7127 10.2566 18.6696 9.66002 18.5833C9.06346 19.0038 5.61346 21.426 5.28643 21.4727C5.28643 21.4727 5.15346 21.523 5.03846 21.4583C4.92346 21.3936 4.94502 21.2175 4.94502 21.2175C4.98096 20.9804 5.84346 18.0119 6.00159 17.4621C3.08706 16.021 1.15002 13.4622 1.15002 10.5477C1.15002 6.04114 5.78237 2.38989 11.5 2.38989ZM4.24784 8.11114C3.9244 8.11114 3.66206 8.37349 3.66206 8.69692C3.66206 9.02036 3.9244 9.2827 4.24784 9.2827H5.17862V12.8297C5.17862 13.146 5.44815 13.4011 5.77518 13.4011C6.10221 13.4011 6.37174 13.146 6.37174 12.8297V9.2827H7.30252C7.62596 9.2827 7.88831 9.02036 7.88831 8.69692C7.88831 8.37349 7.62596 8.11114 7.30252 8.11114H4.24424H4.24784ZM9.30784 8.11114C8.91971 8.11833 8.61424 8.41302 8.51362 8.70052L7.0869 12.4596C6.90721 13.0238 7.06534 13.2322 7.22706 13.3077C7.34206 13.3616 7.47502 13.3904 7.60799 13.3904C7.85596 13.3904 8.04643 13.2897 8.10393 13.128L8.39862 12.3518H10.2206L10.5153 13.1244C10.5728 13.2861 10.7633 13.3868 11.0113 13.3868C11.1442 13.3868 11.2736 13.358 11.3922 13.3041C11.5575 13.2286 11.7157 13.0202 11.5324 12.456L10.1057 8.70052C10.005 8.41302 9.69956 8.11833 9.30784 8.11114ZM15.8089 8.11114C15.4783 8.11114 15.2124 8.38067 15.2124 8.70771V12.7938C15.2124 13.1244 15.4819 13.3904 15.8089 13.3904C16.136 13.3904 16.4055 13.1208 16.4055 12.7938V11.4929L16.6139 11.2844L18.0119 13.1388C18.1269 13.2897 18.2994 13.376 18.4899 13.376C18.6192 13.376 18.745 13.3365 18.8492 13.2574C18.975 13.1604 19.0577 13.0202 19.0792 12.8621C19.1008 12.704 19.0613 12.5458 18.9642 12.42L17.4944 10.4722L18.8564 9.1138C18.9499 9.02036 18.9966 8.89099 18.9894 8.75083C18.9822 8.61067 18.9175 8.4777 18.8133 8.37349C18.7019 8.26208 18.551 8.19739 18.4036 8.19739C18.2742 8.19739 18.1592 8.24411 18.073 8.33036L16.4091 9.99786V8.71489C16.4091 8.38427 16.1396 8.11833 15.8125 8.11833L15.8089 8.11114ZM12.5278 8.11114C12.1936 8.11114 11.9205 8.38067 11.9205 8.70771V12.7615C11.9205 13.0633 12.1757 13.3077 12.4919 13.3113H14.4074C14.7236 13.3113 14.9788 13.0633 14.9788 12.7615C14.9788 12.4596 14.72 12.2152 14.4074 12.2152H13.1388V8.70771C13.1388 8.37708 12.8657 8.11114 12.5278 8.11114ZM9.9044 11.2952H8.71127L9.30784 9.60255L9.9044 11.2952Z" fill="black" />
          </svg>
          {socialProvider === 'kakao' ? '카카오 로그인 중' : '카카오로 로그인'}
        </button>

        <p className="auth-switch">
          계정이 없다면 <Link to="/signup">회원가입</Link>
        </p>
        <PolicyFooter newTab />
      </section>
    </main>
  )
}
