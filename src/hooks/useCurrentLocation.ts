import { useCallback, useState } from 'react'
import type { LatLng } from '../lib/kakaoMap'
import { useLocationConsent } from '../contexts/locationConsentCore'
import { auth } from '../lib/firebase'

export const SEOUL_CITY_HALL: LatLng = {
  lat: 37.566535,
  lng: 126.9779692,
}

export function useCurrentLocation() {
  const ensureLocationConsent = useLocationConsent()
  const [location, setLocation] = useState<LatLng>(SEOUL_CITY_HALL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const requestLocation = useCallback(async (promptForConsent = true): Promise<LatLng> => {
    const requestUid = auth?.currentUser?.uid
    try {
      if (!await ensureLocationConsent(promptForConsent)) {
        setError(promptForConsent ? '현재 위치는 로그인 후 위치기반서비스 이용약관에 동의하면 사용할 수 있습니다.' : '')
        setLocation(SEOUL_CITY_HALL)
        return SEOUL_CITY_HALL
      }
    } catch {
      setError('위치 동의 내역을 확인하지 못했습니다. 다시 시도해 주세요.')
      return SEOUL_CITY_HALL
    }
    if (!navigator.geolocation) {
      setError('브라우저에서 현재 위치를 지원하지 않아 서울 시청 근처로 표시합니다.')
      setLocation(SEOUL_CITY_HALL)
      return SEOUL_CITY_HALL
    }

    setLoading(true)
    setError('')

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (auth?.currentUser?.uid !== requestUid) {
            setLoading(false)
            resolve(SEOUL_CITY_HALL)
            return
          }
          const nextLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          setLocation(nextLocation)
          setLoading(false)
          resolve(nextLocation)
        },
        () => {
          setError('위치 권한이 거부되어 서울 시청 근처로 표시합니다.')
          setLocation(SEOUL_CITY_HALL)
          setLoading(false)
          resolve(SEOUL_CITY_HALL)
        },
        { enableHighAccuracy: true, timeout: 8_000 },
      )
    })
  }, [ensureLocationConsent])

  return {
    location,
    loading,
    error,
    requestLocation,
  }
}
