import { useEffect, useRef, useState } from 'react'
import {
  getKakaoMaps,
  isKakaoMapConfigured,
  kakaoMapConfigMessage,
  loadKakaoMapSdk,
  type KakaoEventHandler,
  type KakaoMapInstance,
  type KakaoMarkerInstance,
  type LatLng,
} from '../../lib/kakaoMap'
import type { ProjectPinMapMarker } from '../../types/mapFeature'
import type { Post } from '../../types/post'
import { createPostMarker } from './PostMarker'
import { createProjectPinMarker } from './ProjectPinMarker'

interface KakaoMapViewProps {
  center: LatLng
  posts: Post[]
  projectPins?: ProjectPinMapMarker[]
  selectedLocation?: LatLng | null
  onMapClick: (location: LatLng) => void
  onMarkerClick: (post: Post) => void
  onProjectPinClick?: (pin: ProjectPinMapMarker) => void
  currentUserUid?: string
  className?: string
}

export function KakaoMapView({
  center,
  posts,
  projectPins = [],
  selectedLocation = null,
  onMapClick,
  onMarkerClick,
  onProjectPinClick,
  currentUserUid,
  className = '',
}: KakaoMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<KakaoMapInstance | null>(null)
  const mapClickHandlerRef = useRef<KakaoEventHandler | null>(null)
  const postMarkersRef = useRef<KakaoMarkerInstance[]>([])
  const projectPinMarkersRef = useRef<KakaoMarkerInstance[]>([])
  const selectedMarkerRef = useRef<KakaoMarkerInstance | null>(null)
  const onMapClickRef = useRef(onMapClick)
  const onMarkerClickRef = useRef(onMarkerClick)
  const onProjectPinClickRef = useRef(onProjectPinClick)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    isKakaoMapConfigured ? 'loading' : 'error',
  )
  const [message, setMessage] = useState(isKakaoMapConfigured ? '' : kakaoMapConfigMessage)

  useEffect(() => {
    onMapClickRef.current = onMapClick
  }, [onMapClick])

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
  }, [onMarkerClick])

  useEffect(() => {
    onProjectPinClickRef.current = onProjectPinClick
  }, [onProjectPinClick])

  useEffect(() => {
    if (!isKakaoMapConfigured) {
      return undefined
    }

    let canceled = false

    loadKakaoMapSdk()
      .then(() => {
        if (canceled || !containerRef.current) {
          return
        }

        const kakao = getKakaoMaps()
        const map = new kakao.Map(containerRef.current, {
          center: new kakao.LatLng(center.lat, center.lng),
          level: 4,
        })
        const clickHandler: KakaoEventHandler = (event) => {
          if (!event?.latLng) {
            return
          }

          onMapClickRef.current({
            lat: event.latLng.getLat(),
            lng: event.latLng.getLng(),
          })
        }

        mapRef.current = map
        mapClickHandlerRef.current = clickHandler
        kakao.event.addListener(map, 'click', clickHandler)
        setStatus('ready')
      })
      .catch((error) => {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : kakaoMapConfigMessage)
      })

    return () => {
      canceled = true
      const kakao = window.kakao?.maps

      if (kakao && mapRef.current && mapClickHandlerRef.current) {
        kakao.event.removeListener(mapRef.current, 'click', mapClickHandlerRef.current)
      }

      postMarkersRef.current.forEach((marker) => marker.setMap(null))
      projectPinMarkersRef.current.forEach((marker) => marker.setMap(null))
      selectedMarkerRef.current?.setMap(null)
      mapRef.current = null
    }
  }, [center.lat, center.lng])

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) {
      return
    }

    const kakao = getKakaoMaps()
    mapRef.current.setCenter(new kakao.LatLng(center.lat, center.lng))
  }, [center.lat, center.lng, status])

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) {
      return
    }

    const kakao = getKakaoMaps()
    postMarkersRef.current.forEach((marker) => marker.setMap(null))
    postMarkersRef.current = posts.map((post) =>
      createPostMarker(kakao, mapRef.current as KakaoMapInstance, post, currentUserUid, () =>
        onMarkerClickRef.current(post),
      ),
    )
  }, [currentUserUid, posts, status])

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) {
      return
    }

    const kakao = getKakaoMaps()
    projectPinMarkersRef.current.forEach((marker) => marker.setMap(null))
    projectPinMarkersRef.current = projectPins.map((pin) =>
      createProjectPinMarker(kakao, mapRef.current as KakaoMapInstance, pin, () =>
        onProjectPinClickRef.current?.(pin),
      ),
    )
  }, [projectPins, status])

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) {
      return
    }

    const kakao = getKakaoMaps()
    selectedMarkerRef.current?.setMap(null)

    if (!selectedLocation) {
      selectedMarkerRef.current = null
      return
    }

    const marker = new kakao.Marker({
      position: new kakao.LatLng(selectedLocation.lat, selectedLocation.lng),
    })
    marker.setMap(mapRef.current)
    selectedMarkerRef.current = marker
  }, [selectedLocation, status])

  return (
    <section className={`kakao-map ${className}`} aria-label="장소 기록 지도">
      <div ref={containerRef} className="map-canvas" />
      {status !== 'ready' && (
        <div className="map-state">
          <strong>{status === 'loading' ? '지도를 불러오는 중입니다.' : '지도를 표시할 수 없습니다.'}</strong>
          <p>{message}</p>
        </div>
      )}
    </section>
  )
}
