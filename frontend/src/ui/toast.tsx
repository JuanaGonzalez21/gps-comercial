import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, CloseIcon, InfoIcon } from './icons'
import './toast.css'

// The signature (ToastProvider, useToast().show) is the shared contract; screens rely on it.
export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
}

export interface ToastApi {
  show(options: ToastOptions): void
}

interface ToastItem {
  id: number
  title: string
  description?: string
  tone: ToastTone
}

const MAX_TOASTS = 4
const DISMISS_AFTER_MS: Record<ToastTone, number> = {
  success: 5_000,
  info: 6_000,
  warning: 8_000,
  error: 10_000,
}

const TONE_ICONS = {
  success: CheckCircleIcon,
  info: InfoIcon,
  warning: AlertTriangleIcon,
  error: AlertCircleIcon,
} as const

const TONE_LABELS: Record<ToastTone, string> = {
  success: 'Éxito',
  info: 'Información',
  warning: 'Atención',
  error: 'Error',
}

const noop: ToastApi = { show: () => undefined }
const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      show: ({ title, description, tone = 'info' }) => {
        nextId.current += 1
        const toast: ToastItem = { id: nextId.current, title, description, tone }
        setToasts((current) => [...current, toast].slice(-MAX_TOASTS))
      },
    }),
    [],
  )

  const urgent = toasts.filter((toast) => toast.tone === 'error' || toast.tone === 'warning')
  const polite = toasts.filter((toast) => toast.tone === 'success' || toast.tone === 'info')

  // Both live regions exist from the start, so additions are announced reliably.
  return (
    <ToastContext value={api}>
      {children}
      <section className="toast-region" aria-label="Notificaciones">
        <ol className="toast-list" role="list" aria-live="assertive" aria-relevant="additions">
          {urgent.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </ol>
        <ol className="toast-list" role="list" aria-live="polite" aria-relevant="additions">
          {polite.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </ol>
      </section>
    </ToastContext>
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  // Auto-dismiss pauses while the pointer or keyboard focus is on the toast (WCAG 2.2.1).
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => onDismiss(toast.id), DISMISS_AFTER_MS[toast.tone])
    return () => clearTimeout(timer)
  }, [paused, toast.id, toast.tone, onDismiss])

  const Icon = TONE_ICONS[toast.tone]
  return (
    <li
      className={`toast toast--${toast.tone}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon className="toast__icon" />
      <div className="toast__body">
        <p className="toast__title">
          <span className="visually-hidden">{TONE_LABELS[toast.tone]}: </span>
          {toast.title}
        </p>
        {toast.description && <p className="toast__description">{toast.description}</p>}
      </div>
      <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)}>
        <CloseIcon />
        <span className="visually-hidden">Cerrar notificación</span>
      </button>
    </li>
  )
}

// Kept next to its provider because this file is the shared contract location; only fast
// refresh is affected (it reloads this module fully), not runtime behaviour.
// oxlint-disable-next-line react/only-export-components
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? noop
}
