export interface LatLng {
  lat: number
  lng: number
}

export interface PlaceSearchResult {
  id: string
  name: string
  address: string
  location: LatLng
}

export function isValidLocation(location: LatLng): boolean {
  return Number.isFinite(location.lat) && Number.isFinite(location.lng) &&
    Math.abs(location.lat) <= 90 && Math.abs(location.lng) <= 180
}

export function getExternalMapUrl(location: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`
}
