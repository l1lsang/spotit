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
