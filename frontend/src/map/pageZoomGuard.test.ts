import { afterEach, describe, expect, it } from 'vitest'
import { installPageZoomGuard } from './pageZoomGuard'

function pinch(target: Element, type = 'gesturestart') {
  const event = new Event(type, { bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event.defaultPrevented
}

describe('installPageZoomGuard', () => {
  let uninstall: () => void = () => {}
  afterEach(() => {
    uninstall()
    document.body.innerHTML = ''
  })

  it('cancels the page pinch-zoom only when it starts on a map', () => {
    document.body.innerHTML = '<div class="leaflet-container"><div id="tile"></div></div><p id="text">Texto</p>'
    uninstall = installPageZoomGuard()
    expect(pinch(document.getElementById('tile')!)).toBe(true)
    expect(pinch(document.getElementById('tile')!, 'gesturechange')).toBe(true)
    expect(pinch(document.getElementById('text')!)).toBe(false)
  })

  it('stops cancelling once uninstalled', () => {
    document.body.innerHTML = '<div class="leaflet-container"><div id="tile"></div></div>'
    installPageZoomGuard()()
    expect(pinch(document.getElementById('tile')!)).toBe(false)
  })
})
