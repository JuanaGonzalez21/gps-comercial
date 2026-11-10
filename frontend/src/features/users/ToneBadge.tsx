import type { ReactNode } from 'react'
import './admin-table.css'

export type BadgeTone = 'success' | 'neutral' | 'warning' | 'danger'

interface ToneBadgeProps {
  tone: BadgeTone
  /** Decorative icon; the text always carries the meaning (never colour alone, UX-03). */
  icon: ReactNode
  children: ReactNode
}

/**
 * Semantic badge for admin lists (user state, audit outcome). Shared by the users and audit
 * features; candidate to move into src/ui next to StatusBadge.
 */
export function ToneBadge({ tone, icon, children }: ToneBadgeProps) {
  return (
    <span className={`admin-badge admin-badge--${tone}`}>
      <span className="admin-badge__icon">{icon}</span>
      <span>{children}</span>
    </span>
  )
}
