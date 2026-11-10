import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { useServerWakeUp } from '@/api/system'
import { getPostLoginPath, wasLoggedOut } from '@/auth/redirect'
import { useAuth } from '@/auth/useAuth'
import { useDocumentTitle } from '@/lib/hooks'
import { Alert, Brand, Button, Card, PasswordField, TextField } from '@/ui'
import '@/styles/panel-theme.css'
import './auth.css'

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: 'Ingresa tu correo electrónico.' })
    .pipe(z.email({ error: 'Ingresa un correo electrónico válido, por ejemplo nombre@empresa.com.' })),
  password: z.string().min(1, { error: 'Ingresa tu contraseña.' }),
})

type LoginInput = z.input<typeof loginSchema>
type LoginOutput = z.output<typeof loginSchema>

const GENERIC_FAILURE = 'No pudimos iniciar sesión. Inténtalo de nuevo.'

function loginErrorMessage(error: unknown): string {
  if (!isApiError(error)) return GENERIC_FAILURE
  if (error.code === 'rate_limited' && error.retryAfterSeconds) {
    return `Demasiados intentos. Espera ${error.retryAfterSeconds} segundos e inténtalo de nuevo.`
  }
  // The backend answers one generic message for wrong e-mail, wrong password or locked
  // account, so the page never reveals whether an account exists (SEG-07).
  return error.detail
}

export default function LoginPage() {
  useDocumentTitle('Iniciar sesión')
  useServerWakeUp() // users may open /login directly: wake the backend before they submit
  const { status, user, login } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [formError, setFormError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, LoginOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // A failed submit moves focus to the message so it is read and the form is not lost.
  useEffect(() => {
    if (formError) errorRef.current?.focus()
  }, [formError])

  // Single place for the post-login redirect (also covers opening /login while signed in).
  if (status === 'authenticated' && user) {
    const target = user.must_change_password ? '/change-password' : getPostLoginPath(location.state)
    return <Navigate to={target} replace />
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    try {
      await login(email, password)
    } catch (error) {
      if (isApiError(error) && error.code === 'validation_error') {
        for (const field of ['email', 'password'] as const) {
          const message = error.fieldErrors[field]
          if (message) setError(field, { message })
        }
      }
      setFormError(loginErrorMessage(error))
    }
  })

  const expired = searchParams.get('reason') === 'expired'
  const loggedOut = wasLoggedOut(location.state)

  return (
    <main id="main" className="auth-page auth-page--split">
      {/* Product context next to the form on wide screens; hidden on small ones to keep the form first. */}
      <aside className="auth-aside" aria-label="Sobre GPS Comercial">
        <Brand to="/" tone="dark" />
        <div className="auth-aside__body">
          <p className="auth-aside__title">Monitoreo de flotas sobre Wialon</p>
          <ul className="auth-aside__facts" role="list">
            <li>Ubicación y estado de cada vehículo</li>
            <li>Conductores, pasajeros y asignaciones</li>
            <li>Historial de recorridos con reproducción</li>
          </ul>
        </div>
        <p className="auth-aside__note">Las horas se muestran en la zona horaria de Bogotá.</p>
      </aside>
      <div className="auth-page__panel">
        <div className="auth-page__brand">
          <Brand to="/" />
        </div>
        <Card as="section" className="auth-card" aria-labelledby="login-title">
          <h1 id="login-title" className="auth-card__title">
            Iniciar sesión
          </h1>
          <p className="auth-card__intro">
            Ingresa con el correo y la contraseña que te entregó el administrador.
          </p>

          {expired && !formError && (
            <Alert tone="warning" role="status" title="Tu sesión expiró">
              Inicia sesión de nuevo para continuar donde estabas.
            </Alert>
          )}
          {loggedOut && !formError && (
            <Alert tone="success" role="status" title="Cerraste sesión correctamente" />
          )}
          {formError && (
            <Alert
              ref={errorRef}
              focusable
              tone="error"
              role="alert"
              title="No pudimos iniciar sesión"
            >
              {formError}
            </Alert>
          )}

          <form className="auth-form" noValidate onSubmit={onSubmit}>
            <TextField
              label="Correo electrónico"
              type="email"
              inputMode="email"
              autoComplete="username"
              isRequired
              error={errors.email?.message}
              {...register('email')}
            />
            <PasswordField
              label="Contraseña"
              autoComplete="current-password"
              isRequired
              error={errors.password?.message}
              {...register('password')}
            />
            <Button type="submit" fullWidth loading={isSubmitting} loadingText="Ingresando…">
              Ingresar
            </Button>
          </form>
        </Card>
        <p className="auth-page__footer">
          ¿No tienes cuenta? Solo un administrador puede crear usuarios.{' '}
          <Link to="/">Volver al inicio</Link>
        </p>
      </div>
    </main>
  )
}
