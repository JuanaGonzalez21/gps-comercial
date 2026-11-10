import type { ComponentType } from 'react'
import { useServerWakeUp } from '@/api/system'
import { useAuth } from '@/auth/useAuth'
import { useDocumentTitle } from '@/lib/hooks'
import {
  ArrowRightIcon,
  AuditIcon,
  CheckIcon,
  EyeIcon,
  HistoryIcon,
  LinkButton,
  MapIcon,
  SteeringWheelIcon,
  UserCogIcon,
  UsersIcon,
  type ButtonVariant,
  type IconProps,
} from '@/ui'
import coordinadora720 from './assets/coordinadora-tablet-720.webp'
import coordinadora from './assets/coordinadora-tablet.webp'
import flota720 from './assets/flota-furgoneta-camion-720.webp'
import flota from './assets/flota-furgoneta-camion.webp'
import './landing.css'

const CAPABILITIES: { title: string; text: string; Icon: ComponentType<IconProps> }[] = [
  { title: 'Ubica tu flota', text: 'Consulta posiciones y estados de tus vehículos.', Icon: MapIcon },
  { title: 'Organiza tu operación', text: 'Gestiona conductores, pasajeros y sus asignaciones.', Icon: UsersIcon },
  { title: 'Revisa cada recorrido', text: 'Consulta el historial y visualiza los trayectos.', Icon: HistoryIcon },
]

const EDITORIAL_POINTS = [
  'Ubicación y estado de los vehículos.',
  'Conductores y pasajeros organizados.',
  'Historial disponible para consulta.',
]

const STEPS = [
  { title: 'Encuentra un vehículo', text: 'Búscalo por nombre o filtra la lista por estado.' },
  { title: 'Consulta su ubicación y detalle', text: 'Posición, estado, conductor y pasajeros asignados.' },
  { title: 'Revisa su recorrido', text: 'Elige un periodo y reproduce el trayecto en el mapa.' },
]

