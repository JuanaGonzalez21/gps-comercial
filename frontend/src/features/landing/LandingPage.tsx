import type { ComponentType } from 'react'
import { useServerWakeUp } from '@/api/system'
import { useAuth } from '@/auth/useAuth'
import { useDocumentTitle } from '@/lib/hooks'
import {
  ArrowRightIcon,
  AuditIcon,
  CheckCircleIcon,
  CrosshairIcon,
  DashboardIcon,
  DownloadIcon,
  HistoryIcon,
  KeyIcon,
  LinkButton,
  MapIcon,
  SteeringWheelIcon,
  type ButtonVariant,
  type IconProps,
} from '@/ui'
import { HeroIllustration } from './HeroIllustration'
import './landing.css'

interface Item {
  icon: ComponentType<IconProps>
  title: string
  text: string
}

const VALUE: readonly Item[] = [
  {
    icon: CrosshairIcon,
    title: 'Visibilidad en tiempo real',
    text: 'Ubica cada vehículo en el mapa, conoce su estado y su velocidad, y detecta a tiempo los que se quedaron sin señal.',
  },
  {
    icon: CheckCircleIcon,
    title: 'Datos claros y confiables',
    text: 'Leemos Wialon desde nuestro servidor y te mostramos datos limpios: hora de Bogotá, km/h, rumbo en puntos cardinales y estado calculado.',
  },
  {
    icon: KeyIcon,
    title: 'Control por roles',
    text: 'Cada persona ve y hace solo lo que su rol permite, y cada cambio importante queda registrado con quién y cuándo.',
  },
]

const FEATURES: readonly Item[] = [
  {
    icon: MapIcon,
    title: 'Mapa en vivo',
    text: 'Posiciones que se actualizan solas, íconos por estado, agrupación de marcadores cercanos y lista sincronizada con el mapa.',
  },
  {
    icon: SteeringWheelIcon,
    title: 'Conductores y pasajeros',
    text: 'Altas, ediciones y bajas sincronizadas con Wialon, asignación a vehículos y campos personalizados sin perder datos.',
  },
  {
    icon: HistoryIcon,
    title: 'Historial y reproducción',
    text: 'Elige un vehículo y un rango de fechas, mira el recorrido en el mapa y reprodúcelo con la velocidad de cada tramo.',
  },
  {
    icon: DashboardIcon,
    title: 'Panel de indicadores',
    text: 'Total de vehículos, distribución por estado, vehículos con y sin conductor, y totales de conductores y pasajeros.',
  },
  {
    icon: DownloadIcon,
    title: 'Exportación CSV',
    text: 'Descarga vehículos, conductores y pasajeros con los mismos filtros de la lista, protegidos contra inyección en hojas de cálculo.',
  },
  {
    icon: AuditIcon,
    title: 'Auditoría y roles',
    text: 'Administrador, Operador y Visualizador con permisos distintos, y un registro de quién hizo qué y cuándo.',
  },
]

const STEPS: readonly { title: string; text: string }[] = [
  {
    title: 'Tu administrador crea tu acceso',
    text: 'No hay registro público. Recibes tu usuario y una contraseña temporal por un canal privado.',
  },
  {
    title: 'Inicias sesión y defines tu contraseña',
    text: 'En el primer ingreso cambias la contraseña temporal por una propia y segura.',
  },
  {
    title: 'Nuestro servidor consulta Wialon',
    text: 'El servidor se conecta a Wialon, valida y transforma los datos. Tu navegador nunca habla directo con Wialon.',
  },
  {
    title: 'Monitoreas y actúas según tu rol',
    text: 'Sigue la flota, gestiona conductores y pasajeros, revisa recorridos y exporta reportes según tus permisos.',
  },
]

const ROLES: readonly { name: string; text: string }[] = [
  {
    name: 'Administrador',
    text: 'Todo lo del Operador, más la gestión de usuarios y roles y el registro de auditoría.',
  },
  {
    name: 'Operador',
    text: 'Crea y edita conductores, pasajeros y campos personalizados, los vincula a vehículos y exporta CSV.',
  },
  {
    name: 'Visualizador',
    text: 'Consulta el panel, el mapa, el detalle de vehículos, conductores, pasajeros e historial, sin modificar datos.',
  },
]

