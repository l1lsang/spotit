import type {
  KakaoMapInstance,
  KakaoMapsNamespace,
  KakaoMarkerInstance,
} from '../../lib/kakaoMap'
import type { Post } from '../../types/post'

export function createPostMarker(
  kakao: KakaoMapsNamespace,
  map: KakaoMapInstance,
  post: Post,
  currentUserUid: string | undefined,
  onClick: () => void,
): KakaoMarkerInstance {
  const isMine = Boolean(currentUserUid && post.uid === currentUserUid)
  const markerElement = document.createElement('button')
  markerElement.type = 'button'
  markerElement.className = `daymark-map-pin ${isMine ? 'mine' : 'other'}`
  markerElement.setAttribute('aria-label', `${post.title} 핀 보기`)
  markerElement.innerHTML = `<span></span>`
  markerElement.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })

  const marker = new kakao.CustomOverlay({
    position: new kakao.LatLng(post.lat, post.lng),
    content: markerElement,
    xAnchor: 0.5,
    yAnchor: 1,
  })

  marker.setMap(map)

  return marker
}
