import { describe, expect, it, vi } from 'vitest'
import type { VehicleMarker } from '@/api/types'
import L from './leaflet'
import { createClusterIcon, createMarkerElement, createPopupContent, updateMarkerElement } from './markers'

const vehicle: VehicleMarker = {
  id: 7,
  // Names come from Wialon: treat them as untrusted text.
  name: '<img src=x onerror="alert(1)">Camión',
  status: 'moving',
  latitude: 4.6,
  longitude: -74.1,
  speed_kmh: 38.6,
  course_deg: 135,
  last_message_at: '2026-11-09T19:30:00Z',
  driver_name: null,
}

describe('map markers', () => {
  it('loads the clustering plugin on the same Leaflet instance (UMD global)', () => {
    expect(typeof L.markerClusterGroup).toBe('function')
    expect(L.markerClusterGroup()).toBeInstanceOf(L.FeatureGroup)
  })

  it('renders untrusted names as text, never as HTML', () => {
    const element = createMarkerElement(vehicle, false)
    const popup = createPopupContent(vehicle, undefined)

    expect(element.querySelector('img')).toBeNull()
    expect(popup.querySelector('img')).toBeNull()
    expect(popup.querySelector('.vehicle-popup__title')?.textContent).toBe(vehicle.name)
  })

  it('encodes status as class + shape and the course as rotation, updating in place', () => {
    const element = createMarkerElement(vehicle, false)
    expect(element).toHaveClass('vehicle-marker', 'vehicle-marker--moving')
    expect((element.firstElementChild as HTMLElement).style.transform).toBe('rotate(135deg)')
    expect(element.textContent).toContain('En movimiento')

    updateMarkerElement(element, { ...vehicle, status: 'no_signal' }, true)
    expect(element).toHaveClass('vehicle-marker--no_signal', 'is-selected')
    expect((element.firstElementChild as HTMLElement).style.transform).toBe('')
    expect(element.textContent).toContain('Sin señal')
  })

  it('shows the key data in the popup and states when there is no driver', () => {
    const onOpenDetail = vi.fn()
    const popup = createPopupContent(vehicle, onOpenDetail, Date.parse('2026-11-09T19:35:00Z'))

    expect(popup.textContent).toContain('39 km/h')
    expect(popup.textContent).toContain('Sureste (SE)')
    expect(popup.textContent).toContain('hace 5 minutos')
    expect(popup.textContent).toContain('Sin conductor asignado')

    popup.querySelector('a')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    expect(onOpenDetail).toHaveBeenCalledWith(7)
  })

  it('names clusters for assistive technology', () => {
    const icon = createClusterIcon({ getChildCount: () => 12 } as L.MarkerCluster)
    const html = icon.options.html as HTMLElement
    expect(html.textContent).toBe('Grupo de 12 vehículos')
  })
})
