import { getBirthDateError, koreaToday, type SignupRequirements } from '../../lib/signupRequirements'

export function SignupRequirementsFields({ value, onChange }: {
  value: SignupRequirements
  onChange: (value: SignupRequirements) => void
}) {
  const birthError = value.birthDate ? getBirthDateError(value.birthDate) : ''
  return <>
    <label className="field" htmlFor="signup-birth-date">
      <span>생년월일 <small>필수</small></span>
      <input id="signup-birth-date" type="date" required autoComplete="bday"
        min="1900-01-01" max={koreaToday()} value={value.birthDate}
        aria-invalid={Boolean(birthError)} aria-describedby="signup-birth-hint signup-birth-error"
        onChange={event => onChange({ ...value, birthDate: event.target.value })} />
      <small className="field-hint" id="signup-birth-hint">만 14세 미만은 가입할 수 없습니다. 생년월일은 공개되지 않습니다.</small>
      <small className="field-error" id="signup-birth-error" aria-live="polite">{birthError}</small>
    </label>
    <fieldset className="signup-consents">
      <legend>약관 및 개인정보 동의</legend>
      <div className="signup-consent-row">
        <label><input type="checkbox" required checked={value.termsAccepted}
          onChange={event => onChange({ ...value, termsAccepted: event.target.checked })} />
          <span>[필수] 이용약관 동의</span></label>
        <a href="/policies/terms" target="_blank" rel="noopener noreferrer" aria-label="이용약관 보기 (새 탭)">보기</a>
      </div>
      <div className="signup-consent-row">
        <label><input type="checkbox" required checked={value.privacyAccepted}
          onChange={event => onChange({ ...value, privacyAccepted: event.target.checked })} />
          <span>[필수] 개인정보 처리 관련 동의</span></label>
        <a href="/policies/privacy#signup-consent" target="_blank" rel="noopener noreferrer" aria-label="개인정보 처리 관련 동의 보기 (새 탭)">보기</a>
      </div>
      <p className="field-hint">이메일·회원 식별자·사용자 이름·닉네임·생년월일·동의 내역을 회원 식별, 로그인, 프로필 제공, 가입 연령 및 동의 확인을 위해 회원 탈퇴 시까지 보관합니다. 필수 동의를 거부하면 가입할 수 없습니다.</p>
      <div className="signup-consent-row">
        <label><input type="checkbox" checked={value.locationAccepted}
          onChange={event => onChange({ ...value, locationAccepted: event.target.checked })} />
          <span>[선택/기능 이용 시] 위치기반서비스 이용약관 동의</span></label>
        <a href="/policies/location" target="_blank" rel="noopener noreferrer" aria-label="위치기반서비스 이용약관 보기 (새 탭)">보기</a>
      </div>
      <p className="field-hint">선택 동의 없이 가입할 수 있습니다. 현재 위치·장소 기록 기능을 이용할 때 다시 동의할 수 있으며, 기기의 위치 권한은 별도로 요청합니다.</p>
      <p className="field-hint">회원정보는 Firebase 미국 서버로 전송·보관됩니다. <a href="/policies/privacy#international" target="_blank" rel="noopener noreferrer">국외이전 안내</a></p>
    </fieldset>
  </>
}
