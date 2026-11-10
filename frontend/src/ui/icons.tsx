import type { SVGProps } from 'react'

// Own inline SVG icons (no icon font or external sprite: works with a strict CSP).
// Decorative by default (aria-hidden); the surrounding text always carries the meaning.

export type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const MenuIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
)

export const CloseIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const EyeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)

export const EyeOffIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.1A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17.6 17.6 0 0 1-3.2 3.9" />
    <path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 6 10 6a10 10 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
)

export const SearchIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
)

export const ChevronLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
)

export const ChevronRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
)

export const ArrowUpIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Svg>
)

export const ArrowDownIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </Svg>
)

export const ArrowRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 12h14M13 5l7 7-7 7" />
  </Svg>
)

export const SortIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
  </Svg>
)

export const LogoutIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Svg>
)

export const AlertTriangleIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
)

export const AlertCircleIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </Svg>
)

export const CheckCircleIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12l3 3 5-6" />
  </Svg>
)

export const InfoIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </Svg>
)

export const RefreshIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" />
  </Svg>
)

export const MapIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />
  </Svg>
)

export const ListIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Svg>
)

export const TruckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2 6h12v10H2zM14 9h4l4 4v3h-8" />
    <circle cx="6.5" cy="17.5" r="1.8" />
    <circle cx="17.5" cy="17.5" r="1.8" />
  </Svg>
)

export const DashboardIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z" />
  </Svg>
)

export const SteeringWheelIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 14.5V21M9.6 11.3L3.4 9.8M14.4 11.3l6.2-1.5" />
  </Svg>
)

export const UsersIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
  </Svg>
)

export const UserCogIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="8" cy="7" r="4" />
    <circle cx="19" cy="15" r="2" />
    <path d="M19 11v2M19 17v2M22.5 13l-1.7 1M17.2 16l-1.7 1M22.5 17l-1.7-1M17.2 14l-1.7-1" />
  </Svg>
)

export const HistoryIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5" />
    <path d="M12 7v5l3 2" />
  </Svg>
)

export const AuditIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 3h6v3H9z" />
    <path d="M15 4.5h2a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2" />
    <path d="M9 14l2 2 4-4" />
  </Svg>
)

/** "En movimiento": a filled heading arrow. */
export const MovingIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3l7 18-7-4-7 4 7-18z" fill="currentColor" />
  </Svg>
)

/** "Detenido": a filled square (stop). */
export const StoppedIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </Svg>
)

/** "Sin señal": signal waves crossed out. */
export const NoSignalIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.8a10 10 0 0 1 4-2.5M2 8.8a15 15 0 0 1 4.2-2.6M3 3l18 18" />
  </Svg>
)

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 12l5 5L20 7" />
  </Svg>
)

export const CircleIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8" />
  </Svg>
)

export const CrosshairIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Svg>
)

/** Brand mark: a location pin. */
export const PinIcon = (props: IconProps) => (
  <Svg strokeWidth={0} {...props}>
    <path
      d="M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.6 7.5 13.5 7.5 13.5s7.5-7.9 7.5-13.5A7.5 7.5 0 0 0 12 1.5z"
      fill="currentColor"
    />
    <circle cx="12" cy="9" r="2.8" fill="#ffffff" />
  </Svg>
)

export const DownloadIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Svg>
)

export const PlusIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const EditIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
  </Svg>
)

export const TrashIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Svg>
)

export const PlayIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 4l13 8-13 8V4z" fill="currentColor" />
  </Svg>
)

export const PauseIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor" />
  </Svg>
)

export const LinkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
)

export const UnlinkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M15 9l3-3M6 18l3-3M14 4l1 2M4 14l2 1M18 10l2 1M10 20l1-2M9 9l6 6" />
  </Svg>
)

export const KeyIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l9-9M17 6l3 3M14 9l2 2" />
  </Svg>
)

// Landing iconography (also reusable): map with a pin, route between two points, shield with a check
// and clipboard with a check.
export const MapPinnedIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 15s5-4.2 5-8a5 5 0 0 0-10 0c0 3.8 5 8 5 8z" />
    <circle cx="12" cy="7" r="1.8" />
    <path d="M7.5 13.6 3 15v6l6-2 6 2 6-2v-6l-4.5-1.4" />
  </Svg>
)

export const RouteIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="6" cy="19" r="2.5" />
    <circle cx="18" cy="5" r="2.5" />
    <path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5" />
  </Svg>
)

export const ShieldCheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
)

export const ClipboardCheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="8" y="2.5" width="8" height="4" rx="1" />
    <path d="M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2" />
    <path d="M9 14l2 2 4-4" />
  </Svg>
)
