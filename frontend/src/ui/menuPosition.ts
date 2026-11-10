/** Distance kept between a floating menu and the edges of the screen. */
const EDGE = 8

export interface Box {
  width: number
  height: number
}

export interface TriggerRect {
  top: number
  bottom: number
  right: number
}

/**
 * Where a fixed menu goes: under its trigger with both right edges aligned, or above it when there
 * is no room below. Only left/top are returned, in the same coordinates as getBoundingClientRect,
 * and kept inside the viewport. A right-anchored menu (`right: innerWidth - rect.right`) broke on
 * iOS Safari, where window.innerWidth can differ from the box fixed elements are placed in.
 */
export function placeMenu(trigger: TriggerRect, menu: Box, viewport: Box, gap = 4): { left: number; top: number } {
  const maxLeft = Math.max(EDGE, viewport.width - menu.width - EDGE)
  const left = Math.min(Math.max(trigger.right - menu.width, EDGE), maxLeft)
  const roomBelow = viewport.height - trigger.bottom - gap - EDGE
  const placeAbove = roomBelow < menu.height && trigger.top > viewport.height - trigger.bottom
  const top = placeAbove ? Math.max(EDGE, trigger.top - gap - menu.height) : trigger.bottom + gap
  return { left, top }
}

/** Layout viewport: the box that position: fixed uses (without the scrollbar). */
export function layoutViewport(): Box {
  const root = document.documentElement
  return {
    width: root.clientWidth || window.innerWidth,
    height: window.visualViewport?.height ?? (root.clientHeight || window.innerHeight),
  }
}
