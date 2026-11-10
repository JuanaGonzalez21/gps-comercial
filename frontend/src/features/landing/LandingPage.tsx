import type { ComponentType } from 'react'
import { useServerWakeUp } from '@/api/system'
import { useAuth } from '@/auth/useAuth'
import { useDocumentTitle } from '@/lib/hooks'
import {
  ArrowRightIcon,
  AuditIcon,
  CheckIcon,
  KeyIcon,
  LinkButton,
  UserCogIcon,
  MapIcon,
  type ButtonVariant,
  type IconProps,
} from '@/ui'
import conductores from './assets/producto-conductores.webp'
import historial from './assets/producto-historial.webp'
import panel from './assets/producto-panel.webp'
import seleccion from './assets/producto-seleccion.webp'
import vehiculos720 from './assets/producto-vehiculos-720.webp'
import vehiculos from './assets/producto-vehiculos.webp'
import './landing.css'

// Every product image is a real screenshot of this application taken with SIMULATED data
// (FLEET_GATEWAY=fake): no customer names, IMEIs, phones, coordinates or routes are published.
interface Capability {
  id: string
  title: string
  text: string
  points: readonly string[]
  image: { src: string; width: number; height: number; alt: string }
}

const CAPABILITIES: readonly Capability[] = [
  {
    id: 'ubicacion',
    title: 'Ubicación y estado de la flota',
    text: 'Un panel resume cuántos vehículos están en movimiento, detenidos o sin señal, y cuántos tienen conductor asignado.',
    points: [
      'Estado calculado con reglas documentadas: velocidad y antigüedad del último reporte.',
      'Cada indicador lleva a la lista ya filtrada.',
    ],
    image: {
      src: panel,
      width: 1100,
      height: 779,
      alt: 'Panel con indicadores de flota y gráficas de distribución por estado (datos simulados)',
    },
  },
  {
    id: 'personas',
    title: 'Conductores y pasajeros',
    text: 'Crea, edita y asigna conductores y pasajeros a cada vehículo. Los cambios se guardan directamente en Wialon.',
    points: [
      'Campos personalizados que se conservan al editar otros datos.',
      'Confirmación antes de eliminar o desvincular.',
    ],
    image: {
      src: conductores,
      width: 1100,
      height: 692,
      alt: 'Tabla de conductores con su vehículo asignado y acciones de edición (datos simulados)',
    },
  },
  {
    id: 'historial',
    title: 'Historial de recorridos',
    text: 'Elige un vehículo y un rango de fechas para ver el recorrido en el mapa, reproducirlo y revisar su velocidad.',
    points: [
      'Distancia, duración y velocidad máxima y promedio.',
      'Recorridos largos simplificados para que el mapa siga siendo ágil.',
    ],
    image: {
      src: historial,
      width: 1100,
      height: 757,
      alt: 'Historial con el recorrido en el mapa, resumen y controles de reproducción (datos simulados)',
    },
  },
]

const PRODUCT_STEPS: readonly { title: string; text: string }[] = [
  { title: 'Busca o filtra', text: 'Por nombre, estado o conductor; la búsqueda y la paginación las resuelve el servidor.' },
  { title: 'Selecciona en la lista o en el mapa', text: 'La unidad se resalta en ambos lados y el mapa abre su ficha.' },
  { title: 'Revisa el detalle', text: 'Estado, velocidad, rumbo, última actualización, conductor y pasajeros asignados.' },
]

interface TrustItem {
  icon: ComponentType<IconProps>
  title: string
  text: string
}

