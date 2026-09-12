import { getGoogleMaps, googleMapId, loadGoogleMapSdk } from './googleMap'
import { getKakaoMaps, loadKakaoMapSdk, type KakaoEventHandler } from './kakaoMap'
import type { MapPoint } from './mapClusters'
import type { LatLng, MapProvider } from './mapLocation'

export interface MapDriver {
  setCenter: (location: LatLng) => void
  project: (location: LatLng) => MapPoint | null
  addMarker: (location: LatLng, content: HTMLElement, selected?: boolean) => () => void
  onIdle: (handler: () => void) => () => void
  preventMapClick: () => void
  resize: () => void
  destroy: () => void
}

export async function prepareMapSdk(provider: MapProvider): Promise<void> {
  if (provider === 'kakao') return loadKakaoMapSdk()
  await loadGoogleMapSdk()
  const google = getGoogleMaps()
  await Promise.all([google.importLibrary('maps'), google.importLibrary('marker')])
}

// Creation is synchronous after loading, so an unmounted view never creates a map.
export function createMapDriver(
  provider: MapProvider,
  container: HTMLElement,
  center: LatLng,
  onClick: (location: LatLng) => void,
): MapDriver {
  if (provider === 'kakao') {
    const kakao = getKakaoMaps()
    const toLatLng = (location: LatLng) => new kakao.LatLng(location.lat, location.lng)
    const map = new kakao.Map(container, { center: toLatLng(center), level: 4 })
    const click: KakaoEventHandler = (event) => {
      if (event?.latLng) onClick({ lat: event.latLng.getLat(), lng: event.latLng.getLng() })
    }
    kakao.event.addListener(map, 'click', click)
    return {
      setCenter: (location) => map.setCenter(toLatLng(location)),
      project: (location) => map.getProjection().pointFromCoords(toLatLng(location)),
      addMarker: (location, content, selected) => {
        const overlay = new kakao.CustomOverlay({
          position: toLatLng(location), content, xAnchor: 0.5, yAnchor: 1,
          clickable: true, zIndex: selected ? 10 : 1,
        })
        overlay.setMap(map)
        return () => overlay.setMap(null)
      },
      onIdle: (handler) => {
        kakao.event.addListener(map, 'idle', handler)
        return () => kakao.event.removeListener(map, 'idle', handler)
      },
      preventMapClick: () => kakao.event.preventMap(),
      resize: () => map.relayout(),
      destroy: () => {
        kakao.event.removeListener(map, 'click', click)
        container.replaceChildren()
      },
    }
  }

  const google = getGoogleMaps()
  const map = new google.Map(container, {
    center, zoom: 15, mapId: googleMapId, mapTypeControl: false, streetViewControl: false,
    disableDefaultUI: true,
    tilt: 0, heading: 0,
    gestureHandling: 'greedy',
  })
  const listener = map.addListener('click', (event) => {
    event?.stop?.() // Selecting a place creates our pin instead of a competing POI popup.
    if (event?.latLng) onClick({ lat: event.latLng.lat(), lng: event.latLng.lng() })
  })
  return {
    setCenter: (location) => map.setCenter(location),
    project: (location) => {
      const projection = map.getProjection()
      const point = projection?.fromLatLngToPoint(new google.LatLng(location.lat, location.lng))
      const origin = map.getCenter()
      const originPoint = origin && projection?.fromLatLngToPoint(origin)
      if (!point || !originPoint) return null
      // Wrap around the date line so adjacent pins at ±180° still group.
      const dx = ((point.x - originPoint.x + 384) % 256) - 128
      const scale = 2 ** (map.getZoom() ?? 15)
      return { x: dx * scale, y: (point.y - originPoint.y) * scale }
    },
    addMarker: (location, content, selected) => {
      const marker = new google.marker.AdvancedMarkerElement({
        map, position: location, title: content.getAttribute('aria-label') || '', zIndex: selected ? 10 : 1,
      })
      marker.append(content)
      return () => { marker.map = null }
    },
    onIdle: (handler) => {
      const idleListener = map.addListener('idle', handler)
      return () => idleListener.remove()
    },
    preventMapClick: () => undefined,
    resize: () => undefined,
    destroy: () => {
      listener.remove()
      google.event.clearInstanceListeners(map)
      container.replaceChildren()
    },
  }
}
