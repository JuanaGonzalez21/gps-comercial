import { describe, expect, it } from 'vitest'
import { nearestIndex, niceSpeedMax, sampleIndices } from './speedScale'
import { initialPlayback, playbackReducer, pointsPerTick, type PlaybackState } from './usePlayback'

describe('playbackReducer', () => {
  const ten = initialPlayback(10)

  it('starts paused at the first point at x1', () => {
    expect(ten).toEqual({ index: 0, playing: false, speed: 1, last: 9 })
  })

  it('advances on each tick while playing and stops by itself at the end', () => {
    let state: PlaybackState = playbackReducer(ten, { type: 'toggle' })
    expect(state.playing).toBe(true)
    state = playbackReducer(state, { type: 'tick' })
    expect(state.index).toBe(1)
    state = playbackReducer(state, { type: 'speed', speed: 8 })
    state = playbackReducer(state, { type: 'tick' })
    expect(state).toMatchObject({ index: 9, playing: false })
    // Ticks after the end change nothing.
    expect(playbackReducer(state, { type: 'tick' })).toBe(state)
  })

  it('replays from the start when play is pressed at the end', () => {
    const atEnd: PlaybackState = { ...ten, index: 9 }
    expect(playbackReducer(atEnd, { type: 'toggle' })).toMatchObject({ index: 0, playing: true })
  })

  it('ignores ticks while paused and clamps seeks', () => {
    expect(playbackReducer(ten, { type: 'tick' })).toBe(ten)
    expect(playbackReducer(ten, { type: 'seek', index: 42 }).index).toBe(9)
    expect(playbackReducer(ten, { type: 'seek', index: -3 }).index).toBe(0)
  })

  it('cannot play a single point', () => {
    const single = initialPlayback(1)
    expect(playbackReducer(single, { type: 'toggle' })).toBe(single)
  })

  it('scales the step with route length and speed', () => {
    expect(pointsPerTick(10, 1)).toBe(1)
    expect(pointsPerTick(10, 4)).toBe(4)
    expect(pointsPerTick(2_000, 1)).toBe(3)
    expect(pointsPerTick(2_000, 8)).toBe(24)
  })
})

describe('speed chart scale', () => {
  it('rounds the axis maximum to readable steps', () => {
    expect(niceSpeedMax(0)).toBe(10)
    expect(niceSpeedMax(42)).toBe(50)
    expect(niceSpeedMax(72)).toBe(80)
    expect(niceSpeedMax(151)).toBe(200)
  })

  it('finds the nearest point in time and samples rows for the table', () => {
    expect(nearestIndex([0, 10, 20, 30], 14)).toBe(1)
    expect(nearestIndex([0, 10, 20, 30], 16)).toBe(2)
    expect(nearestIndex([0, 10, 20, 30], 99)).toBe(3)
    expect(sampleIndices(5, 24)).toEqual([0, 1, 2, 3, 4])
    expect(sampleIndices(100, 3)).toEqual([0, 50, 99])
  })
})
