import { isGoogleMapConfigured, searchGooglePlacesByKeyword } from './googleMap'
import { searchKakaoPlacesByKeyword } from './kakaoMap'
import type { LatLng, MapProvider, PlaceSearchResult } from './mapLocation'
import { createReadCache } from './readCache'

const placeCache = createReadCache(64)

export async function searchPlaces(keyword: string, center: LatLng, provider: MapProvider): Promise<PlaceSearchResult[]> {
  const trimmed = keyword.trim()
  if (!trimmed) return []
  return placeCache.read(JSON.stringify([provider, trimmed, center.lat, center.lng]),
    () => loadPlaces(trimmed, center, provider), 5 * 60_000)
}

async function loadPlaces(keyword: string, center: LatLng, provider: MapProvider): Promise<PlaceSearchResult[]> {
  if (provider === 'google') return searchGooglePlacesByKeyword(keyword, center)
  const results = await searchKakaoPlacesByKeyword(keyword, center)
  // A user in Korea can also find an overseas destination.
  if (!results.length && isGoogleMapConfigured) return searchGooglePlacesByKeyword(keyword, center)
  return results.map((place) => ({
    id: place.id || `${place.place_name}-${place.x}-${place.y}`,
    name: place.place_name,
    address: place.road_address_name || place.address_name,
    location: { lat: Number(place.y), lng: Number(place.x) },
    provider: 'kakao',
    distanceMeters: place.distance ? Number(place.distance) : undefined,
  }))
}
