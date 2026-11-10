import type { ReactNode } from 'react'
import { getErrorMessage } from '@/api/errors'
import { Alert, ConfirmDialog } from '@/ui'

interface ConfirmActionProps {
  title: string
  message: ReactNode
  confirmLabel: string
  destructive?: boolean
  busy: boolean
  /** Failure of the last attempt: shown inside the dialog, which stays open to retry or cancel. */
  error: unknown
  errorTitle: string
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation for delete/unassign (UX-04) that keeps the failure visible next to the buttons. */
export function ConfirmAction({
  title,
  message,
  confirmLabel,
  destructive = true,
  busy,
  error,
  errorTitle,
  onConfirm,
  onCancel,
}: ConfirmActionProps) {
  return (
    <ConfirmDialog
      open
      title={title}
      confirmLabel={confirmLabel}
      destructive={destructive}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
      description={
        <div className="roster-form">
          <p>{message}</p>
          {error ? (
            <Alert tone="error" role="alert" title={errorTitle}>
              {getErrorMessage(error)}
            </Alert>
          ) : null}
        </div>
      }
    />
  )
}
