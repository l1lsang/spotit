import { updateProfile } from 'firebase/auth'
import { ArrowLeft, ArrowRight, AtSign, Camera, Check, Crop, KeyRound, Mail, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FirebaseNotice } from '../components/layout/FirebaseNotice'
import { PolicyFooter } from '../components/layout/PolicyFooter'
import { SignupRequirementsFields } from '../components/layout/SignupRequirementsFields'
import { ImageEditorModal } from '../components/image/ImageEditorModal'
import { useAuth } from '../hooks/useAuth'
import { requireAuth } from '../lib/firebase'
import { getSignupRequirementsError, type SignupRequirements } from '../lib/signupRequirements'
import { BIO_MAX_LENGTH, NICKNAME_MAX_LENGTH, USERNAME_MAX_LENGTH, getProfilePhotoError, getUsernameError, normalizeUsername } from '../lib/userProfile'
import { signupWithEmail } from '../services/authService'
import { uploadProfilePhoto } from '../services/storageService'
import { isUsernameAvailable, updateUserProfileDetails, upsertUserProfile, UsernameTakenError } from '../services/userService'

export function SignupPage() {
  const navigate = useNavigate()
  const { currentUser, profile, loading, firebaseReady, refreshProfile } = useAuth()
  const [step, setStep] = useState<'account' | 'profile'>('account')
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [requirements, setRequirements] = useState<SignupRequirements>({
    birthDate: '', termsAccepted: false, privacyAccepted: false, locationAccepted: false,
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [editingPhoto, setEditingPhoto] = useState<File | string | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [error, setError] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const submitLock = useRef(false)
  const normalizedUsername = normalizeUsername(username)

  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('')
      return
    }
    const preview = URL.createObjectURL(photoFile)
    setPhotoPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [photoFile])

  async function handleNext(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitLock.current) return
    const validationError = getUsernameError(username)
    setUsernameError(validationError)
    setError('')
    if (validationError) return
    const requirementsError = getSignupRequirementsError(requirements)
    if (requirementsError) { setError(requirementsError); return }

    submitLock.current = true
    setSubmitting(true)
    try {
      if (!await isUsernameAvailable(username, currentUser?.uid)) {
        setUsernameError('이미 사용 중인 사용자 이름입니다. 다른 이름을 입력해 주세요.')
        return
      }
      setUsername(normalizedUsername)
      setNickname((previous) => previous || profile?.nickname || currentUser?.displayName || '')
      setStep('profile')
    } catch {
      setError('사용자 이름을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitLock.current) return
    const requirementsError = getSignupRequirementsError(requirements)
    if (requirementsError) { setError(requirementsError); setStep('account'); return }
    if (!nickname.trim()) {
      setError('닉네임을 입력해 주세요.')
      return
    }
    submitLock.current = true
    setSubmitting(true)
    setError('')

    try {
      // The final transaction also prevents concurrent signups taking the same name.
      if (!await isUsernameAvailable(username, requireAuth().currentUser?.uid)) throw new UsernameTakenError()
      // Reuse a newly created account when retrying after an upload or profile save failure.
      const user = requireAuth().currentUser || await signupWithEmail(email, password, requirements)
      setPassword('')
      await upsertUserProfile(user)
      const photoURL = photoFile ? await uploadProfilePhoto(user.uid, photoFile) : user.photoURL || ''
      await updateProfile(user, { displayName: nickname.trim(), photoURL })
      await updateUserProfileDetails(user.uid, { username, nickname, bio, photoURL }, requirements)
      await refreshProfile()
      navigate('/map', { replace: true })
    } catch (signupError) {
      if (signupError instanceof UsernameTakenError) {
        setUsernameError(signupError.message)
        setStep('account')
      } else {
        const code = (signupError as { code?: string }).code
        const messages: Record<string, string> = {
          'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 입력해 주세요.',
          'auth/invalid-email': '올바른 이메일 주소를 입력해 주세요.',
          'auth/weak-password': '비밀번호는 6자 이상으로 입력해 주세요.',
          'auth/network-request-failed': '인터넷 연결을 확인하고 다시 시도해 주세요.',
          'storage/unauthorized': '프로필 사진을 업로드하지 못했습니다. 사진을 다시 선택하거나 제외하고 시도해 주세요.',
        }
        setError(messages[code || ''] || '가입 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        if (code?.startsWith('auth/') && !requireAuth().currentUser) setStep('account')
      }
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const validationError = getProfilePhotoError(file)
    setError(validationError)
    if (!validationError) setEditingPhoto(file)
  }

  if (loading && !submitting) return <main className="screen-message">가입 정보를 확인하는 중입니다.</main>
  if (currentUser && profile?.onboardingComplete !== false && profile?.username && !submitting) {
    return <Navigate to="/map" replace />
  }

  return (
    <main className="auth-page signup-page">
      <section className="auth-panel signup-panel" aria-labelledby="signup-title">
        <Link className="brand-lockup auth-brand" to="/">
          <img className="brand-logo" src="/logo.png" alt="스팟잇" />
        </Link>
        <FirebaseNotice />

        <ol className="signup-progress" aria-label="가입 단계">
          <li className={step === 'account' ? 'active' : 'complete'} aria-current={step === 'account' ? 'step' : undefined}>
            <span>{step === 'profile' ? <Check size={14} aria-hidden="true" /> : '1'}</span>계정 만들기
          </li>
          <li className={step === 'profile' ? 'active' : ''} aria-current={step === 'profile' ? 'step' : undefined}>
            <span>2</span>프로필 꾸미기
          </li>
        </ol>

        <div className="auth-heading">
          <p className="eyebrow">{step === 'account' ? 'Create account' : 'Make it yours'}</p>
          <h1 id="signup-title" ref={headingRef} tabIndex={-1}>
            {step === 'account' ? '나만의 이름으로 시작해요' : '프로필을 꾸며보세요'}
          </h1>
          <p>{step === 'account' ? '스팟잇에서 나를 찾을 수 있는 고유한 이름이에요.' : '사진과 짧은 소개로 나를 표현해 보세요.'}</p>
        </div>

        {step === 'account' ? (
          <form className="form" onSubmit={handleNext}>
            <fieldset className="signup-fields" disabled={submitting}>
              <div className="field">
                <label htmlFor="signup-username">사용자 이름</label>
                <div className="username-input">
                  <AtSign size={18} aria-hidden="true" />
                  <input id="signup-username" required maxLength={USERNAME_MAX_LENGTH} autoComplete="username"
                    autoCapitalize="none" spellCheck={false} value={username}
                    aria-invalid={Boolean(usernameError)} aria-describedby="username-hint username-error"
                    onChange={(event) => { setUsername(event.target.value.toLowerCase()); setUsernameError('') }}
                    placeholder="spotit.name" />
                </div>
                <small id="username-hint" className="field-hint">영어, 숫자, 밑줄(_), 점(.) · 최대 30자 · 대문자는 소문자로 저장돼요.</small>
                <small id="username-error" className="field-error" aria-live="polite">{usernameError}</small>
              </div>
              {!currentUser && <>
                <label className="field icon-field">
                  <span>이메일</span><Mail size={18} aria-hidden="true" />
                  <input type="email" required autoComplete="email" value={email}
                    onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                </label>
                <label className="field icon-field">
                  <span>비밀번호</span><KeyRound size={18} aria-hidden="true" />
                  <input type="password" required minLength={6} autoComplete="new-password" value={password}
                    onChange={(event) => setPassword(event.target.value)} placeholder="6자 이상" />
                </label>
              </>}
              <SignupRequirementsFields value={requirements} onChange={value => { setRequirements(value); setError('') }} />
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button-primary wide" type="submit" disabled={!firebaseReady}>
                {submitting ? '사용자 이름 확인 중' : '다음'}<ArrowRight size={18} aria-hidden="true" />
              </button>
            </fieldset>
          </form>
        ) : (
          <form className="form" onSubmit={handleSubmit}>
            <fieldset className="signup-fields" disabled={submitting}>
              <div className="signup-photo-section">
                <label className="signup-photo-picker">
                  {photoPreview || currentUser?.photoURL ? (
                    <img src={photoPreview || currentUser?.photoURL || ''} alt="프로필 사진 미리보기" />
                  ) : <UserRound size={42} strokeWidth={1.5} aria-hidden="true" />}
                  <span className="signup-camera"><Camera size={16} aria-hidden="true" /></span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="프로필 사진 선택" onChange={handlePhotoChange} />
                </label>
                <strong>@{normalizedUsername}</strong>
                <span className="field-hint">사진을 눌러 추가해 보세요 · 선택 사항 · 최대 5MB</span>
                {(photoFile || currentUser?.photoURL) && <button className="auth-text-button" type="button"
                  onClick={() => setEditingPhoto(photoFile || currentUser?.photoURL || null)}><Crop size={14} aria-hidden="true" /> 사진 편집</button>}
                {photoFile && <button className="auth-text-button" type="button" onClick={() => setPhotoFile(null)}>
                  <X size={13} aria-hidden="true" /> 선택한 사진 지우기
                </button>}
              </div>
              <label className="field">
                <span>닉네임</span>
                <input required maxLength={NICKNAME_MAX_LENGTH} autoComplete="nickname" value={nickname}
                  onChange={(event) => setNickname(event.target.value)} placeholder="친구들에게 보여줄 이름" />
                <small className="field-hint">한글도 사용할 수 있어요 · 최대 24자</small>
              </label>
              <label className="field">
                <span className="field-label-row">소개글 <small>선택 사항</small></span>
                <textarea maxLength={BIO_MAX_LENGTH} rows={3} value={bio} onChange={(event) => setBio(event.target.value)}
                  placeholder="좋아하는 장소, 취향, 나를 소개하는 한마디" aria-describedby="signup-bio-count" />
                <small id="signup-bio-count" className="field-counter">{bio.length} / {BIO_MAX_LENGTH}</small>
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button-primary wide" type="submit" disabled={!firebaseReady}>
                {submitting ? '프로필 저장 중' : '가입 완료'}<Check size={18} aria-hidden="true" />
              </button>
              <button className="auth-text-button signup-back" type="button" onClick={() => { setError(''); setStep('account') }}>
                <ArrowLeft size={16} aria-hidden="true" /> 이전 단계
              </button>
            </fieldset>
          </form>
        )}
        {!currentUser && <p className="auth-switch">이미 계정이 있다면 <Link to="/login">로그인</Link></p>}
        <PolicyFooter newTab />
      </section>
      {editingPhoto && <ImageEditorModal source={editingPhoto} square onClose={() => setEditingPhoto(null)} onApply={file => {
        setPhotoFile(file)
        setEditingPhoto(null)
        setError('')
      }} />}
    </main>
  )
}
