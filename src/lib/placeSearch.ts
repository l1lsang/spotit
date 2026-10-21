import { searchGooglePlacesByKeyword, searchGooglePlacesNearby } from './googleMap'
import type { LatLng, PlaceSearchResult } from './mapLocation'
import { getDistanceMeters } from './photoMetadata'
import { createReadCache } from './readCache'

const placeCache = createReadCache(64)
export const NEARBY_PLACE_RADIUS_METERS = 200

export async function searchPlaces(keyword: string, center: LatLng): Promise<PlaceSearchResult[]> {
  const trimmed = keyword.trim()
  if (!trimmed) return []
  return placeCache.read(JSON.stringify([trimmed, center.lat, center.lng]),
    () => searchGooglePlacesByKeyword(trimmed, center), 5 * 60_000)
}

// Suggests names for a photo's position, nearest first.
export async function findNearbyPlaces(location: LatLng): Promise<PlaceSearchResult[]> {
  const places = await placeCache.read(JSON.stringify(['nearby', location.lat.toFixed(5), location.lng.toFixed(5)]),
    () => searchGooglePlacesNearby(location, NEARBY_PLACE_RADIUS_METERS), 5 * 60_000)
  return places
    .map((place) => ({ ...place, address: place.address.replace(/^대한민국\s*/, '') }))
    .sort((a, b) => getDistanceMeters(location, a.location) - getDistanceMeters(location, b.location))
}
