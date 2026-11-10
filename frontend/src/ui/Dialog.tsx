import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { CloseIcon } from './icons'
import './dialog.css'

interface DialogProps {
  open: boolean
  title: string
  description?: ReactNode
  onClose: () => void
  children?: ReactNode
  /** Buttons row; rendered after the content. */
  footer?: ReactNode
  /** Blocks closing with Esc or the close button while something is being saved. */
  busy?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Accessible modal built on the native <dialog>: the browser traps focus, makes the rest of the page
 * inert and closes on Esc. Focus returns to the element that opened it.
 */
export function Dialog({ open, title, description, onClose, children, footer, busy = false, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || !open) return undefined
    if (!dialog.open) {
      openerRef.current = document.activeElement as HTMLElement | null
      dialog.showModal()
    }
    // Runs when `open` turns false or on unmount (also StrictMode's extra mount/unmount):
    // close and give focus back to whatever opened the dialog.
    return () => {
      if (dialog.open) dialog.close()
      openerRef.current?.focus?.()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault() // Esc: let React state decide
        if (!busy) onClose()
      }}
    >
      <div className="dialog__header">
        <h2 id={titleId} className="dialog__title">
          {title}
        </h2>
        <button type="button" className="dialog__close" onClick={onClose} disabled={busy} aria-label="Cerrar">
          <CloseIcon />
        </button>
      </div>
      {description && (
        <div id={descriptionId} className="dialog__description">
          {description}
        </div>
      )}
      {children && <div className="dialog__body">{children}</div>}
      {footer && <div className="dialog__footer">{footer}</div>}
    </dialog>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  /** Destructive actions use the danger style (never the primary color). */
  destructive?: boolean
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      busy={busy}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={busy}
            loadingText="Procesando…"
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
