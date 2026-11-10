// Global "server is waking up" state (DEP-04). Free hosting plans suspend the backend when idle;
// the API client reports requests that are retrying or unusually slow, and the banner reads it.

/** Render's free plan sleeps after ~15 min without traffic; assume it may be asleep sooner. */
const ASSUME_ASLEEP_AFTER_MS = 10 * 60_000

let wakingRequests = 0
let lastBackendAnswerAt = 0
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribeServerStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Snapshot for useSyncExternalStore: true while at least one request waits for the server. */
export function isServerWaking(): boolean {
  return wakingRequests > 0
}

export function beginWaking(): void {
  wakingRequests += 1
  if (wakingRequests === 1) notify()
}

export function endWaking(): void {
  wakingRequests = Math.max(0, wakingRequests - 1)
  if (wakingRequests === 0) notify()
}

/** Called whenever our backend (not a proxy error page) answers. */
export function markBackendAnswered(now: number = Date.now()): void {
  lastBackendAnswerAt = now
}

/** Slow requests only mean "starting" if the backend has not answered recently. */
export function isBackendPossiblyAsleep(now: number = Date.now()): boolean {
  return now - lastBackendAnswerAt > ASSUME_ASLEEP_AFTER_MS
}
