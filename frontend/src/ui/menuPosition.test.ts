import { describe, expect, it } from 'vitest'
import { placeMenu } from './menuPosition'

const PHONE = { width: 390, height: 844 }
const MENU = { width: 208, height: 180 }

describe('placeMenu', () => {
  it('aligns the right edges under a trigger at the right of a phone card', () => {
    // "⋮" of a passenger card: right edge at 336 px.
    expect(placeMenu({ top: 500, bottom: 540, right: 336 }, MENU, PHONE)).toEqual({ left: 128, top: 544 })
  })

  it('never leaves the screen on the left or on the right', () => {
    expect(placeMenu({ top: 100, bottom: 140, right: 60 }, MENU, PHONE).left).toBe(8)
    expect(placeMenu({ top: 100, bottom: 140, right: 389 }, MENU, PHONE).left).toBe(390 - 208 - 8)
  })

  it('opens above the trigger when there is no room below', () => {
    expect(placeMenu({ top: 760, bottom: 800, right: 336 }, MENU, PHONE)).toEqual({ left: 128, top: 760 - 4 - 180 })
  })

  it('does not depend on window.innerWidth', () => {
    // The iOS case: a wider innerWidth used to push the menu about 180 px to the left.
    const before = placeMenu({ top: 500, bottom: 540, right: 336 }, MENU, PHONE)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 568 })
    expect(placeMenu({ top: 500, bottom: 540, right: 336 }, MENU, PHONE)).toEqual(before)
  })
})
