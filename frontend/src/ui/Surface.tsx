import type { HTMLAttributes, ReactNode } from 'react'
import './surface.css'

interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Use "section" with an aria-labelledby when the card is a named region. */
  as?: 'div' | 'section' | 'article'
  padded?: boolean
}

export function Card({ as: Tag = 'div', padded = true, className, children, ...rest }: CardProps) {
  return (
    <Tag className={['card', padded && 'card--padded', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  )
}

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Actions or status shown next to the title (wraps below it on small screens). */
  actions?: ReactNode
}

/** The page's single h1, with optional description and actions. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}
