import './feedback.css'

interface SkeletonProps {
  width?: string
  height?: string
  /** Rounded pill (badges) instead of a soft rectangle. */
  pill?: boolean
  className?: string
}

/** Placeholder block while data loads. Hidden from assistive tech: pair it with a status text. */
export function Skeleton({ width = '100%', height = '1rem', pill = false, className }: SkeletonProps) {
  return (
    <span
      className={['skeleton', pill && 'skeleton--pill', className].filter(Boolean).join(' ')}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}
