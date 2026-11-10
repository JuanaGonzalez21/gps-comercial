import { Link } from 'react-router'
import { PinIcon } from './icons'
import './brand.css'

interface BrandProps {
  to: string
  /** "dark" for the sidebar and top bar, "light" for light surfaces. */
  tone?: 'light' | 'dark'
}

/** Product logo: brand-red pin mark plus the wordmark (the link text is the accessible name). */
export function Brand({ to, tone = 'light' }: BrandProps) {
  return (
    <Link to={to} className={`brand brand--${tone}`}>
      <PinIcon className="brand__mark" />
      <span className="brand__name">GPS Comercial</span>
    </Link>
  )
}
