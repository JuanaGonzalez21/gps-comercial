import { useEffect, useRef, type RefObject } from 'react'
import { useServerWakeUp } from '@/api/system'
import { useAuth } from '@/auth/useAuth'
import { useDocumentTitle } from '@/lib/hooks'
import { ArrowRightIcon, LinkButton, type ButtonVariant } from '@/ui'
import conductor600 from './assets/coordinadora-conductor-600.webp'
import conductor from './assets/coordinadora-conductor.webp'
import flota720 from './assets/flota-furgoneta-camion-720.webp'
import flota from './assets/flota-furgoneta-camion.webp'
import patio600 from './assets/flota-patio-vertical-600.webp'
import patio from './assets/flota-patio-vertical.webp'
import './landing.css'

// Layout and copy follow the Claude Design landing (2026-11-10). Every claim maps to a feature that exists today.
const FEATURES = [
  {
    label: 'Ubicación',
    title: 'Saber dónde está cada vehículo.',
    text: 'Consulta en el mapa la ubicación y el estado de cada unidad, con la información que llega desde Wialon.',
    points: ['Mapa de la flota', 'Búsqueda por nombre', 'Filtro por estado'],
  },
  {
    label: 'Personas',
    title: 'Conductores y pasajeros, en orden.',
    text: 'Registra quién conduce cada vehículo y qué pasajeros tiene asignados, para que todo el equipo consulte los mismos datos.',
    points: ['Conductor asignado', 'Pasajeros vinculados', 'Asignaciones por vehículo'],
  },
  {
    label: 'Historial',
    title: 'Recorridos con contexto.',
    text: 'Elige un periodo y reproduce el trayecto de un vehículo cuando necesites entender qué ocurrió y en qué orden.',
    points: ['Selección de periodo', 'Reproducción en el mapa'],
  },
]

const STEPS = [
  { title: 'Accede a tu operación.', text: 'Inicia sesión con una cuenta autorizada.' },
  { title: 'Consulta y organiza.', text: 'Revisa vehículos y gestiona la información según tu rol.' },
  { title: 'Revisa el recorrido.', text: 'Consulta el historial para entender lo ocurrido.' },
]

// Checked against the vehicle list (name search, status filter) and the vehicle detail page.
const FLEET_CONTROL = [
  {
    title: 'Encuentra la unidad',
    text: 'Busca por nombre y filtra por estado para localizar el vehículo que necesitas.',
  },
  {
    title: 'Consulta su situación',
    text: 'Revisa su posición, velocidad y última actualización. Identifica cuándo falta información o la unidad está sin señal.',
  },
  {
    title: 'Abre su detalle',
    text: 'Consulta el conductor, los pasajeros y los campos disponibles, y accede al historial del vehículo.',
  },
]

function AccessCta({ signedIn, variant = 'primary' }: { signedIn: boolean; variant?: ButtonVariant }) {
  return signedIn ? (
    <LinkButton to="/app/dashboard" variant={variant} icon={<ArrowRightIcon />}>
      Ir al panel
    </LinkButton>
  ) : (
    <LinkButton to="/login" variant={variant}>
      Iniciar sesión
    </LinkButton>
  )
}

/**
 * One-time reveal of the blocks below the hero as they enter the viewport. Without IntersectionObserver
 * or with "reduce motion" every block is shown at once; the hero is never hidden (it holds the LCP).
 */
function useScrollReveal(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = root.current
    if (!element) return
    const targets = [...element.querySelectorAll<HTMLElement>('[data-reveal]')]
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      for (const target of targets) target.dataset.reveal = 'in'
      return
    }
    element.classList.add('landing--reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).dataset.reveal = 'in'
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    for (const target of targets) observer.observe(target)
    return () => observer.disconnect()
  }, [root])
}

