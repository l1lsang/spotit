import { useCallback, useState } from 'react'
import type { LatLng } from '../lib/kakaoMap'

export const SEOUL_CITY_HALL: LatLng = {
  lat: 37.566535,
  lng: 126.9779692,
}

export function useCurrentLocation() {
  const [location, setLocation] = useState<LatLng>(SEOUL_CITY_HALL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const requestLocation = useCallback(async (): Promise<LatLng> => {
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
  }, [])

  return {
    location,
    loading,
    error,
    requestLocation,
  }
}
