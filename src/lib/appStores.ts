export const ANDROID_PACKAGE = 'kr.spotitmap.app'

export interface AppStoreLink {
  platform: 'android' | 'ios'
  name: string
  url?: string
}

export const appStores: AppStoreLink[] = [
  { platform: 'android', name: 'Google Play', url: import.meta.env.VITE_ANDROID_APP_URL?.trim() || `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}` },
  { platform: 'ios', name: 'App Store', url: import.meta.env.VITE_IOS_APP_URL?.trim() || 'https://apps.apple.com/app/id6811809433' },
]

export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent)
}

/** Chrome on Android opens the installed app for this https link, or the Play Store listing when it is missing. */
export function androidIntentUrl(pathWithSearch: string): string {
  return `intent://${window.location.host}${pathWithSearch}#Intent;scheme=https;package=${ANDROID_PACKAGE};end`
}
