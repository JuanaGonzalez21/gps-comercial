import { useId, type Ref, type TextareaHTMLAttributes } from 'react'
import { AlertCircleIcon } from '@/ui'

// Multi-line counterpart of the shared TextField (same markup and classes from src/ui/field.css):
// visible label, hint and error linked with aria-describedby, aria-invalid on error.

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'aria-describedby'> {
  label: string
  hint?: string
  error?: string
  ref?: Ref<HTMLTextAreaElement>
}

export function TextAreaField({ label, hint, error, id, className, ref, ...rest }: TextAreaFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={error ? 'field field--invalid' : 'field'}>
      <label htmlFor={inputId} className="field__label">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={['field__control', 'roster-textarea', className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error && (
        <p id={errorId} className="field__error">
          <AlertCircleIcon className="field__error-icon" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
