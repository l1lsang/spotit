import { firebaseConfigMessage } from '../../lib/firebase'

export function FirebaseNotice() {
  if (!firebaseConfigMessage) {
    return null
  }

  return (
    <div className="notice" role="status">
      Firebase 연결 정보가 비어 있습니다. <code>.env</code> 파일을 만들고 설정을 채우면
      로그인과 기록 저장을 사용할 수 있습니다.
    </div>
  )
}
