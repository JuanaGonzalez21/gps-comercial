import { useEffect, useRef } from 'react'
import type { VehicleMarker } from '@/api/types'
import L from '@/map/leaflet'
import { createMarkerElement, createVehicleIcon, markerTitle, updateMarkerElement } from '@/map/markers'
import '@/map/map.css'

// Same free tiles and attribution as the fleet map (OpenStreetMap tile usage policy; no Google Maps).
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const DETAIL_ZOOM = 15

export interface VehiclePositionMapProps {
  vehicle: VehicleMarker
}

/**
 * Single-vehicle map for the detail page. It reuses the fleet marker (status colour + shape +
 * heading, drawn larger with a halo by vehicles.css) and follows the vehicle when the detail
 * refreshes. Scroll-wheel zoom is off so the page keeps scrolling normally; the zoom buttons
 * (top right, as in the design) and keyboard still work.
 */
export function VehiclePositionMap({ vehicle }: VehiclePositionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<{ marker: L.Marker; element: HTMLElement } | null>(null)
  // The first render's vehicle positions the map; later ones go through the update effect.
  const initialRef = useRef(vehicle)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const first = initialRef.current
    const center: L.LatLngTuple = [first.latitude, first.longitude]
    const map = L.map(container, { center, zoom: DETAIL_ZOOM, zoomControl: false, scrollWheelZoom: false })
    L.control.zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map)
    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map)
    const element = createMarkerElement(first, true)
    const marker = L.marker(center, {
      icon: createVehicleIcon(element),
      title: markerTitle(first),
      keyboard: false, // the details next to the map already say everything the marker would
      interactive: false,
    }).addTo(map)
    container.setAttribute('role', 'region')
    container.setAttribute(
      'aria-label',
      `Mapa con la posición de ${first.name}. Usa las flechas para desplazarte y las teclas más y menos para acercar o alejar.`,
    )
    mapRef.current = map
    markerRef.current = { marker, element }

    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const entry = markerRef.current
    if (!map || !entry) return
    const next: L.LatLngTuple = [vehicle.latitude, vehicle.longitude]
    const current = entry.marker.getLatLng()
    updateMarkerElement(entry.element, vehicle, true)
    entry.marker.getElement()?.setAttribute('title', markerTitle(vehicle))
    if (current.lat !== next[0] || current.lng !== next[1]) {
      entry.marker.setLatLng(next)
      map.panTo(next, { animate: false })
    }
  }, [vehicle])

  return (
    <div className="vehicle-map vehicle-detail__map">
      <div ref={containerRef} className="vehicle-map__canvas" />
    </div>
  )
}
