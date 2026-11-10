import { useServerWakeUp } from '@/api/system'
import { useAuth } from '@/auth/useAuth'
import { useDocumentTitle } from '@/lib/hooks'
import { ArrowRightIcon, LinkButton } from '@/ui'
import './landing.css'

// Temporary landing: hero and access CTA only. The full landing (RF-01/RF-02 sections:
// value proposition, features, how it works, CTA) is a separate task.
export default function LandingPage() {
  useDocumentTitle(null)
  useServerWakeUp() // free hosting sleeps when idle: start waking it as soon as someone arrives
  const { status } = useAuth()
  const signedIn = status === 'authenticated'
  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero__inner">
        <p className="landing-hero__eyebrow">Monitoreo de flotas conectado a Wialon</p>
        <h1 id="landing-title" className="landing-hero__title">
          Tu flota, en tiempo real y bajo control
        </h1>
        <p className="landing-hero__lead">
          Consulta la posición y el estado de cada vehículo, administra conductores y pasajeros y
          revisa recorridos desde un panel seguro con permisos por rol.
        </p>
        <div className="landing-hero__actions">
          {signedIn ? (
            <LinkButton to="/app/dashboard" icon={<ArrowRightIcon />}>
              Ir al panel
            </LinkButton>
          ) : (
            <LinkButton to="/login">Iniciar sesión</LinkButton>
          )}
        </div>
      </div>
    </section>
  )
}
