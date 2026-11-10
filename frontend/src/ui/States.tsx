import type { ReactNode, Ref } from 'react'
import { Button } from './Button'
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, InfoIcon, RefreshIcon } from './icons'
import './feedback.css'

type HeadingLevel = 'h2' | 'h3'

interface EmptyStateProps {
  title: string
  description?: ReactNode
  /** Guidance for the next step, usually a button or link (UX-06). */
  action?: ReactNode
  icon?: ReactNode
  headingLevel?: HeadingLevel
}

export function EmptyState({ title, description, action, icon, headingLevel: Heading = 'h2' }: EmptyStateProps) {
  return (
    <div className="state-block">
      {icon && <div className="state-block__icon">{icon}</div>}
      <Heading className="state-block__title">{title}</Heading>
      {description && <p className="state-block__text">{description}</p>}
      {action && <div className="state-block__action">{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retrying?: boolean
  headingLevel?: HeadingLevel
}

/** Failed load with a retry: announced to screen readers when it appears. */
export function ErrorState({
  title = 'No pudimos cargar la información',
  message,
  onRetry,
  retrying = false,
  headingLevel: Heading = 'h2',
}: ErrorStateProps) {
  return (
    <div className="state-block state-block--error" role="alert">
      <div className="state-block__icon">
        <AlertCircleIcon />
      </div>
      <Heading className="state-block__title">{title}</Heading>
      <p className="state-block__text">{message}</p>
      {onRetry && (
        <div className="state-block__action">
          <Button
            variant="secondary"
            icon={<RefreshIcon />}
            onClick={onRetry}
            loading={retrying}
            loadingText="Reintentando…"
          >
            Reintentar
          </Button>
        </div>
      )}
    </div>
  )
}

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

const ALERT_ICONS = {
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: AlertTriangleIcon,
  error: AlertCircleIcon,
} as const

interface AlertProps {
  tone?: AlertTone
  title?: string
  children?: ReactNode
  action?: ReactNode
  /** "alert" for errors raised by a user action, "status" for polite updates. */
  role?: 'alert' | 'status'
  className?: string
  /** Focus target after a failed submit (tabIndex -1 makes it focusable by script only). */
  ref?: Ref<HTMLDivElement>
  focusable?: boolean
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  role,
  className,
  ref,
  focusable = false,
}: AlertProps) {
  const Icon = ALERT_ICONS[tone]
  return (
    <div
      ref={ref}
      className={['alert', `alert--${tone}`, className].filter(Boolean).join(' ')}
      role={role}
      tabIndex={focusable ? -1 : undefined}
    >
      <Icon className="alert__icon" />
      <div className="alert__body">
        {title && <p className="alert__title">{title}</p>}
        {children && <div className="alert__text">{children}</div>}
      </div>
      {action && <div className="alert__action">{action}</div>}
    </div>
  )
}
