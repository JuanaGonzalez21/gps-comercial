import { useEffect, useRef, useState } from 'react'
import type { UserOut } from '@/api/types'
import { Alert, Button, CheckIcon, Dialog, KeyIcon } from '@/ui'

type CopyState = 'idle' | 'copied' | 'manual'

interface TemporaryPasswordDialogProps {
  user: UserOut
  password: string
  reason: 'created' | 'reset'
  onClose: () => void
}

/**
 * Shows a temporary password exactly once (RF-06). It lives only in this component's props: it is
 * not cached, stored or logged, and closing the dialog discards it. A lost password is replaced
 * with another reset.
 */
export function TemporaryPasswordDialog({ user, password, reason, onClose }: TemporaryPasswordDialogProps) {
  const valueRef = useRef<HTMLElement>(null)
  const copyRef = useRef<HTMLButtonElement>(null)
  const [copy, setCopy] = useState<CopyState>('idle')

  // Start on the copy button (the native dialog would focus the close button first).
  useEffect(() => {
    const frame = requestAnimationFrame(() => copyRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  const selectValue = () => {
    const node = valueRef.current
    const selection = window.getSelection?.()
    if (!node || !selection) return
    const range = document.createRange()
    range.selectNodeContents(node)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const copyPassword = async () => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(password)
      setCopy('copied')
    } catch {
      // Without clipboard access (permissions, insecure context) the text is selected for Ctrl+C.
      selectValue()
      setCopy('manual')
    }
  }

  return (
    <Dialog
      open
      title={reason === 'created' ? 'Usuario creado' : 'Contraseña restablecida'}
      description={
        <p>
          Contraseña temporal para <strong>{user.full_name}</strong> ({user.email}).
        </p>
      }
      onClose={onClose}
      footer={<Button onClick={onClose}>Entendido, cerrar</Button>}
    >
      <div className="temp-password">
        <Alert tone="warning" title="Se muestra una sola vez">
          <p>
            Cópiala ahora y entrégala por un canal privado (en persona o por un mensaje directo). No
            la compartas en chats grupales, correos con copia ni documentos.
          </p>
          <p>
            Al cerrar esta ventana no podrás volver a verla; si se pierde, restablécela de nuevo. La
            persona deberá cambiarla en su primer inicio de sesión.
          </p>
        </Alert>
        <div className="temp-password__box">
          <p className="temp-password__label">
            <KeyIcon /> Contraseña temporal
          </p>
          <code ref={valueRef} className="temp-password__value mono" translate="no">
            {password}
          </code>
          <Button
            ref={copyRef}
            variant="secondary"
            size="sm"
            icon={copy === 'copied' ? <CheckIcon /> : undefined}
            onClick={() => void copyPassword()}
          >
            {copy === 'copied' ? 'Copiada' : 'Copiar contraseña'}
          </Button>
        </div>
        <p className="temp-password__status" role="status">
          {copy === 'copied' && 'Contraseña copiada al portapapeles.'}
          {copy === 'manual' &&
            'No se pudo copiar automáticamente. La contraseña quedó seleccionada: cópiala con Ctrl+C (o Cmd+C).'}
        </p>
      </div>
    </Dialog>
  )
}
