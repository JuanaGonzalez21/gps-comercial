import type { SVGProps } from 'react'

/** Crossed-out location pin, drawn like the shared icon set (stroke, currentColor, decorative). */
export function PinOffIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M18.6 13.4C19.2 11.9 19.5 10.4 19.5 9a7.5 7.5 0 0 0-11.8-6.1M5 6.2A7.5 7.5 0 0 0 4.5 9c0 5.6 7.5 13.5 7.5 13.5s1.9-2 3.8-4.7" />
      <path d="M3 3l18 18" />
    </svg>
  )
}

/**
 * Vehicles whose last message has no valid coordinates stay in the list but cannot be shown on the
 * map. Icon + text (never colour alone), with the same shape as the status badges.
 */
export function NoPositionBadge() {
  return (
    <span className="no-position-badge">
      <PinOffIcon className="no-position-badge__icon" />
      <span>Sin posición</span>
    </span>
  )
}
