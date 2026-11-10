import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { getErrorMessage, isApiError } from '@/api/errors'

// Turns a failed save into messages on the form (RF-18): 422 errors go to their fields, a 409
// about a duplicate code goes to the code field, everything else to the form summary.

export interface SubmitFailure {
  /** Summary shown above the form (always present). */
  message: string
  /** True when the failure is not the user's input: trying again may work. */
  retryable: boolean
}

const VALIDATION_SUMMARY = 'Revisa los campos marcados.'

/** Network failures, 5xx and rate limits can succeed later; 4xx answers would repeat. */
export function isRetryableError(error: unknown): boolean {
  if (!isApiError(error)) return true
  return error.status === 0 || error.status >= 500 || error.status === 429
}

/**
 * Applies the server's answer to a react-hook-form form. `isField` tells which server field
 * names exist in the form (for example "name" or "custom_fields.0.key"); the first one gets focus.
 */
export function applySubmitError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  isField: (name: string) => boolean,
): SubmitFailure {
  if (isApiError(error) && error.code === 'validation_error') {
    const unplaced: string[] = []
    let focused = false
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      if (isField(field)) {
        setError(field as Path<T>, { type: 'server', message }, { shouldFocus: !focused })
        focused = true
      } else {
        unplaced.push(message)
      }
    }
    return { message: [VALIDATION_SUMMARY, ...unplaced].join(' '), retryable: false }
  }
  if (isApiError(error) && error.code === 'conflict' && /c[oó]digo/i.test(error.detail) && isField('code')) {
    setError('code' as Path<T>, { type: 'server', message: error.detail }, { shouldFocus: true })
    return { message: error.detail, retryable: false }
  }
  return { message: getErrorMessage(error), retryable: isRetryableError(error) }
}
