import type { VehicleMarker } from '@/api/types'
import { formatCourse, formatDateTime, formatRelative, formatSpeed } from '@/lib/format'
import { VEHICLE_STATUS_LABELS } from '@/lib/vehicleStatus'
import L from './leaflet'

// Marker and popup DOM is built with createElement/textContent: vehicle names come from Wialon,
// so they never go through innerHTML (SEG-03). No style attributes either (strict CSP).

/** Click and focus target of a marker; the visible shape inside is 24 px (map.css). */
export const MARKER_SIZE = 32

function markerLabel(vehicle: VehicleMarker): string {
  return `${vehicle.name}, ${VEHICLE_STATUS_LABELS[vehicle.status]}`
}

/**
 * Element shown inside the Leaflet icon. Status = colour + shape (circle, square, diamond) +
 * glyph, so it is distinguishable without colour. It is kept and updated in place, which keeps
 * keyboard focus on the marker when data refreshes.
 */
export function createMarkerElement(vehicle: VehicleMarker, selected: boolean): HTMLElement {
  const root = document.createElement('span')
  const glyph = document.createElement('span')
  glyph.className = 'vehicle-marker__glyph'
  const label = document.createElement('span')
  label.className = 'visually-hidden'
  root.append(glyph, label)
  updateMarkerElement(root, vehicle, selected)
  return root
}

export function updateMarkerElement(root: HTMLElement, vehicle: VehicleMarker, selected: boolean): void {
  root.className = `vehicle-marker vehicle-marker--${vehicle.status}${selected ? ' is-selected' : ''}`
  const glyph = root.firstElementChild
  if (glyph instanceof HTMLElement) {
    // CSSOM assignment (not a style attribute), allowed by a CSP without 'unsafe-inline'.
    glyph.style.transform =
      vehicle.status === 'moving' && vehicle.course_deg !== null ? `rotate(${vehicle.course_deg}deg)` : ''
  }
  const label = root.lastElementChild
  if (label) label.textContent = markerLabel(vehicle)
}

export function createVehicleIcon(element: HTMLElement): L.DivIcon {
  return L.divIcon({
    html: element,
    className: 'vehicle-marker-icon',
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
    popupAnchor: [0, -MARKER_SIZE / 2],
  })
}

export function markerTitle(vehicle: VehicleMarker): string {
  return markerLabel(vehicle)
}

/** Cluster bubble with an accessible name ("Grupo de 12 vehículos"). */
export function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount()
  const root = document.createElement('span')
  root.className = 'vehicle-cluster'
  const prefix = document.createElement('span')
  prefix.className = 'visually-hidden'
  prefix.textContent = 'Grupo de '
  const value = document.createElement('span')
  value.textContent = String(count)
  const suffix = document.createElement('span')
  suffix.className = 'visually-hidden'
  suffix.textContent = count === 1 ? ' vehículo' : ' vehículos'
  root.append(prefix, value, suffix)
  const size = count < 10 ? 36 : count < 100 ? 42 : 48
  return L.divIcon({ html: root, className: 'vehicle-cluster-icon', iconSize: [size, size] })
}

function appendDetail(list: HTMLElement, term: string, description: string): void {
  const row = document.createElement('div')
  const dt = document.createElement('dt')
  dt.textContent = term
  const dd = document.createElement('dd')
  dd.textContent = description
  row.append(dt, dd)
  list.append(row)
}

/** Popup card: name, status, speed, course, last update and driver (RF-11, RF-13). */
export function createPopupContent(
  vehicle: VehicleMarker,
  onOpenDetail: ((id: number) => void) | undefined,
  now: number = Date.now(),
): HTMLElement {
  const root = document.createElement('div')
  root.className = 'vehicle-popup'

  const title = document.createElement('p')
  title.className = 'vehicle-popup__title'
  title.textContent = vehicle.name

  const status = document.createElement('p')
  status.className = `vehicle-popup__status vehicle-popup__status--${vehicle.status}`
  status.textContent = VEHICLE_STATUS_LABELS[vehicle.status]

  const details = document.createElement('dl')
  details.className = 'vehicle-popup__details'
  appendDetail(details, 'Velocidad', formatSpeed(vehicle.speed_kmh))
  appendDetail(details, 'Rumbo', formatCourse(vehicle.course_deg))
  appendDetail(
    details,
    'Última actualización',
    vehicle.last_message_at
      ? `${formatDateTime(vehicle.last_message_at)} (${formatRelative(vehicle.last_message_at, now)})`
      : 'Sin dato',
  )
  appendDetail(details, 'Conductor', vehicle.driver_name ?? 'Sin conductor asignado')

  root.append(title, status, details)

  if (onOpenDetail) {
    const link = document.createElement('a')
    link.className = 'vehicle-popup__link'
    link.href = `/app/vehicles/${vehicle.id}`
    link.textContent = 'Ver detalle del vehículo'
    link.addEventListener('click', (event) => {
      // Let modified clicks open a new tab; plain clicks navigate inside the SPA.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      onOpenDetail(vehicle.id)
    })
    root.append(link)
  }
  return root
}
