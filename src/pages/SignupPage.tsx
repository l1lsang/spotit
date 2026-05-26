import { KeyRound, Mail, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FirebaseNotice } from '../components/layout/FirebaseNotice'
import { useAuth } from '../hooks/useAuth'
import { signupWithEmail } from '../services/authService'

export function SignupPage() {
  const navigate = useNavigate()
  const { firebaseReady } = useAuth()
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await signupWithEmail(email, password, nickname)
      navigate('/map', { replace: true })
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : '회원가입에 실패했습니다.')
    } finally {
      setSubmitting(false)
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
          <p className="eyebrow">Create account</p>
          <h1>회원가입</h1>
          <p>게스트 없이, 나만의 기록을 안전하게 보관합니다.</p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field icon-field">
            <span>닉네임</span>
            <UserRound size={18} aria-hidden="true" />
            <input
              required
              maxLength={24}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="지도 위에 보일 이름"
            />
          </label>

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
            {submitting ? '가입 중' : '회원가입'}
          </button>
        </form>

        <p className="auth-switch">
          이미 계정이 있다면 <Link to="/login">로그인</Link>
        </p>
      </section>
    </main>
  )
}
