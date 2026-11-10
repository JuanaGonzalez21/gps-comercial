import { useId, type ReactNode } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import type { RoleCode } from '@/api/types'
import { AlertCircleIcon, EditIcon, EyeIcon, ShieldIcon, type SelectOption } from '@/ui'
import { ROLE_CHOICE_ORDER, ROLE_FALLBACK_NAMES, ROLE_SUMMARIES } from './roles'

const ROLE_ICONS: Record<RoleCode, ReactNode> = {
  viewer: <EyeIcon />,
  operator: <EditIcon />,
  admin: <ShieldIcon />,
}

interface RoleRadioGroupProps {
  /** Role names as the server says (falls back to the Spanish defaults). */
  options: readonly (SelectOption & { value: RoleCode })[]
  /** react-hook-form registration for the editable group. */
  registration?: UseFormRegisterReturn<'role'>
  /** Locked role (own account): shown checked and disabled; the form keeps its default value. */
  lockedRole?: RoleCode
  hint?: string
  error?: string
}

/**
 * Role as selectable cards (design "10. Modales"). Real radio inputs inside a fieldset, so the
 * browser gives the group its keyboard behaviour: Tab enters on the checked card, arrows move and
 * select. Each radio is named by the role and described by what it allows.
 */
export function RoleRadioGroup({ options, registration, lockedRole, hint, error }: RoleRadioGroupProps) {
  const baseId = useId()
  const hintId = hint ? `${baseId}-hint` : undefined
  const errorId = error ? `${baseId}-error` : undefined
  const locked = lockedRole !== undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <fieldset
      className={['role-group', error && 'role-group--invalid'].filter(Boolean).join(' ')}
      disabled={locked}
      aria-describedby={describedBy}
    >
      <legend className="field__label role-group__legend">
        Rol
        {!locked && (
          <span className="field__required">
            <span aria-hidden="true"> *</span>
            <span className="visually-hidden"> (obligatorio)</span>
          </span>
        )}
      </legend>
      {hint && (
        <p id={hintId} className="field__hint role-group__hint">
          {hint}
        </p>
      )}
      <div className="role-group__options">
        {ROLE_CHOICE_ORDER.map((code) => {
          const nameId = `${baseId}-${code}-name`
          const descriptionId = `${baseId}-${code}-description`
          const name = options.find((option) => option.value === code)?.label ?? ROLE_FALLBACK_NAMES[code]
          return (
            <label key={code} className="role-option">
              <input
                type="radio"
                className="role-option__input"
                value={code}
                aria-labelledby={nameId}
                aria-describedby={descriptionId}
                {...(locked ? { name: `${baseId}-locked`, defaultChecked: code === lockedRole } : registration)}
              />
              <span className="role-option__icon">{ROLE_ICONS[code]}</span>
              <span className="role-option__text">
                <span id={nameId} className="role-option__name">
                  {name}
                </span>
                <span id={descriptionId} className="role-option__description">
                  {ROLE_SUMMARIES[code]}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id={errorId} className="field__error">
          <AlertCircleIcon className="field__error-icon" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  )
}
