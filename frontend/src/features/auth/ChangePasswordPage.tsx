import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { getErrorMessage, isApiError } from '@/api/errors'
import { DEFAULT_APP_PATH } from '@/auth/redirect'
import { useAuth } from '@/auth/useAuth'
import { useDocumentTitle } from '@/lib/hooks'
import { Alert, Brand, Button, Card, CheckCircleIcon, CircleIcon, PasswordField, useToast } from '@/ui'
import { passwordRules, type PasswordRule } from './passwordPolicy'
import '@/styles/panel-theme.css'
import './auth.css'

const CHECKLIST_ID = 'new-password-rules'

function buildSchema(rules: readonly PasswordRule[]) {
  return z
    .object({
      currentPassword: z.string().min(1, { error: 'Ingresa tu contraseña actual.' }),
      newPassword: z
        .string()
        .min(1, { error: 'Ingresa la nueva contraseña.' })
        .refine((value) => rules.every((rule) => rule.test(value)), {
          error: 'La nueva contraseña no cumple todos los requisitos de la lista.',
        }),
      confirmPassword: z.string().min(1, { error: 'Repite la nueva contraseña.' }),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ['confirmPassword'],
      error: 'Las contraseñas no coinciden.',
    })
    .refine((values) => values.newPassword !== values.currentPassword, {
      path: ['newPassword'],
      error: 'La nueva contraseña debe ser diferente de la actual.',
    })
}

type FormValues = z.input<ReturnType<typeof buildSchema>>

const SERVER_FIELDS = {
  current_password: 'currentPassword',
  new_password: 'newPassword',
} as const

/** Mandatory first change of a temporary password, also available voluntarily (RF-06). */
export default function ChangePasswordPage() {
  useDocumentTitle('Cambiar contraseña')
  const { user, changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const rules = useMemo(() => passwordRules(user?.email), [user?.email])
  const schema = useMemo(() => buildSchema(rules), [rules])

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const newPassword = useWatch({ control, name: 'newPassword' }) ?? ''

  useEffect(() => {
    if (formError) errorRef.current?.focus()
  }, [formError])

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword: next }) => {
    setFormError(null)
    try {
      await changePassword(currentPassword, next)
      toast.show({ tone: 'success', title: 'Contraseña actualizada' })
      navigate(DEFAULT_APP_PATH, { replace: true })
    } catch (error) {
      if (!isApiError(error)) {
        setFormError(getErrorMessage(error))
        return
      }
      let mapped = false
      for (const [field, key] of Object.entries(SERVER_FIELDS)) {
        const message = error.fieldErrors[field]
        if (message) {
          setError(key, { message })
          mapped = true
        }
      }
      if (error.code === 'invalid_credentials') {
        setError('currentPassword', { message: 'La contraseña actual no es correcta.' })
        mapped = true
      }
      if (!mapped) setFormError(error.detail)
    }
  })

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      setFormError(getErrorMessage(error))
    }
  }

  return (
    <main id="main" className="auth-page auth-page--password">
      <div className="auth-page__panel">
        <div className="auth-page__brand">
          <Brand to="/" />
        </div>
        <Card as="section" className="auth-card" aria-labelledby="change-password-title">
          <h1 id="change-password-title" className="auth-card__title">
            Cambiar contraseña
          </h1>
          {user?.must_change_password ? (
            <Alert tone="info" title="Debes crear una contraseña propia">
              Por seguridad, reemplaza la contraseña temporal antes de usar la plataforma.
            </Alert>
          ) : (
            <p className="auth-card__intro">Elige una contraseña nueva para tu cuenta.</p>
          )}
          {formError && (
            <Alert ref={errorRef} focusable tone="error" role="alert" title="No pudimos cambiar la contraseña">
              {formError}
            </Alert>
          )}

          <form className="auth-form" noValidate onSubmit={onSubmit}>
            <PasswordField
              label="Contraseña actual"
              autoComplete="current-password"
              isRequired
              error={errors.currentPassword?.message}
              {...register('currentPassword')}
            />
            <PasswordField
              label="Nueva contraseña"
              autoComplete="new-password"
              isRequired
              describedBy={CHECKLIST_ID}
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />
            <div className="password-rules">
              <p className="password-rules__title" id={`${CHECKLIST_ID}-title`}>
                La nueva contraseña debe tener:
              </p>
              {/* Not a live region: re-announcing on every keystroke would be noise. */}
              <ul id={CHECKLIST_ID} role="list" className="password-rules__list">
                {rules.map((rule) => {
                  const met = rule.test(newPassword)
                  return (
                    <li key={rule.id} className={met ? 'password-rule is-met' : 'password-rule'}>
                      {met ? (
                        <CheckCircleIcon className="password-rule__icon" />
                      ) : (
                        <CircleIcon className="password-rule__icon" />
                      )}
                      <span>{rule.label}</span>
                      <span className="visually-hidden">{met ? ' (cumplido)' : ' (pendiente)'}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
            <PasswordField
              label="Confirmar nueva contraseña"
              autoComplete="new-password"
              isRequired
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Button type="submit" fullWidth loading={isSubmitting} loadingText="Guardando…">
              Guardar contraseña
            </Button>
          </form>
          <Button variant="ghost" fullWidth onClick={handleLogout}>
            Cancelar y cerrar sesión
          </Button>
        </Card>
      </div>
    </main>
  )
}
