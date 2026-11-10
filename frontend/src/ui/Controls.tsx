import type { ReactNode } from 'react'
import { initialsOf } from './initials'
import './controls.css'

/* ---------- Segmented control ---------- */

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
}

interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group, for example "Asignación". */
  label: string
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  /** Visual size: "md" fills its container (filters), "sm" hugs its content (speed x1…x8). */
  size?: 'md' | 'sm'
}

/** Mutually exclusive options as pressed-state buttons inside a labelled group (aria-pressed). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={['segmented', `segmented--${size}`, className].filter(Boolean).join(' ')}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__option"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Filter chip ---------- */

interface FilterChipProps {
  pressed: boolean
  onClick: () => void
  children: ReactNode
  /** Optional status dot colour (CSS colour value); the label always names the status too. */
  dotColor?: string
  /** Optional count shown after the label. */
  count?: number
  /** "dark" = filter chips (active: dark fill); "accent" = quick ranges (active: teal tint). */
  tone?: 'dark' | 'accent'
}

/** Toggle chip with aria-pressed: status filters and quick date ranges. */
export function FilterChip({ pressed, onClick, children, dotColor, count, tone = 'dark' }: FilterChipProps) {
  return (
    <button
      type="button"
      className={`chip chip--${tone}`}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {dotColor && <span className="chip__dot" style={{ background: dotColor }} aria-hidden="true" />}
      <span>{children}</span>
      {count !== undefined && <span className="chip__count">{count}</span>}
    </button>
  )
}

/* ---------- Avatar ---------- */

interface AvatarProps {
  name: string
  /** "dark" for the signed-in user, "soft" for people in lists, "teal" for an assigned driver. */
  tone?: 'dark' | 'soft' | 'teal'
  size?: 'sm' | 'md' | 'lg'
  /** Overrides the computed initials (for example "C1"). */
  initials?: string
}

/** Decorative initials circle; the name is always written next to it. */
export function Avatar({ name, tone = 'soft', size = 'md', initials }: AvatarProps) {
  return (
    <span className={`avatar avatar--${tone} avatar--${size}`} aria-hidden="true">
      {initials ?? initialsOf(name)}
    </span>
  )
}
