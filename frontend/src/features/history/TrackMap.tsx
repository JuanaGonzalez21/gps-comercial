import { useEffect, useRef } from 'react'
import type { TrackPoint } from '@/api/types'
import { formatDateTime } from '@/lib/format'
import L from '@/map/leaflet'

// Route map for the history (RF-24): full polyline, the part already played, start/end pins and
// the playback cursor. Same free OpenStreetMap tiles and attribution as the vehicles map.
// Marker DOM is built with createElement/textContent (no innerHTML, strict CSP).

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const BOGOTA: L.LatLngTuple = [4.711, -74.0721]
// Palette: teal for the route, its accessible dark variant for the played part; teal cursor.
const ROUTE_COLOR = '#1e8c93'
const PLAYED_COLOR = '#176f75'
const CURSOR_SIZE = 30
const FIT_PADDING_PX = 36
const FOLLOW_MARGIN_PX = 20

export interface TrackMapProps {
  points: readonly TrackPoint[]
  currentIndex: number
  /** prefers-reduced-motion: fit and follow the cursor without animated pans. */
  reducedMotion: boolean
}

function latLng(point: TrackPoint): L.LatLngTuple {
  return [point.latitude, point.longitude]
}

function createPin(kind: 'start' | 'end', point: TrackPoint): L.Marker {
  const root = document.createElement('span')
  root.className = `track-pin track-pin--${kind}`
  const label = document.createElement('span')
  label.className = 'track-pin__label'
  label.textContent = kind === 'start' ? 'Inicio' : 'Fin'
  const dot = document.createElement('span')
  dot.className = 'track-pin__dot'
  root.append(label, dot)
  const title = `${kind === 'start' ? 'Inicio' : 'Fin'} del recorrido: ${formatDateTime(point.recorded_at)}`
  return L.marker(latLng(point), {
    icon: L.divIcon({
      html: root,
      className: 'track-pin-icon',
      iconSize: [64, 44],
      iconAnchor: [32, 37],
    }),
    title,
    // Not interactive: the same information is in the text panel, so no empty tab stops.
    keyboard: false,
    interactive: false,
    zIndexOffset: kind === 'end' ? 200 : 100,
  })
}

function createCursor(): { marker: L.Marker; arrow: HTMLElement } {
  const root = document.createElement('span')
  root.className = 'track-cursor'
  const arrow = document.createElement('span')
  arrow.className = 'track-cursor__arrow'
  root.append(arrow)
  const marker = L.marker(BOGOTA, {
    icon: L.divIcon({
      html: root,
      className: 'track-cursor-icon',
      iconSize: [CURSOR_SIZE, CURSOR_SIZE],
      iconAnchor: [CURSOR_SIZE / 2, CURSOR_SIZE / 2],
    }),
    keyboard: false,
    interactive: false,
    zIndexOffset: 1000,
  })
  return { marker, arrow }
}

export function TrackMap({ points, currentIndex, reducedMotion }: TrackMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const playedRef = useRef<L.Polyline | null>(null)
  const cursorRef = useRef<{ marker: L.Marker; arrow: HTMLElement } | null>(null)
  // True while a new route is being fitted (until its moveend): following the cursor meanwhile
  // would read the old view and cut the fit animation.
  const fittingRef = useRef(false)
  const reducedMotionRef = useRef(reducedMotion)
  useEffect(() => {
    reducedMotionRef.current = reducedMotion
  })

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const animate = !reducedMotionRef.current
    const map = L.map(container, {
      center: BOGOTA,
      zoom: 12,
      zoomControl: false,
      zoomAnimation: animate,
      fadeAnimation: animate,
      markerZoomAnimation: animate,
    })
    L.control
      .zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' })
      .addTo(map)
    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    container.setAttribute('role', 'region')
    container.setAttribute(
      'aria-label',
      'Mapa del recorrido. Usa las flechas para desplazarte y las teclas más y menos para acercar o alejar.',
    )
    mapRef.current = map
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
      playedRef.current = null
      cursorRef.current = null
    }
  }, [])

  // Draw the route and fit it once per track.
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    playedRef.current = null
    cursorRef.current = null
    if (points.length === 0) return

    const route = points.map(latLng)
    L.polyline(route, { color: ROUTE_COLOR, weight: 4, opacity: 0.55, interactive: false }).addTo(layer)
    playedRef.current = L.polyline([route[0]], {
      color: PLAYED_COLOR,
      weight: 5,
      opacity: 0.95,
      interactive: false,
    }).addTo(layer)
    createPin('start', points[0]).addTo(layer)
    if (points.length > 1) createPin('end', points[points.length - 1]).addTo(layer)
    const cursor = createCursor()
    cursor.marker.addTo(layer)
    cursorRef.current = cursor

    map.invalidateSize()
    // Registered before fitting: without animation moveend fires synchronously.
    fittingRef.current = true
    map.once('moveend', () => {
      fittingRef.current = false
    })
    const animate = !reducedMotionRef.current
    if (points.length === 1) map.setView(route[0], 16, { animate })
    else {
      map.fitBounds(L.latLngBounds(route), {
        padding: [FIT_PADDING_PX, FIT_PADDING_PX],
        maxZoom: 17,
        animate,
      })
    }
  }, [points])

  // Move the cursor and the played part with the playback position.
  useEffect(() => {
    const map = mapRef.current
    const cursor = cursorRef.current
    const played = playedRef.current
    const point = points[currentIndex]
    if (!map || !cursor || !played || !point) return
    const position = latLng(point)
    cursor.marker.setLatLng(position)
    cursor.marker.getElement()?.setAttribute('title', `Posición: ${formatDateTime(point.recorded_at)}`)
    // CSSOM assignment (not a style attribute): allowed by a CSP without 'unsafe-inline'.
    cursor.arrow.style.transform =
      point.course_deg === null ? '' : `rotate(${point.course_deg}deg)`
    cursor.arrow.classList.toggle('is-headless', point.course_deg === null)
    played.setLatLngs(points.slice(0, currentIndex + 1).map(latLng))
    if (fittingRef.current) return
    // Follow the cursor only when it leaves the view; never an animated pan with reduced motion.
    // The margin is smaller than the fit padding, so a fitted route never pans by itself.
    const pixel = map.latLngToContainerPoint(position)
    const size = map.getSize()
    const inView =
      pixel.x >= FOLLOW_MARGIN_PX &&
      pixel.y >= FOLLOW_MARGIN_PX &&
      pixel.x <= size.x - FOLLOW_MARGIN_PX &&
      pixel.y <= size.y - FOLLOW_MARGIN_PX
    if (!inView) map.panTo(position, { animate: !reducedMotionRef.current })
  }, [points, currentIndex])

  return (
    <div className="track-map">
      <div ref={containerRef} className="track-map__canvas" />
    </div>
  )
}
