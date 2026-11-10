import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Link, type LinkProps } from 'react-router'
import { Spinner } from './Spinner'
import './button.css'

/** "soft": lavender fill with a teal label, for secondary shortcuts such as "Ver vehículos". */
export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

interface ButtonStyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Decorative leading icon. */
  icon?: ReactNode
  /** Decorative trailing icon, for example an arrow on "Ver …" shortcuts. */
  trailingIcon?: ReactNode
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
  trailingIcon,
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
      {!loading && trailingIcon}
    </button>
  )
}

export interface LinkButtonProps extends LinkProps, ButtonStyleProps {}

/** A router link styled as a button (navigation is a link, not a button). */
export function LinkButton({
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  fullWidth,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, fullWidth, className)} {...rest}>
      {icon}
      <span>{children}</span>
      {trailingIcon}
    </Link>
  )
}
