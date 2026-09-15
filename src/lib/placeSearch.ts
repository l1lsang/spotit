import { searchGooglePlacesByKeyword } from './googleMap'
import type { LatLng, PlaceSearchResult } from './mapLocation'
import { createReadCache } from './readCache'

const placeCache = createReadCache(64)

export async function searchPlaces(keyword: string, center: LatLng): Promise<PlaceSearchResult[]> {
  const trimmed = keyword.trim()
  if (!trimmed) return []
  return placeCache.read(JSON.stringify([trimmed, center.lat, center.lng]),
    () => searchGooglePlacesByKeyword(trimmed, center), 5 * 60_000)
}
