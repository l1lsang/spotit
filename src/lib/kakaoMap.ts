export interface LatLng {
  lat: number
  lng: number
}

export interface KakaoLatLngInstance {
  getLat: () => number
  getLng: () => number
}

export interface KakaoMapMouseEvent {
  latLng: KakaoLatLngInstance
}

export type KakaoEventHandler = (event?: KakaoMapMouseEvent) => void

export interface KakaoMapInstance {
  setCenter: (latLng: KakaoLatLngInstance) => void
}

export interface KakaoMarkerInstance {
  setMap: (map: KakaoMapInstance | null) => void
}

export interface KakaoPlaceSearchResult {
  id: string
  place_name: string
  category_name?: string
  phone?: string
  address_name: string
  road_address_name?: string
  x: string
  y: string
  place_url?: string
  distance?: string
}

interface KakaoKeywordSearchOptions {
  location?: KakaoLatLngInstance
  sort?: string
  size?: number
}

interface KakaoPlacesInstance {
  keywordSearch: (
    keyword: string,
    callback: (results: KakaoPlaceSearchResult[], status: string) => void,
    options?: KakaoKeywordSearchOptions,
  ) => void
}

export interface KakaoMapsNamespace {
  LatLng: new (lat: number, lng: number) => KakaoLatLngInstance
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLngInstance; level: number },
  ) => KakaoMapInstance
  Marker: new (options: { position: KakaoLatLngInstance }) => KakaoMarkerInstance
  CustomOverlay: new (options: {
    position: KakaoLatLngInstance
    content: HTMLElement | string
    xAnchor?: number
    yAnchor?: number
  }) => KakaoMarkerInstance
  event: {
    addListener: (
      target: KakaoMapInstance | KakaoMarkerInstance,
      type: string,
      handler: KakaoEventHandler,
    ) => void
    removeListener: (
      target: KakaoMapInstance | KakaoMarkerInstance,
      type: string,
      handler: KakaoEventHandler,
    ) => void
  }
  services: {
    Places: new () => KakaoPlacesInstance
    Status: {
      OK: string
      ZERO_RESULT: string
      ERROR: string
    }
    SortBy: {
      ACCURACY: string
      DISTANCE: string
    }
  }
  load: (callback: () => void) => void
}

interface KakaoGlobal {
  maps: KakaoMapsNamespace
}

declare global {
  interface Window {
    kakao?: KakaoGlobal
    __daymarkKakaoMapPromise?: Promise<void>
  }
}

const kakaoMapKey = import.meta.env.VITE_KAKAO_MAP_JS_KEY

export const isKakaoMapConfigured = Boolean(kakaoMapKey)
export const kakaoMapConfigMessage =
  'Kakao Map JavaScript 키가 없습니다. .env에 VITE_KAKAO_MAP_JS_KEY를 설정해 주세요.'

export function loadKakaoMapSdk(): Promise<void> {
  if (!isKakaoMapConfigured) {
    return Promise.reject(new Error(kakaoMapConfigMessage))
  }

  if (window.kakao?.maps) {
    return new Promise((resolve) => window.kakao?.maps.load(resolve))
  }

  if (window.__daymarkKakaoMapPromise) {
    return window.__daymarkKakaoMapPromise
  }

  window.__daymarkKakaoMapPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('#kakao-map-sdk')

    if (existingScript) {
      existingScript.addEventListener('load', () => window.kakao?.maps.load(resolve))
      existingScript.addEventListener('error', () => reject(new Error('Kakao Map SDK 로드 실패')))
      return
    }

    const script = document.createElement('script')
    script.id = 'kakao-map-sdk'
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoMapKey}&autoload=false&libraries=services`
    script.onload = () => window.kakao?.maps.load(resolve)
    script.onerror = () => reject(new Error('Kakao Map SDK 로드 실패'))
    document.head.appendChild(script)
  })

  return window.__daymarkKakaoMapPromise
}

export function getKakaoMaps(): KakaoMapsNamespace {
  if (!window.kakao?.maps) {
    throw new Error('Kakao Map SDK가 아직 로드되지 않았습니다.')
  }

  return window.kakao.maps
}

export async function searchKakaoPlacesByKeyword(
  keyword: string,
  center: LatLng,
): Promise<KakaoPlaceSearchResult[]> {
  const trimmed = keyword.trim()

  if (!trimmed) {
    return []
  }

  await loadKakaoMapSdk()

  return new Promise((resolve, reject) => {
    const kakao = getKakaoMaps()
    const places = new kakao.services.Places()

    places.keywordSearch(
      trimmed,
      (results, status) => {
        if (status === kakao.services.Status.OK) {
          resolve(results)
          return
        }

        if (status === kakao.services.Status.ZERO_RESULT) {
          resolve([])
          return
        }

        reject(new Error('장소 검색에 실패했습니다.'))
      },
      {
        location: new kakao.LatLng(center.lat, center.lng),
        sort: kakao.services.SortBy.DISTANCE,
        size: 10,
      },
    )
  })
}
