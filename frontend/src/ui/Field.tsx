import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
} from 'react'
import { AlertCircleIcon, EyeIcon, EyeOffIcon } from './icons'
import './field.css'

// Accessible form fields (ARQ-11, UX-03): visible label bound with htmlFor, hint and error linked
// through aria-describedby, aria-invalid on error. Compatible with react-hook-form's register().

interface FieldShellProps {
  inputId: string
  label: string
  hideLabel?: boolean
  hint?: ReactNode
  error?: string
  isRequired?: boolean
  className?: string
  children: (describedBy: string | undefined) => ReactNode
  /** Extra ids to describe the control (for example a live checklist). */
  describedBy?: string
}

function FieldShell({
  inputId,
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  className,
  children,
  describedBy,
}: FieldShellProps) {
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const ids = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={['field', error && 'field--invalid', className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId} className={hideLabel ? 'visually-hidden' : 'field__label'}>
        {label}
        {isRequired && (
          <span className="field__required">
            <span aria-hidden="true"> *</span>
            <span className="visually-hidden"> (obligatorio)</span>
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {children(ids)}
      {error && (
        <p id={errorId} className="field__error">
          <AlertCircleIcon className="field__error-icon" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

interface CommonFieldProps {
  label: string
  hideLabel?: boolean
  hint?: ReactNode
  error?: string
  isRequired?: boolean
  /** Ids of extra descriptions (merged into aria-describedby). */
  describedBy?: string
  fieldClassName?: string
}

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-describedby'>,
    CommonFieldProps {
  ref?: Ref<HTMLInputElement>
  /** Decorative icon inside the start of the input (for example a magnifier on search boxes). */
  leadingIcon?: ReactNode
}

export function TextField({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  describedBy,
  fieldClassName,
  id,
  className,
  ref,
  leadingIcon,
  ...inputProps
}: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <FieldShell
      inputId={inputId}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      isRequired={isRequired}
      describedBy={describedBy}
      className={fieldClassName}
    >
      {(ids) => {
        const input = (
          <input
            ref={ref}
            id={inputId}
            className={['field__control', leadingIcon && 'field__control--with-icon', className]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={error ? true : undefined}
            aria-required={isRequired || undefined}
            aria-describedby={ids}
            {...inputProps}
          />
        )
        if (!leadingIcon) return input
        return (
          <span className="field__search">
            <span className="field__search-icon" aria-hidden="true">
              {leadingIcon}
            </span>
            {input}
          </span>
        )
      }}
    </FieldShell>
  )
}

export type PasswordFieldProps = Omit<TextFieldProps, 'type'>

/** Password input with a show/hide toggle (a pressed-state button, keyboard reachable). */
export function PasswordField({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  describedBy,
  fieldClassName,
  id,
  className,
  ref,
  ...inputProps
}: PasswordFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const [visible, setVisible] = useState(false)
  return (
    <FieldShell
      inputId={inputId}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      isRequired={isRequired}
      describedBy={describedBy}
      className={fieldClassName}
    >
      {(ids) => (
        <div className="field__password">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={['field__control', 'field__control--with-action', className]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={error ? true : undefined}
            aria-required={isRequired || undefined}
            aria-describedby={ids}
            autoCapitalize="none"
            spellCheck={false}
            {...inputProps}
          />
          <button
            type="button"
            className="field__toggle"
            aria-pressed={visible}
            aria-controls={inputId}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
            <span className="visually-hidden">Mostrar contraseña</span>
          </button>
        </div>
      )}
    </FieldShell>
  )
}

export interface SelectOption {
  value: string
  label: string
}

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'aria-describedby'>,
    CommonFieldProps {
  options: readonly SelectOption[]
  ref?: Ref<HTMLSelectElement>
}

export function SelectField({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  describedBy,
  fieldClassName,
  options,
  id,
  className,
  ref,
  ...selectProps
}: SelectFieldProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <FieldShell
      inputId={selectId}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      isRequired={isRequired}
      describedBy={describedBy}
      className={fieldClassName}
    >
      {(ids) => (
        <select
          ref={ref}
          id={selectId}
          className={['field__control', 'field__select', className].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids}
          {...selectProps}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  )
}
