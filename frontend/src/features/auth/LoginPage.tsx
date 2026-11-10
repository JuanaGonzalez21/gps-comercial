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
import {
  Alert,
  ArrowRightIcon,
  Brand,
  Button,
  Card,
  ChevronLeftIcon,
  KeyIcon,
  PasswordField,
  TextField,
  UserCogIcon,
} from '@/ui'
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
    formState: { errors, isSubmitting, submitCount },
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
  // Summary after a submit with invalid fields; it updates as each field is corrected.
  const errorCount = Object.keys(errors).length
  const showErrorSummary = submitCount > 0 && errorCount > 0 && !formError

  return (
    <main id="main" className="auth-page auth-page--split">
      {/* Brand panel: a dark column on wide screens and a compact dark band above the form on phones. */}
      <aside className="auth-aside" aria-label="Sobre GPS Comercial">
        <Brand to="/" tone="dark" />
        <div className="auth-aside__body">
          <p className="auth-aside__title">
            Tu flota en tiempo real<span className="auth-aside__title-rest">, en un solo lugar</span>.
          </p>
          <p className="auth-aside__lead">
            Posición, estado y asignaciones de conductores y pasajeros de cada vehículo.
          </p>
        </div>
        <ul className="auth-aside__notes" role="list">
          <li>
            <UserCogIcon className="auth-aside__note-icon" />
            Solo para cuentas creadas por un administrador. No hay registro público.
          </li>
          <li>
            <KeyIcon className="auth-aside__note-icon" />
            En tu primer ingreso deberás cambiar la contraseña.
          </li>
        </ul>
      </aside>
      <div className="auth-page__panel">
        <Card as="section" className="auth-card" aria-labelledby="login-title">
          <h1 id="login-title" className="auth-card__title">
            Iniciar sesión
          </h1>
          <p className="auth-card__intro">
            Usa el correo y la contraseña que te entregó el administrador.
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
          {showErrorSummary && (
            <Alert tone="error" role="alert" title="Revisa los campos marcados.">
              {errorCount === 1 ? 'Hay 1 error.' : `Hay ${errorCount} errores.`}
            </Alert>
          )}

          <form className="auth-form" noValidate onSubmit={onSubmit}>
            <TextField
              label="Correo electrónico"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="nombre@empresa.com"
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
            <Button
              type="submit"
              fullWidth
              icon={<ArrowRightIcon />}
              loading={isSubmitting}
              loadingText="Ingresando…"
            >
              Ingresar
            </Button>
          </form>
          <ul className="auth-help" role="list">
            <li className="auth-help__item">
              <KeyIcon className="auth-help__icon" />
              {/* Short wording on phones and tablets; the design's full sentence on wide screens. */}
              <span className="auth-help__short">
                ¿Olvidaste tu contraseña? Pide al administrador que la restablezca.
              </span>
              <span className="auth-help__full">
                ¿Olvidaste tu contraseña? Comunícate con el administrador de tu empresa para
                restablecerla.
              </span>
            </li>
            {/* Phones and tablets: the brand band only shows the title, so its access note moves here. */}
            <li className="auth-help__item auth-help__item--compact">
              <UserCogIcon className="auth-help__icon" />
              <span>Solo cuentas creadas por el administrador. En tu primer ingreso cambiarás la contraseña.</span>
            </li>
          </ul>
        </Card>
        <Link to="/" className="auth-back">
          <ChevronLeftIcon className="auth-back__icon" />
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
