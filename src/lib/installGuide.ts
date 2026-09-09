export const INSTALL_GUIDE_SEEN_KEY = 'spotit-install-guide-seen-v1'
const LEGACY_DISMISSED_KEY = 'spotit-install-prompt-dismissed-at'

export function createInstallGuidePreference(getStorage: () => Pick<Storage, 'getItem' | 'setItem'>) {
  let seenInSession = false
  return {
    hasSeen() {
      if (seenInSession) return true
      try {
        const storage = getStorage()
        seenInSession = storage.getItem(INSTALL_GUIDE_SEEN_KEY) === '1'
          || Number(storage.getItem(LEGACY_DISMISSED_KEY)) > 0
      } catch { /* Storage may be blocked; the notice still works in memory. */ }
      return seenInSession
    },
    remember() {
      seenInSession = true
      try { getStorage().setItem(INSTALL_GUIDE_SEEN_KEY, '1') } catch { /* Keep the session preference. */ }
    },
  }
}

export type InstallPlatform = 'ios' | 'android' | 'mac-safari' | 'desktop'

export function getInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  if (/Macintosh/i.test(userAgent) && /Safari/i.test(userAgent) && !/Chrome|Chromium|Edg|OPR/i.test(userAgent)) return 'mac-safari'
  return 'desktop'
}

export const INSTALL_GUIDE_STEPS: Record<InstallPlatform, string[]> = {
  ios: ['Safari에서 스팟잇을 열어 주세요.', '공유 버튼을 누르고 “홈 화면에 추가”를 선택하세요.', '“웹 앱으로 열기”가 보이면 켠 뒤 “추가”를 누르세요.'],
  android: ['Chrome에서 스팟잇을 열어 주세요.', '주소창 옆 ⋮ 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택하세요.', '설치를 확인하면 홈 화면에서 스팟잇을 열 수 있어요.'],
  'mac-safari': ['Safari의 공유 버튼을 누르세요.', '“Dock에 추가”를 선택하고 “추가”를 누르세요.'],
  desktop: ['Chrome 또는 Edge에서 스팟잇을 열어 주세요.', '주소창의 설치 아이콘이나 브라우저 메뉴의 앱 설치 항목을 선택하세요.', '설치를 확인하면 별도의 앱 창으로 사용할 수 있어요.'],
}
