import { isGoogleMapConfigured, searchGooglePlacesByKeyword } from './googleMap'
import { searchKakaoPlacesByKeyword } from './kakaoMap'
import type { LatLng, MapProvider, PlaceSearchResult } from './mapLocation'

export async function searchPlaces(keyword: string, center: LatLng, provider: MapProvider): Promise<PlaceSearchResult[]> {
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
