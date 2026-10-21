import type { LatLng } from './mapLocation'

export interface PhotoTakenAt {
  dateKey: string
  time: string
  // Milliseconds used only to find the earliest photo in a selection.
  sortValue: number
}

export interface PhotoMetadata {
  location: LatLng | null
  takenAt: PhotoTakenAt | null
}

export interface PhotoSelectionSummary {
  location: LatLng | null
  locationIndex: number
  takenAt: PhotoTakenAt | null
  missingLocationCount: number
  distantPhotoCount: number
}

export const EMPTY_PHOTO_METADATA: PhotoMetadata = { location: null, takenAt: null }
// Photos farther apart than this are probably from different places.
export const PHOTO_SAME_PLACE_METERS = 300

const TAG_EXIF_IFD = 0x8769
const TAG_GPS_IFD = 0x8825
const TAG_DATE_TIME = 0x0132
const TAG_DATE_TIME_ORIGINAL = 0x9003
const TAG_DATE_TIME_DIGITIZED = 0x9004
const TAG_OFFSET_TIME_ORIGINAL = 0x9011
const TAG_GPS_LATITUDE_REF = 0x0001
const TAG_GPS_LATITUDE = 0x0002
const TAG_GPS_LONGITUDE_REF = 0x0003
const TAG_GPS_LONGITUDE = 0x0004
const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

interface TiffReader {
  view: DataView
  little: boolean
}

interface IfdEntry {
  type: number
  count: number
  valueOffset: number
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  let text = ''
  for (let index = start; index < start + length && index < bytes.length; index += 1) {
    if (bytes[index] === 0) break
    text += String.fromCharCode(bytes[index])
  }
  return text
}

function readIfd(reader: TiffReader, offset: number): Map<number, IfdEntry> {
  const entries = new Map<number, IfdEntry>()
  const { view, little } = reader
  if (offset < 8 || offset + 2 > view.byteLength) return entries
  const count = view.getUint16(offset, little)
  for (let index = 0; index < count; index += 1) {
    const entry = offset + 2 + index * 12
    if (entry + 12 > view.byteLength) break
    const type = view.getUint16(entry + 2, little)
    const valueCount = view.getUint32(entry + 4, little)
    const size = (TYPE_SIZES[type] || 0) * valueCount
    if (!size) continue
    const valueOffset = size <= 4 ? entry + 8 : view.getUint32(entry + 8, little)
    if (valueOffset + size > view.byteLength) continue
    entries.set(view.getUint16(entry, little), { type, count: valueCount, valueOffset })
  }
  return entries
}

function readEntryText(reader: TiffReader, entry?: IfdEntry): string {
  if (!entry || entry.type !== 2) return ''
  return readAscii(new Uint8Array(reader.view.buffer, reader.view.byteOffset, reader.view.byteLength), entry.valueOffset, entry.count).trim()
}

function readEntryLong(reader: TiffReader, entry?: IfdEntry): number {
  if (!entry || entry.count !== 1) return 0
  if (entry.type === 4) return reader.view.getUint32(entry.valueOffset, reader.little)
  if (entry.type === 3) return reader.view.getUint16(entry.valueOffset, reader.little)
  return 0
}

function readCoordinate(reader: TiffReader, entry: IfdEntry | undefined, ref: string): number | null {
  if (!entry || entry.type !== 5 || entry.count < 3) return null
  const [degrees, minutes, seconds] = [0, 1, 2].map((index) => {
    const position = entry.valueOffset + index * 8
    const denominator = reader.view.getUint32(position + 4, reader.little)
    return denominator ? reader.view.getUint32(position, reader.little) / denominator : Number.NaN
  })
  const value = degrees + minutes / 60 + seconds / 3600
  if (!Number.isFinite(value)) return null
  return ref === 'S' || ref === 'W' ? -value : value
}

export function parseExifDateTime(value: string, offset = ''): PhotoTakenAt | null {
  const match = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0))
  const local = new Date(year, month - 1, day, hour, minute, second)
  // Reject impossible values such as 2026:02:31 or the all-zero placeholder.
  if (year < 1900 || local.getMonth() !== month - 1 || local.getDate() !== day || hour > 23 || minute > 59) return null
  const offsetMatch = /^([+-])(\d{2}):(\d{2})$/.exec(offset.trim())
  const sortValue = offsetMatch
    ? Date.UTC(year, month - 1, day, hour, minute, second) - (offsetMatch[1] === '-' ? -1 : 1) * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3])) * 60_000
    : local.getTime()
  const pad = (number: number) => String(number).padStart(2, '0')
  return { dateKey: `${year}-${pad(month)}-${pad(day)}`, time: `${pad(hour)}:${pad(minute)}`, sortValue }
}