const TRUST: readonly TrustItem[] = [
  {
    icon: UserCogIcon,
    title: 'Permisos por rol',
    text: 'Administrador, Operador y Visualizador ven y hacen solo lo que su rol permite. El servidor lo comprueba en cada solicitud.',
  },
  {
    icon: KeyIcon,
    title: 'Acceso autenticado',
    text: 'Solo entran usuarios creados por un administrador, que cambian su contraseña en el primer ingreso.',
  },
  {
    icon: AuditIcon,
    title: 'Registro de operaciones',
    text: 'Altas, cambios, asignaciones, exportaciones e intentos fallidos quedan registrados con usuario, hora y resultado.',
  },
  {
    icon: MapIcon,
    title: 'Integración con Wialon',
    text: 'Los datos se consultan en Wialon a través de nuestro servidor. Las posiciones se actualizan cada 15 segundos mientras ves el mapa.',
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
            <p className="landing-kicker">Monitoreo de flotas sobre Wialon</p>
            <h1 id="landing-title" className="landing-hero__title">
              Tu flota, clara. Tu operación, bajo control.
            </h1>
            <p className="landing-hero__lead">
              Consulta dónde está cada vehículo, quién lo conduce y qué recorrido hizo, desde un mismo lugar y con
              permisos según el rol de cada persona.
            </p>
            <div className="landing-hero__actions">
              <AccessCta signedIn={signedIn} />
              <a className="landing-link" href="#funcionalidades">
                Explorar funcionalidades
              </a>
            </div>
            <ul className="landing-hero__facts" role="list">
              <li>
                <CheckIcon /> Acceso solo con usuarios creados por un administrador
              </li>
              <li>
                <CheckIcon /> Fechas y horas en la zona horaria de Bogotá
              </li>
            </ul>
          </div>
          <figure className="landing-shot landing-hero__shot">
            <img
              src={vehiculos}
              srcSet={`${vehiculos720} 720w, ${vehiculos} 1440w`}
              sizes="(min-width: 64rem) 40rem, calc(100vw - 2rem)"
              width={1440}
              height={900}
              alt="Pantalla de Vehículos: lista de unidades con su estado y mapa con marcadores agrupados"
              fetchPriority="high"
              decoding="async"
            />
            <figcaption>Pantalla real de GPS Comercial con datos simulados.</figcaption>
          </figure>
        </div>
      </section>

      <section id="funcionalidades" className="landing-section" aria-labelledby="features-title">
        <div className="landing-container">
          <header className="landing-section__header">
            <p className="landing-kicker">Funcionalidades</p>
            <h2 id="features-title" className="landing-section__title">
              Lo que resuelve en el día a día
            </h2>
          </header>
          <ol className="landing-capabilities" role="list">
            {CAPABILITIES.map((capability, index) => (
              <li key={capability.id} className="landing-capability">
                <div className="landing-capability__copy">
                  <span className="landing-capability__index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="landing-capability__title">{capability.title}</h3>
                  <p>{capability.text}</p>
                  <ul className="landing-points" role="list">
                    {capability.points.map((point) => (
                      <li key={point}>
                        <CheckIcon /> {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <figure className="landing-shot">
                  <img
                    src={capability.image.src}
                    width={capability.image.width}
                    height={capability.image.height}
                    alt={capability.image.alt}
                    loading="lazy"
                    decoding="async"
                  />
                </figure>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="producto" className="landing-section landing-section--tint" aria-labelledby="product-title">
        <div className="landing-container landing-product">
          <figure className="landing-shot landing-product__shot">
            <img
              src={seleccion}
              width={1200}
              height={805}
              alt="Unidad seleccionada en la lista y resaltada en el mapa con su ficha abierta (datos simulados)"
              loading="lazy"
              decoding="async"
            />
            <figcaption>Selección sincronizada entre lista y mapa, con datos simulados.</figcaption>
          </figure>
          <div className="landing-product__copy">
            <p className="landing-kicker">Producto</p>
            <h2 id="product-title" className="landing-section__title">
              De la lista al mapa en un clic
            </h2>
            <p className="landing-section__lead">
              La lista y el mapa muestran la misma flota. Lo que eliges en uno se ubica en el otro, para que encuentres
              una unidad y revises su información sin cambiar de pantalla.
            </p>
            <ol className="landing-steps" role="list">
              {PRODUCT_STEPS.map((step, index) => (
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
        </div>
      </section>

      <section id="seguridad" className="landing-section landing-section--dark" aria-labelledby="trust-title">
        <div className="landing-container">
          <header className="landing-section__header">
            <p className="landing-kicker landing-kicker--on-dark">Confianza y control</p>
            <h2 id="trust-title" className="landing-section__title">
              Cada acceso, con su rol y su registro
            </h2>
          </header>
          <ul className="landing-trust" role="list">
            {TRUST.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon className="landing-trust__icon" />
                <h3 className="landing-trust__title">{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-cta" aria-labelledby="cta-title">
        <div className="landing-container landing-cta__inner">
          <div>
            <h2 id="cta-title" className="landing-section__title">
              {signedIn ? 'Tu panel está listo' : 'Entra a tu panel de flota'}
            </h2>
            <p className="landing-section__lead">
              {signedIn && user
                ? `Iniciaste sesión como ${user.full_name}. Continúa donde lo dejaste.`
                : 'Usa el correo y la contraseña que te entregó el administrador de tu organización.'}
            </p>
          </div>
          <AccessCta signedIn={signedIn} />
        </div>
      </section>
    </div>
  )
}