// Wording checked against ROLE_PERMISSIONS in backend/app/domain/permissions.py.
// Operators edit people, assignments and vehicle custom fields; they cannot create vehicles in Wialon.
const ROLES: { name: string; text: string; Icon: ComponentType<IconProps> }[] = [
  { name: 'Administrador', text: 'Gestiona usuarios, permisos y operación.', Icon: UserCogIcon },
  {
    name: 'Operador',
    text: 'Gestiona personas, asignaciones y campos de los vehículos según sus permisos.',
    Icon: SteeringWheelIcon,
  },
  { name: 'Visualizador', text: 'Consulta la información sin modificarla.', Icon: EyeIcon },
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

/** Conceptual route sketch for the "how it works" block: not a map and not real data. */
function RouteSketch() {
  return (
    <svg className="landing-route" viewBox="0 0 320 120" aria-hidden="true" focusable="false">
      <path className="landing-route__path" d="M24 92 C 88 92, 96 28, 160 40 S 248 96, 296 28" />
      <circle className="landing-route__start" cx="24" cy="92" r="7" />
      <circle className="landing-route__end" cx="296" cy="28" r="9" />
      <circle className="landing-route__end-dot" cx="296" cy="28" r="3.5" />
    </svg>
  )
}

export default function LandingPage() {
  useDocumentTitle(null)
  useServerWakeUp() // free hosting sleeps when idle: start waking it as soon as someone arrives
  const { status, user } = useAuth()
  const signedIn = status === 'authenticated'

  return (
    <div className="landing">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-container landing-hero__grid">
          <div className="landing-hero__copy">
            <p className="landing-kicker">Gestión y monitoreo de flotas</p>
            <h1 id="landing-title" className="landing-hero__title">
              <span>Tu flota conectada.</span> <span>Tu operación bajo control.</span>
            </h1>
            <p className="landing-hero__lead">
              Consulta vehículos, organiza conductores y pasajeros, y revisa recorridos desde un mismo lugar.
            </p>
            <div className="landing-hero__actions">
              <AccessCta signedIn={signedIn} />
              <a className="landing-link" href="#funcionalidades">
                Explorar funcionalidades
              </a>
            </div>
          </div>
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
            <p className="landing-hero__tag">Integración con Wialon</p>
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="landing-strip" aria-labelledby="funcionalidades-title">
        <div className="landing-container">
          <h2 id="funcionalidades-title" className="visually-hidden">
            Funcionalidades
          </h2>
          <ul className="landing-strip__list" role="list">
            {CAPABILITIES.map(({ title, text, Icon }) => (
              <li key={title} className="landing-strip__item">
                <Icon className="landing-strip__icon" aria-hidden="true" />
                <div>
                  <h3 className="landing-strip__title">{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-section landing-editorial" aria-labelledby="vision-title">
        <div className="landing-container landing-editorial__grid">
          <img
            className="landing-editorial__photo"
            src={coordinadora}
            srcSet={`${coordinadora720} 720w, ${coordinadora} 1200w`}
            sizes="(min-width: 56rem) 34rem, calc(100vw - 2rem)"
            width={1200}
            height={900}
            alt="Fotografía ilustrativa: una coordinadora consulta una tablet junto a furgonetas de reparto"
            loading="lazy"
            decoding="async"
          />
          <div className="landing-editorial__copy">
            <h2 id="vision-title" className="landing-section__title">
              Una visión clara de lo que pasa en tu flota.
            </h2>
            <p className="landing-section__lead">
              Reúne la información que necesitas para consultar tus vehículos y gestionar las personas asignadas a cada
              operación.
            </p>
            <ul className="landing-points" role="list">
              {EDITORIAL_POINTS.map((point) => (
                <li key={point}>
                  <CheckIcon aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="landing-section landing-section--dark" aria-labelledby="como-funciona-title">
        <div className="landing-container landing-how">
          <div>
            <p className="landing-kicker landing-kicker--on-dark">Cómo funciona</p>
            <h2 id="como-funciona-title" className="landing-section__title">
              De una consulta a una decisión, en pocos pasos.
            </h2>
            <ol className="landing-steps" role="list">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="landing-steps__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="landing-steps__title">{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <figure className="landing-sample" aria-label="Vista ilustrativa de la ficha de un vehículo y su recorrido">
            <p className="landing-sample__label">Vista ilustrativa</p>
            <div className="landing-sample__card">
              <div className="landing-sample__head">
                <p className="landing-sample__name">Vehículo de ejemplo</p>
                <span className="landing-sample__status">En movimiento</span>
              </div>
              <dl className="landing-sample__facts">
                <div>
                  <dt>Conductor</dt>
                  <dd>Conductor asignado</dd>
                </div>
                <div>
                  <dt>Pasajeros</dt>
                  <dd>Vinculados al vehículo</dd>
                </div>
              </dl>
              <div className="landing-sample__route">
                <RouteSketch />
                <div className="landing-sample__ends">
                  <span>Origen</span>
                  <span>Destino</span>
                </div>
              </div>
            </div>
          </figure>
        </div>
      </section>

      <section id="control-de-acceso" className="landing-section landing-access" aria-labelledby="acceso-title">
        <div className="landing-container landing-access__grid">
          <div>
            <p className="landing-kicker">Control de acceso</p>
            <h2 id="acceso-title" className="landing-section__title">
              Un equipo conectado. Responsabilidades claras.
            </h2>
            <p className="landing-section__lead">Cada persona accede a las herramientas que necesita para su trabajo.</p>
            <p className="landing-audit">
              <AuditIcon aria-hidden="true" />
              Operaciones registradas para su consulta.
            </p>
          </div>
          <ul className="landing-roles" role="list">
            {ROLES.map(({ name, text, Icon }) => (
              <li key={name} className="landing-roles__row">
                <span className="landing-roles__icon" aria-hidden="true">
                  <Icon />
                </span>
                <div>
                  <h3 className="landing-roles__name">{name}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-cta" aria-labelledby="cta-title">
        <div className="landing-container landing-cta__inner">
          <div>
            <h2 id="cta-title" className="landing-cta__title">
              Tu próxima consulta empieza aquí.
            </h2>
            <p className="landing-cta__text">
              {signedIn && user
                ? `Iniciaste sesión como ${user.full_name}. Continúa con tu operación.`
                : 'Accede a tu flota y continúa con tu operación.'}
            </p>
          </div>
          <AccessCta signedIn={signedIn} variant="secondary" />
        </div>
      </section>
    </div>
  )
}