export function parseTiffMetadata(bytes: Uint8Array): PhotoMetadata {
  if (bytes.length < 8) return EMPTY_PHOTO_METADATA
  const order = readAscii(bytes, 0, 2)
  if (order !== 'II' && order !== 'MM') return EMPTY_PHOTO_METADATA
  const reader: TiffReader = { view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), little: order === 'II' }
  if (reader.view.getUint16(2, reader.little) !== 42) return EMPTY_PHOTO_METADATA
  const ifd0 = readIfd(reader, reader.view.getUint32(4, reader.little))
  const exif = readIfd(reader, readEntryLong(reader, ifd0.get(TAG_EXIF_IFD)))
  const gps = readIfd(reader, readEntryLong(reader, ifd0.get(TAG_GPS_IFD)))

  const lat = readCoordinate(reader, gps.get(TAG_GPS_LATITUDE), readEntryText(reader, gps.get(TAG_GPS_LATITUDE_REF)))
  const lng = readCoordinate(reader, gps.get(TAG_GPS_LONGITUDE), readEntryText(reader, gps.get(TAG_GPS_LONGITUDE_REF)))
  // Some devices write 0,0 when they had no GPS fix.
  const location = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)
    ? { lat, lng }
    : null

  const offset = readEntryText(reader, exif.get(TAG_OFFSET_TIME_ORIGINAL))
  const takenAt = parseExifDateTime(readEntryText(reader, exif.get(TAG_DATE_TIME_ORIGINAL)), offset)
    || parseExifDateTime(readEntryText(reader, exif.get(TAG_DATE_TIME_DIGITIZED)), offset)
    || parseExifDateTime(readEntryText(reader, ifd0.get(TAG_DATE_TIME)))
  return { location, takenAt }
}

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0]

function startsWith(bytes: Uint8Array, offset: number, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[offset + index] === value)
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function isPng(bytes: Uint8Array): boolean {
  return startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
}

function isWebp(bytes: Uint8Array): boolean {
  return readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 4) === 'WEBP'
}

// Returns the TIFF block that holds EXIF data in JPEG, PNG or WebP files.
export function findExifTiff(bytes: Uint8Array): Uint8Array | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
      const marker = bytes[offset + 1]
      if (marker === 0xff) { offset += 1; continue }
      if (marker === 0xda || marker === 0xd9) break
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
      if (length < 2) break
      if (marker === 0xe1 && startsWith(bytes, offset + 4, EXIF_HEADER)) {
        return bytes.subarray(offset + 10, Math.min(bytes.length, offset + 2 + length))
      }
      offset += 2 + length
    }
    return null
  }
  if (isPng(bytes)) {
    let offset = 8
    while (offset + 8 <= bytes.length) {
      const length = readUint32BE(bytes, offset)
      const type = readAscii(bytes, offset + 4, 4)
      if (type === 'eXIf') return bytes.subarray(offset + 8, Math.min(bytes.length, offset + 8 + length))
      if (type === 'IDAT' || type === 'IEND') break
      offset += 12 + length
    }
    return null
  }
  if (isWebp(bytes)) {
    let offset = 12
    while (offset + 8 <= bytes.length) {
      const length = readUint32LE(bytes, offset + 4)
      if (readAscii(bytes, offset, 4) === 'EXIF') {
        const data = bytes.subarray(offset + 8, Math.min(bytes.length, offset + 8 + length))
        return startsWith(data, 0, EXIF_HEADER) ? data.subarray(6) : data
      }
      offset += 8 + length + (length % 2)
    }
  }
  return null
}

export function parsePhotoMetadata(bytes: Uint8Array): PhotoMetadata {
  const tiff = findExifTiff(bytes)
  return tiff ? parseTiffMetadata(tiff) : EMPTY_PHOTO_METADATA
}

export async function readPhotoMetadata(file: Blob): Promise<PhotoMetadata> {
  try {
    return parsePhotoMetadata(new Uint8Array(await file.arrayBuffer()))
  } catch {
    // Unreadable metadata never blocks a record; the user fills in the details.
    return EMPTY_PHOTO_METADATA
  }
}