export default function LandingPage() {
  useDocumentTitle(null)
  useServerWakeUp() // free hosting sleeps when idle: start waking it as soon as someone arrives
  const { status } = useAuth()
  const signedIn = status === 'authenticated'
  const rootRef = useRef<HTMLDivElement>(null)
  useScrollReveal(rootRef)

  return (
    <div className="landing" ref={rootRef}>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-container landing-hero__grid">
          <div className="landing-hero__copy">
            <p className="landing-kicker">Gestión y monitoreo de flotas</p>
            <h1 id="landing-title" className="landing-hero__title">
              <span>Tu flota conectada.</span> <span>Tu equipo informado.</span>
            </h1>
            <p className="landing-hero__lead">
              Consulta dónde están tus vehículos, organiza conductores y pasajeros y revisa sus recorridos desde un mismo
              lugar.
            </p>
            <div className="landing-hero__actions">
              <AccessCta signedIn={signedIn} />
              <a className="landing-link" href="#funcionalidades">
                Conocer la plataforma
                <ArrowRightIcon aria-hidden="true" />
              </a>
            </div>
            <p className="landing-hero__note">Información de tus unidades integrada con Wialon.</p>
          </div>
          {/* Same image composition as the previous landing (Juana's choice): vehicles over one flat teal shape. */}
          <div className="landing-hero__visual">
            <div className="landing-hero__shape" aria-hidden="true" />
            <img
              className="landing-hero__vehicles"
              src={flota}
              srcSet={`${flota720} 720w, ${flota} 1400w`}
              sizes="(min-width: 64rem) 40rem, calc(100vw - 2rem)"
              width={1400}
              height={660}
              alt="Ilustración de una furgoneta y un camión de reparto blancos"
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="funcionalidades-title">
        {/* Anchor on the content, not the section, so the link lands on the text instead of the top padding. */}
        <div id="funcionalidades" className="landing-container landing-features">
          <div className="landing-features__intro" data-reveal="">
            <p className="landing-kicker">Funcionalidades</p>
            <h2 id="funcionalidades-title" className="landing-title">
              Lo que necesitas saber, en el momento en que lo necesitas.
            </h2>
            <p className="landing-lead">
              Tres consultas que forman parte del día a día de quien coordina vehículos y equipos.
            </p>
            <figure className="landing-features__photo">
              <img
                src={patio}
                srcSet={`${patio600} 600w, ${patio} 1024w`}
                sizes="(min-width: 56rem) 28rem, calc(100vw - 2rem)"
                width={1024}
                height={1536}
                alt="Fotografía ilustrativa: furgonetas blancas estacionadas en fila frente a una bodega"
                loading="lazy"
                decoding="async"
              />
              <figcaption>Fotografía ilustrativa</figcaption>
            </figure>
          </div>
          <ol className="landing-features__list" role="list">
            {FEATURES.map((feature, index) => (
              <li key={feature.label} className="landing-feature" data-reveal="">
                <span className="landing-feature__number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="landing-feature__label">{feature.label}</p>
                <h3 className="landing-feature__title">{feature.title}</h3>
                <p className="landing-feature__text">{feature.text}</p>
                <ul className="landing-feature__points" role="list">
                  {feature.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-section landing-section--dark" aria-labelledby="trabajo-title">
        <div id="como-trabajamos" className="landing-container">
          <div className="landing-work__header" data-reveal="">
            <div>
              <p className="landing-kicker landing-kicker--on-dark">Cómo trabajamos</p>
              <h2 id="trabajo-title" className="landing-title">
                Una consulta, de principio a fin.
              </h2>
            </div>
            <p className="landing-work__intro">
              Así se recorre la plataforma en una jornada habitual, según el rol de cada persona.
            </p>
          </div>
          <ol className="landing-work__steps" role="list">
            {STEPS.map((step, index) => (
              <li key={step.title} data-reveal="">
                <span className="landing-work__number" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="landing-work__title">{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="control-de-tu-flota" className="landing-control" aria-labelledby="control-title">
        <div className="landing-control__media">
          <img
            className="landing-control__photo"
            src={conductor}
            srcSet={`${conductor600} 600w, ${conductor} 1024w`}
            sizes="(min-width: 56rem) 50vw, 100vw"
            width={1024}
            height={1536}
            alt="Fotografía ilustrativa: una coordinadora y un conductor revisan una tablet junto a una furgoneta"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="landing-control__content" data-reveal="">
          <p className="landing-kicker">Control de tu flota</p>
          <h2 id="control-title" className="landing-title">
            Cada vehículo, con su información a la vista.
          </h2>
          <p className="landing-lead">
            Desde el monitoreo puedes localizar una unidad y consultar los datos disponibles para entender su situación.
          </p>
          <ul className="landing-control__list" role="list">
            {FLEET_CONTROL.map((item) => (
              <li key={item.title}>
                <h3 className="landing-control__title">{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
          <p className="landing-control__note">Las acciones disponibles dependen de los permisos de tu cuenta.</p>
        </div>
      </section>

      <section className="landing-cta" aria-labelledby="cta-title">
        <div className="landing-container landing-cta__inner" data-reveal="">
          <h2 id="cta-title" className="landing-cta__title">
            Todo listo para consultar tu flota.
          </h2>
          <div className="landing-cta__side">
            <p>Accede con tu cuenta autorizada y continúa con tu operación.</p>
            <AccessCta signedIn={signedIn} variant="secondary" />
          </div>
        </div>
      </section>
    </div>
  )
}
