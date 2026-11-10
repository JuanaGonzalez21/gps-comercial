import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { VehicleMarker } from '@/api/types'
import L from './leaflet'
import {
  createClusterIcon,
  createMarkerElement,
  createPopupContent,
  createVehicleIcon,
  markerTitle,
  updateMarkerElement,
} from './markers'
import './map.css'

// Free OpenStreetMap tiles with the attribution their tile usage policy requires (no Google Maps).
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const BOGOTA: L.LatLngTuple = [4.711, -74.0721]
const SELECTED_Z_INDEX = 1000

interface MarkerEntry {
  marker: L.Marker
  element: HTMLElement
  vehicle: VehicleMarker
  selected: boolean
}

export interface VehicleMapProps {
  markers: readonly VehicleMarker[]
  selectedId: number | null
  /** Increment to bring the selected vehicle into view (selection made in the list). */
  focusRequest: number
  /** Identifies the current filter set: bounds are fitted once per value, not on every poll. */
  fitKey: string
  onSelect: (id: number) => void
  onOpenDetail?: (id: number) => void
  /** Status overlays (loading, empty, error) drawn above the map. */
  children?: ReactNode
}

/** Leaflet map with clustered, status-coded vehicle markers kept in sync with the list (RF-11, RF-15). */
export function VehicleMap({
  markers,
  selectedId,
  focusRequest,
  fitKey,
  onSelect,
  onOpenDetail,
  children,
}: VehicleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const entriesRef = useRef(new Map<number, MarkerEntry>())
  const fittedKeyRef = useRef<string | null>(null)
  const [hasSize, setHasSize] = useState(false)

  // Leaflet keeps handlers for the life of each marker: read the latest callbacks through a ref.
  const callbacksRef = useRef({ onSelect, onOpenDetail })
  useEffect(() => {
    callbacksRef.current = { onSelect, onOpenDetail }
  })

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const entries = entriesRef.current
    const map = L.map(container, { center: BOGOTA, zoom: 11, zoomControl: false })
    L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map)
    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map)
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      // 24 px markers: group only those that would really overlap, so shapes stay visible (RF-11).
      maxClusterRadius: 32,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: createClusterIcon,
    })
    map.addLayer(cluster)
    map.on('popupopen', (event) => {
      // Leaflet labels this button in English.
      const close = event.popup.getElement()?.querySelector('.leaflet-popup-close-button')
      close?.setAttribute('aria-label', 'Cerrar información del vehículo')
    })
    container.setAttribute('role', 'region')
    container.setAttribute(
      'aria-label',
      'Mapa de vehículos. Usa las flechas para desplazarte y las teclas más y menos para acercar o alejar.',
    )
    mapRef.current = map
    clusterRef.current = cluster

    // The list/map toggle hides the container: re-measure whenever its size changes.
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
      setHasSize(container.clientWidth > 0 && container.clientHeight > 0)
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      entries.clear()
      fittedKeyRef.current = null
    }
  }, [])

  // Add, move, restyle or remove markers by vehicle id (no full redraw on each poll).
  useEffect(() => {
    const cluster = clusterRef.current
    if (!cluster) return
    const entries = entriesRef.current
    const seen = new Set<number>()
    const added: L.Marker[] = []

    for (const vehicle of markers) {
      seen.add(vehicle.id)
      const selected = vehicle.id === selectedId
      const entry = entries.get(vehicle.id)
      if (!entry) {
        const element = createMarkerElement(vehicle, selected)
        const marker = L.marker([vehicle.latitude, vehicle.longitude], {
          icon: createVehicleIcon(element),
          title: markerTitle(vehicle),
          keyboard: true,
          riseOnHover: true,
          zIndexOffset: selected ? SELECTED_Z_INDEX : 0,
        })
        const created: MarkerEntry = { marker, element, vehicle, selected }
        marker.bindPopup(
          () => createPopupContent(created.vehicle, callbacksRef.current.onOpenDetail && openDetail),
          { maxWidth: 240, autoPanPaddingTopLeft: [52, 16], autoPanPaddingBottomRight: [16, 16] },
        )
        marker.on('click', () => callbacksRef.current.onSelect(created.vehicle.id))
        entries.set(vehicle.id, created)
        added.push(marker)
        continue
      }
      const moved =
        entry.vehicle.latitude !== vehicle.latitude || entry.vehicle.longitude !== vehicle.longitude
      if (moved) entry.marker.setLatLng([vehicle.latitude, vehicle.longitude])
      if (entry.selected !== selected) entry.marker.setZIndexOffset(selected ? SELECTED_Z_INDEX : 0)
      updateMarkerElement(entry.element, vehicle, selected)
      const title = markerTitle(vehicle)
      entry.marker.options.title = title
      entry.marker.getElement()?.setAttribute('title', title)
      entry.vehicle = vehicle
      entry.selected = selected
      if (entry.marker.isPopupOpen()) {
        entry.marker.setPopupContent(
          createPopupContent(vehicle, callbacksRef.current.onOpenDetail && openDetail),
        )
      }
    }

    const removed: L.Marker[] = []
    for (const [id, entry] of entries) {
      if (!seen.has(id)) {
        removed.push(entry.marker)
        entries.delete(id)
      }
    }
    if (removed.length > 0) cluster.removeLayers(removed)
    if (added.length > 0) cluster.addLayers(added)

    function openDetail(id: number) {
      callbacksRef.current.onOpenDetail?.(id)
    }
  }, [markers, selectedId])

  // Fit the view to the vehicles once per filter set, when the container is visible.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !hasSize || markers.length === 0 || fittedKeyRef.current === fitKey) return
    fittedKeyRef.current = fitKey
    map.invalidateSize()
    const bounds = L.latLngBounds(markers.map((m) => [m.latitude, m.longitude] as L.LatLngTuple))
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 })
  }, [markers, fitKey, hasSize])

  // Selection from the list: pan/zoom (opening its cluster if needed) and open the popup.
  useEffect(() => {
    if (focusRequest === 0 || selectedId === null) return
    const map = mapRef.current
    const cluster = clusterRef.current
    const entry = entriesRef.current.get(selectedId)
    if (!map || !cluster || !entry) return
    map.invalidateSize()
    cluster.zoomToShowLayer(entry.marker, () => entry.marker.openPopup())
  }, [focusRequest, selectedId])

  return (
    <div className="vehicle-map">
      <div ref={containerRef} className="vehicle-map__canvas" />
      {children && <div className="vehicle-map__overlay">{children}</div>}
    </div>
  )
}