export function hasPhotoMetadata(bytes: Uint8Array): boolean {
  return findExifTiff(bytes) !== null
}

const XMP_HEADER = [...'http://ns.adobe.com/xap/1.0/\0'].map((char) => char.charCodeAt(0))

function concatBytes(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

// XMP packets can repeat the GPS position, so they go along with it.
function withoutXmp(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const parts: Uint8Array[] = [bytes.subarray(0, 2)]
    let offset = 2
    while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
      const marker = bytes[offset + 1]
      if (marker === 0xff) { offset += 1; continue }
      if (marker === 0xda || marker === 0xd9) break
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
      if (length < 2) break
      if (marker !== 0xe1 || !startsWith(bytes, offset + 4, XMP_HEADER)) parts.push(bytes.subarray(offset, offset + 2 + length))
      offset += 2 + length
    }
    parts.push(bytes.subarray(offset))
    return concatBytes(parts)
  }
  if (isWebp(bytes)) {
    const parts: Uint8Array[] = [bytes.subarray(0, 12)]
    let offset = 12
    while (offset + 8 <= bytes.length) {
      const length = readUint32LE(bytes, offset + 4)
      const end = Math.min(bytes.length, offset + 8 + length + (length % 2))
      const type = readAscii(bytes, offset, 4)
      if (type !== 'XMP ') {
        const chunk = bytes.slice(offset, end)
        // VP8X announces an XMP chunk with flag 0x04.
        if (type === 'VP8X' && chunk.length > 8) chunk[8] &= ~0x04
        parts.push(chunk)
      }
      offset = end
    }
    const result = concatBytes(parts)
    new DataView(result.buffer).setUint32(4, result.length - 8, true)
    return result
  }
  return bytes.slice()
}

// Blanks the GPS block in place. Orientation and capture dates stay intact,
// so the photo still displays upright without re-encoding.
export function redactPhotoLocation(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = withoutXmp(bytes)
  const tiff = findExifTiff(copy)
  if (!tiff || tiff.length < 8) return copy
  const order = readAscii(tiff, 0, 2)
  if (order !== 'II' && order !== 'MM') return copy
  const reader: TiffReader = { view: new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength), little: order === 'II' }
  const gpsOffset = readEntryLong(reader, readIfd(reader, reader.view.getUint32(4, reader.little)).get(TAG_GPS_IFD))
  if (!gpsOffset || gpsOffset + 2 > tiff.length) return copy
  for (const entry of readIfd(reader, gpsOffset).values()) {
    tiff.fill(0, entry.valueOffset, entry.valueOffset + (TYPE_SIZES[entry.type] || 0) * entry.count)
  }
  const count = reader.view.getUint16(gpsOffset, reader.little)
  tiff.fill(0, gpsOffset, Math.min(tiff.length, gpsOffset + 2 + count * 12))
  return copy
}

export async function removePhotoLocation(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file
  try {
    const redacted = redactPhotoLocation(new Uint8Array(await file.arrayBuffer()))
    return new File([redacted], file.name, { type: file.type, lastModified: file.lastModified })
  } catch {
    return file
  }
}

export function getDistanceMeters(from: LatLng, to: LatLng): number {
  const radians = (value: number) => value * Math.PI / 180
  const dLat = radians(to.lat - from.lat)
  const dLng = radians(to.lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function findEarliest(items: PhotoMetadata[]): PhotoTakenAt | null {
  return items.reduce<PhotoTakenAt | null>((earliest, item) => (
    item.takenAt && (!earliest || item.takenAt.sortValue < earliest.sortValue) ? item.takenAt : earliest
  ), null)
}

// The first photo with GPS places the pin. The date is the earliest capture at
// that place, so a photo from another day or place does not move the record.
export function summarizePhotoMetadata(items: PhotoMetadata[]): PhotoSelectionSummary {
  const locationIndex = items.findIndex((item) => item.location)
  const location = locationIndex >= 0 ? items[locationIndex].location : null
  const atPin = location
    ? items.filter((item) => item.location && getDistanceMeters(location, item.location) <= PHOTO_SAME_PLACE_METERS)
    : []
  return {
    location,
    locationIndex,
    takenAt: findEarliest(atPin) || findEarliest(items),
    missingLocationCount: items.filter((item) => !item.location).length,
    distantPhotoCount: location ? items.filter((item) => item.location).length - atPin.length : 0,
  }
}
