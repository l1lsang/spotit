import { useCallback, useEffect, useRef, useState } from 'react'
import { getEditableImageError } from '../lib/imageEditing'
import type { LatLng, PlaceSearchResult } from '../lib/mapLocation'
import {
  getDistanceMeters,
  readPhotoMetadata,
  summarizePhotoMetadata,
  type PhotoMetadata,
  type PhotoSelectionSummary,
  type PhotoTakenAt,
} from '../lib/photoMetadata'
import { findNearbyPlaces } from '../lib/placeSearch'

export const PHOTO_RECORD_MAX_FILES = 10
// Reading takes milliseconds; a short floor keeps the progress sheet from flashing.
const MIN_READING_MS = 450

export interface PhotoRecordItem {
  id: string
  file: File
  url: string
  metadata: PhotoMetadata | null
}

export type PhotoRecordStep = 'reading' | 'confirm' | 'locate'
export type PhotoLocateReason = 'missing' | 'adjust'

export interface PhotoRecordFlowState {
  step: PhotoRecordStep
  // The representative photo (the one that places the pin) comes first once reading ends.
  items: PhotoRecordItem[]
  summary: PhotoSelectionSummary | null
  locateReason: PhotoLocateReason
  searchedPlace: PlaceSearchResult | null
}

export interface PhotoRecordPrefill {
  files: File[]
  filesWithoutLocation: File[]
  location: LatLng
  source: 'photo' | 'manual'
  takenAt: PhotoTakenAt | null
  place: PlaceSearchResult | null
}

export function usePhotoRecordFlow(focusMap: (location: LatLng) => void) {
  const [flow, setFlow] = useState<PhotoRecordFlowState | null>(null)
  const [error, setError] = useState('')
  const runRef = useRef(0)
  const urlsRef = useRef<string[]>([])

  const releaseUrls = useCallback(() => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    urlsRef.current = []
  }, [])

  useEffect(() => releaseUrls, [releaseUrls])

  const close = useCallback(() => {
    runRef.current += 1
    releaseUrls()
    setFlow(null)
    setError('')
  }, [releaseUrls])

  const start = useCallback(async (selected: File[]) => {
    const invalid = selected.find((file) => getEditableImageError(file))
    const valid = selected.filter((file) => !getEditableImageError(file)).slice(0, PHOTO_RECORD_MAX_FILES)
    setError(invalid
      ? `${invalid.name}: ${getEditableImageError(invalid)}`
      : selected.length > PHOTO_RECORD_MAX_FILES ? `사진은 한 번에 ${PHOTO_RECORD_MAX_FILES}장까지 올릴 수 있어요.` : '')
    if (!valid.length) return

    const run = ++runRef.current
    releaseUrls()
    const items: PhotoRecordItem[] = valid.map((file, index) => ({
      id: `${index}-${file.name}-${file.lastModified}`,
      file,
      url: URL.createObjectURL(file),
      metadata: null,
    }))
    urlsRef.current = items.map((item) => item.url)
    setFlow({ step: 'reading', items, summary: null, locateReason: 'missing', searchedPlace: null })

    const startedAt = Date.now()
    const metadata = await Promise.all(items.map(async (item) => {
      const result = await readPhotoMetadata(item.file)
      if (run === runRef.current) {
        setFlow((previous) => previous && {
          ...previous,
          items: previous.items.map((entry) => entry.id === item.id ? { ...entry, metadata: result } : entry),
        })
      }
      return result
    }))
    await new Promise((resolve) => window.setTimeout(resolve, Math.max(0, MIN_READING_MS - (Date.now() - startedAt))))
    if (run !== runRef.current) return

    const summary = summarizePhotoMetadata(metadata)
    const read = items.map((item, index) => ({ ...item, metadata: metadata[index] }))
    const ordered = summary.locationIndex > 0
      ? [read[summary.locationIndex], ...read.filter((_, index) => index !== summary.locationIndex)]
      : read
    setFlow({ step: summary.location ? 'confirm' : 'locate', items: ordered, summary, locateReason: 'missing', searchedPlace: null })
    if (summary.location) focusMap(summary.location)
  }, [focusMap, releaseUrls])

  const locate = useCallback((reason: PhotoLocateReason) => {
    setFlow((previous) => previous && { ...previous, step: 'locate', locateReason: reason })
  }, [])

  const returnToPhotoLocation = useCallback(() => {
    const location = flow?.summary?.location
    if (!location) return
    focusMap(location)
    setFlow((previous) => previous && { ...previous, step: 'confirm', searchedPlace: null })
  }, [flow?.summary?.location, focusMap])

  const selectSearchedPlace = useCallback((place: PlaceSearchResult) => {
    focusMap(place.location)
    setFlow((previous) => previous && { ...previous, searchedPlace: place })
  }, [focusMap])

  const buildPrefill = useCallback((location: LatLng, source: PhotoRecordPrefill['source']): PhotoRecordPrefill | null => {
    if (!flow) return null
    // A searched place names the pin only while the pin still sits on it.
    const place = flow.searchedPlace && getDistanceMeters(flow.searchedPlace.location, location) <= 100 ? flow.searchedPlace : null
    return {
      files: flow.items.map((item) => item.file),
      filesWithoutLocation: flow.items.filter((item) => !item.metadata?.location).map((item) => item.file),
      location,
      source,
      takenAt: flow.summary?.takenAt ?? null,
      place,
    }
  }, [flow])

  return { flow, error, setError, start, close, locate, returnToPhotoLocation, selectSearchedPlace, buildPrefill }
}

export function useNearbyPlaces(location: LatLng | null) {
  const lat = location?.lat
  const lng = location?.lng
  const key = lat === undefined || lng === undefined ? '' : `${lat},${lng}`
  const [result, setResult] = useState<{ key: string; places: PlaceSearchResult[] } | null>(null)

  useEffect(() => {
    if (lat === undefined || lng === undefined) return
    let active = true
    findNearbyPlaces({ lat, lng }).then(
      (places) => { if (active) setResult({ key: `${lat},${lng}`, places }) },
      // Suggestions are optional; the user can always type the place name.
      () => { if (active) setResult({ key: `${lat},${lng}`, places: [] }) },
    )
    return () => { active = false }
  }, [lat, lng])

  const ready = Boolean(key) && result?.key === key
  return { loading: Boolean(key) && !ready, places: ready && result ? result.places : [] }
}
