import type {
  KakaoMapInstance,
  KakaoMapsNamespace,
  KakaoMarkerInstance,
} from '../../lib/kakaoMap'
import { getProjectPinColorValue, type ProjectPinMapMarker } from '../../types/mapFeature'

export function createProjectPinMarker(
  kakao: KakaoMapsNamespace,
  map: KakaoMapInstance,
  pin: ProjectPinMapMarker,
  onClick: () => void,
): KakaoMarkerInstance {
  const markerElement = document.createElement('button')
  markerElement.type = 'button'
  markerElement.className = 'daymark-map-pin project'
  markerElement.style.setProperty('--project-pin-color', getProjectPinColorValue(pin.pinColor))
  markerElement.setAttribute('aria-label', `${pin.placeName} 프로젝트 핀 보기`)
  markerElement.innerHTML = '<span></span>'
  markerElement.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })

  const marker = new kakao.CustomOverlay({
    position: new kakao.LatLng(pin.lat, pin.lng),
    content: markerElement,
    xAnchor: 0.5,
    yAnchor: 1,
  })

  marker.setMap(map)

  return marker
}