/** RF-03: a signed-in visitor gets a shortcut to the panel instead of the login button. */
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

function CardGrid({ items, headingLevel: Heading = 'h3' }: { items: readonly Item[]; headingLevel?: 'h3' }) {
  return (
    <ul className="landing-cards" role="list">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className="landing-card">
          <span className="landing-card__icon">
            <Icon />
          </span>
          <Heading className="landing-card__title">{title}</Heading>
          <p className="landing-card__text">{text}</p>
        </li>
      ))}
    </ul>
  )
}

/** Public landing (RF-01/RF-02): what the platform does, its modules, how it works and access. */
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
            <p className="landing-eyebrow">Monitoreo de flotas conectado a Wialon</p>
            <h1 id="landing-title" className="landing-hero__title">
              Tu flota, en tiempo real y bajo control
            </h1>
            <p className="landing-hero__lead">
              Consulta la posición y el estado de cada vehículo, administra conductores y pasajeros y
              revisa recorridos desde un panel seguro con permisos por rol.
            </p>
            <div className="landing-hero__actions">
              <AccessCta signedIn={signedIn} />
              <a className="landing-text-link" href="#funcionalidades">
                Ver funcionalidades
              </a>
            </div>
            <ul className="landing-hero__facts" role="list">
              <li>
                <CheckCircleIcon /> Acceso solo con usuario creado por un administrador
              </li>
              <li>
                <CheckCircleIcon /> Fechas y horas en zona horaria de Bogotá
              </li>
            </ul>
          </div>
          <div className="landing-hero__visual">
            <HeroIllustration />
          </div>
        </div>
      </section>

      <section id="propuesta" className="landing-section landing-section--surface" aria-labelledby="value-title">
        <div className="landing-container">
          <p className="landing-kicker">Propuesta de valor</p>
          <h2 id="value-title" className="landing-section__title">
            Toda la operación de tu flota en un solo lugar
          </h2>
          <p className="landing-section__lead">
            Menos llamadas para saber dónde está un vehículo y más decisiones con información
            actualizada.
          </p>
          <CardGrid items={VALUE} />
        </div>
      </section>

      <section id="funcionalidades" className="landing-section" aria-labelledby="features-title">
        <div className="landing-container">
          <p className="landing-kicker">Funcionalidades</p>
          <h2 id="features-title" className="landing-section__title">
            Módulos pensados para el día a día
          </h2>
          <CardGrid items={FEATURES} />
        </div>
      </section>

      <section id="como-funciona" className="landing-section landing-section--surface" aria-labelledby="how-title">
        <div className="landing-container">
          <p className="landing-kicker">Cómo funciona</p>
          <h2 id="how-title" className="landing-section__title">
            De Wialon a tu pantalla en cuatro pasos
          </h2>
          <ol className="landing-steps" role="list">
            {STEPS.map((step, index) => (
              <li key={step.title} className="landing-step">
                <span className="landing-step__number" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="landing-step__title">
                  <span className="visually-hidden">Paso {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="landing-step__text">{step.text}</p>
              </li>
            ))}
          </ol>

          <h3 className="landing-roles__title">Un acceso para cada rol</h3>
          <ul className="landing-roles" role="list">
            {ROLES.map((role) => (
              <li key={role.name} className="landing-role">
                <p className="landing-role__name">{role.name}</p>
                <p className="landing-role__text">{role.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-cta" aria-labelledby="cta-title">
        <div className="landing-container landing-cta__inner">
          <div>
            <h2 id="cta-title" className="landing-cta__title">
              {signedIn ? 'Tu panel está listo' : '¿Listo para ver tu flota?'}
            </h2>
            <p className="landing-cta__text">
              {signedIn && user
                ? `Iniciaste sesión como ${user.full_name}. Continúa donde lo dejaste.`
                : 'Ingresa con el usuario que te entregó tu administrador. ¿Aún no tienes acceso? Pídeselo: por seguridad no hay registro público.'}
            </p>
          </div>
          <AccessCta signedIn={signedIn} variant="secondary" />
        </div>
      </section>
    </div>
  )
}
