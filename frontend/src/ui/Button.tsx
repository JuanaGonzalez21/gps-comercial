import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Link, type LinkProps } from 'react-router'
import { Spinner } from './Spinner'
import './button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

interface ButtonStyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Decorative leading icon. */
  icon?: ReactNode
  fullWidth?: boolean
}

function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean | undefined,
  className: string | undefined,
): string {
  return ['btn', `btn--${variant}`, `btn--${size}`, fullWidth && 'btn--block', className]
    .filter(Boolean)
    .join(' ')
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean
  /** Text shown while loading, for example "Guardando…". */
  loadingText?: string
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth,
  loading = false,
  loadingText,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, fullWidth, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children !== undefined && <span>{loading && loadingText ? loadingText : children}</span>}
    </button>
  )
}

export interface LinkButtonProps extends LinkProps, ButtonStyleProps {}

/** A router link styled as a button (navigation is a link, not a button). */
export function LinkButton({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, fullWidth, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  )
}
