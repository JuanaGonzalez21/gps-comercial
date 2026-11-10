import { useCallback, useEffect, useReducer } from 'react'

// Track playback as a small state machine (pure reducer, easy to test). A timer dispatches
// "tick" while playing; the reducer moves the position and stops by itself at the last point.

export const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

export const PLAYBACK_TICK_MS = 100
/** At x1 a whole route plays in about a minute (600 ticks), whatever its number of points. */
const TICKS_PER_ROUTE_AT_X1 = 600

/** Points advanced per tick: at least one, scaled by route length and speed. */
export function pointsPerTick(pointCount: number, speed: PlaybackSpeed): number {
  return Math.max(1, Math.round(pointCount / TICKS_PER_ROUTE_AT_X1)) * speed
}

export interface PlaybackState {
  index: number
  playing: boolean
  speed: PlaybackSpeed
  /** Index of the last point (pointCount - 1). */
  last: number
}

export type PlaybackAction =
  | { type: 'toggle' }
  | { type: 'pause' }
  | { type: 'tick' }
  | { type: 'seek'; index: number }
  | { type: 'speed'; speed: PlaybackSpeed }

export function initialPlayback(pointCount: number): PlaybackState {
  return { index: 0, playing: false, speed: 1, last: Math.max(0, pointCount - 1) }
}

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'toggle':
      if (state.playing) return { ...state, playing: false }
      if (state.last === 0) return state
      // Pressing play at the end starts again from the first point.
      return { ...state, playing: true, index: state.index >= state.last ? 0 : state.index }
    case 'pause':
      return state.playing ? { ...state, playing: false } : state
    case 'tick': {
      if (!state.playing) return state
      const index = Math.min(state.index + pointsPerTick(state.last + 1, state.speed), state.last)
      return { ...state, index, playing: index < state.last }
    }
    case 'seek': {
      const index = Math.min(Math.max(0, Math.round(action.index)), state.last)
      return index === state.index ? state : { ...state, index }
    }
    case 'speed':
      return { ...state, speed: action.speed }
  }
}

export function usePlayback(pointCount: number) {
  const [state, dispatch] = useReducer(playbackReducer, pointCount, initialPlayback)

  useEffect(() => {
    if (!state.playing) return
    const timer = setInterval(() => dispatch({ type: 'tick' }), PLAYBACK_TICK_MS)
    return () => clearInterval(timer)
  }, [state.playing])

  const toggle = useCallback(() => dispatch({ type: 'toggle' }), [])
  const pause = useCallback(() => dispatch({ type: 'pause' }), [])
  const seek = useCallback((index: number) => dispatch({ type: 'seek', index }), [])
  const setSpeed = useCallback((speed: PlaybackSpeed) => dispatch({ type: 'speed', speed }), [])

  return { ...state, toggle, pause, seek, setSpeed }
}
