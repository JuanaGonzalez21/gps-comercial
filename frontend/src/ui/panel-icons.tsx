import type { IconProps } from './icons'

// Extra inline SVG icons for the redesigned panel (same 24 × 24 stroke style as icons.tsx).
// Kept in their own module so the panel and the landing can evolve icons.tsx independently.
// Decorative by default (aria-hidden): the surrounding text always carries the meaning.

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

export const MoreVerticalIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="5" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="19" r="1.2" fill="currentColor" />
  </Svg>
)

export const ChevronDownIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
)

export const ChevronUpIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 15l6-6 6 6" />
  </Svg>
)

/** Swap: "Cambiar vehículo". */
export const SwapIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
  </Svg>
)

/** Shield with a check: the Administrador role. */
export const ShieldIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
)

/** Person with a plus: "Crear usuario". */
export const UserPlusIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M19 8v6M16 11h6" />
  </Svg>
)

/** Map pin with a slash: "Requiere atención" (vehicles without signal). */
export const PinOffIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9.5 4.3A7 7 0 0 1 19 10c0 1.6-.6 3.3-1.4 4.8M15.2 18.6A30 30 0 0 1 12 22s-7-6.2-7-12c0-1 .2-2 .6-2.9" />
    <path d="M3 3l18 18" />
  </Svg>
)
