import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

/** Returns `value` once it has stopped changing for `delayMs` (search inputs). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/** Live media query match. Falls back to false where matchMedia does not exist (tests). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => undefined
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  const getSnapshot = () =>
    typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

const APP_NAME = 'GPS Comercial'

/** Page title per view (WCAG 2.4.2): "Vehículos · GPS Comercial". */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
