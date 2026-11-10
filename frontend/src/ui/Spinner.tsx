import './feedback.css'

export type SpinnerSize = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  /** When set, the spinner becomes a polite status message for screen readers. */
  label?: string
  className?: string
}

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const svg = (
    <svg
      className={['spinner', `spinner--${size}`, className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="spinner__track" cx="12" cy="12" r="9" fill="none" strokeWidth="3" />
      <path className="spinner__arc" d="M21 12a9 9 0 0 0-9-9" fill="none" strokeWidth="3" />
    </svg>
  )
  if (!label) return svg
  return (
    <span className="spinner-status" role="status">
      {svg}
      <span className="visually-hidden">{label}</span>
    </span>
  )
}

/** Full-area loader for route transitions and session checks (never a blank screen). */
export function PageLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="page-loader" role="status">
      <Spinner size="lg" />
      <p className="page-loader__label">{label}</p>
    </div>
  )
}
