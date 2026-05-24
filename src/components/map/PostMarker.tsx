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
  onClick: () => void,
): KakaoMarkerInstance {
  const marker = new kakao.Marker({
    position: new kakao.LatLng(post.lat, post.lng),
  })

  marker.setMap(map)
  kakao.event.addListener(marker, 'click', onClick)

  return marker
}
