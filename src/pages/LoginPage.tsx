import { KeyRound, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FirebaseNotice } from '../components/layout/FirebaseNotice'
import { useAuth } from '../hooks/useAuth'
import { loginWithEmail } from '../services/authService'

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
  const from = (location.state as LocationState | null)?.from || '/map'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await loginWithEmail(email, password)
      navigate(from, { replace: true })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '로그인에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand-lockup auth-brand" to="/">
          <span className="brand-mark">S</span>
          <span>
            <strong>스팟잇</strong>
            <small>오늘, 이곳</small>
          </span>
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

          <button className="button button-primary wide" type="submit" disabled={!firebaseReady || submitting}>
            {submitting ? '로그인 중' : '로그인'}
          </button>
        </form>

        <p className="auth-switch">
          계정이 없다면 <Link to="/signup">회원가입</Link>
        </p>
      </section>
    </main>
  )
}
