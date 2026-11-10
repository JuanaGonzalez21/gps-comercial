/**
 * iOS Safari zooms the whole page when a pinch starts on a map, on top of Leaflet's own zoom, so the
 * map becomes hard to use on phones. WebKit announces that page zoom with its non-standard gesture
 * events (Leaflet zooms with pointer events and never needs them). Cancelling them only inside a map
 * keeps the map zoom and leaves page zoom available everywhere else (WCAG 1.4.4).
 */
const GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend'] as const

function cancelInsideMap(event: Event) {
  if (event.target instanceof Element && event.target.closest('.leaflet-container')) event.preventDefault()
}

export function installPageZoomGuard(target: Document = document): () => void {
  for (const type of GESTURE_EVENTS) target.addEventListener(type, cancelInsideMap, { passive: false })
  return () => {
    for (const type of GESTURE_EVENTS) target.removeEventListener(type, cancelInsideMap)
  }
}
