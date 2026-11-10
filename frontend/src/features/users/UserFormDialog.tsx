import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { getErrorMessage, isApiError } from '@/api/errors'
import type { UserOut } from '@/api/types'
import { Alert, Button, Dialog, SelectField, TextField, type SelectOption } from '@/ui'
import { isRoleCode, ROLE_SUMMARIES } from './roles'
import { USER_FORM_FIELDS, userFormSchema, type UserFormInput, type UserFormOutput } from './userSchema'

const UNCERTAIN_CREATE_HINT =
  ' Si el usuario aparece en la lista, usa «Restablecer» para generarle una contraseña temporal nueva.'

interface UserFormDialogProps {
  mode: 'create' | 'edit'
  /** The user being edited (edit mode). */
  user?: UserOut
  /** Editing the signed-in admin: the role is locked (the backend answers 409 otherwise). */
  isSelf?: boolean
  roleOptions: readonly SelectOption[]
  onClose: () => void
  /** Saves and resolves on success; a rejected ApiError is shown on its fields or as a form alert. */
  onSubmit: (values: UserFormOutput) => Promise<void>
}

/** One dialog for creating and editing users (no separate screen per modal). */
export function UserFormDialog({ mode, user, isSelf = false, roleOptions, onClose, onSubmit }: UserFormDialogProps) {
  const formId = useId()
  const [formError, setFormError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const creating = mode === 'create'

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UserFormInput, unknown, UserFormOutput>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: user?.email ?? '',
      full_name: user?.full_name ?? '',
      role: user?.role.code ?? 'viewer',
    },
  })
  const selectedRole = useWatch({ control, name: 'role' })

  useEffect(() => {
    if (formError) errorRef.current?.focus()
  }, [formError])

  // The native dialog focuses its first control (the close button) when it opens; one frame later
  // move to the first field so keyboard users can type straight away.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFocus(creating ? 'email' : 'full_name'))
    return () => cancelAnimationFrame(frame)
  }, [creating, setFocus])

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      if (!isApiError(error)) {
        setFormError(getErrorMessage(error))
        return
      }
      let mapped = false
      for (const field of USER_FORM_FIELDS) {
        const message = error.fieldErrors[field]
        if (message) {
          setError(field, { message }, { shouldFocus: !mapped })
          mapped = true
        }
      }
      if (!mapped && creating && error.code === 'conflict') {
        // The only creation conflict is a duplicated e-mail.
        setError('email', { message: error.detail }, { shouldFocus: true })
        mapped = true
      }
      if (!mapped) {
        setFormError(creating && error.status === 0 ? error.detail + UNCERTAIN_CREATE_HINT : error.detail)
      }
    }
  })

  const roleHint = isSelf
    ? 'No puedes cambiar el rol de tu propia cuenta. Otro administrador puede hacerlo.'
    : isRoleCode(selectedRole)
      ? ROLE_SUMMARIES[selectedRole]
      : undefined

  return (
    <Dialog
      open
      title={creating ? 'Crear usuario' : `Editar a ${user?.full_name ?? 'usuario'}`}
      description={
        creating
          ? 'Generaremos una contraseña temporal que verás una sola vez. La persona deberá cambiarla en su primer inicio de sesión.'
          : undefined
      }
      onClose={onClose}
      busy={isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={isSubmitting}
            loadingText={creating ? 'Creando…' : 'Guardando…'}
          >
            {creating ? 'Crear usuario' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form id={formId} className="user-form" noValidate onSubmit={submit}>
        {formError && (
          <Alert
            ref={errorRef}
            focusable
            tone="error"
            role="alert"
            title={creating ? 'No se pudo crear el usuario' : 'No se pudieron guardar los cambios'}
          >
            {formError}
          </Alert>
        )}
        {creating ? (
          <TextField
            label="Correo electrónico"
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            isRequired
            maxLength={254}
            hint="Será su usuario para iniciar sesión."
            error={errors.email?.message}
            {...register('email')}
          />
        ) : (
          <TextField
            label="Correo electrónico"
            type="email"
            readOnly
            defaultValue={user?.email}
            hint="El correo no se puede cambiar."
          />
        )}
        <TextField
          label="Nombre completo"
          autoComplete="off"
          isRequired
          maxLength={120}
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        {isSelf ? (
          <SelectField label="Rol" options={roleOptions} defaultValue={user?.role.code} disabled hint={roleHint} />
        ) : (
          <SelectField
            label="Rol"
            options={roleOptions}
            isRequired
            hint={roleHint}
            error={errors.role?.message}
            {...register('role')}
          />
        )}
      </form>
    </Dialog>
  )
}
