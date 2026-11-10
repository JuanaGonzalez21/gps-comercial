import { z } from 'zod'

// Client-side rules for drivers and passengers. They mirror backend/app/api/schemas/fields.py
// (RF-18, RF-28): the backend validates again and its 422 messages land on the same fields.

export const NAME_MAX = 50
export const CODE_MAX = 30
export const DESCRIPTION_MAX = 255
/** Same pattern as the backend (PHONE_PATTERN). */
export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/

export const PHONE_MESSAGE =
  'Ingresa un teléfono válido: de 7 a 20 dígitos, espacios, paréntesis o guiones, con + inicial opcional.'

export const nameField = z
  .string()
  .trim()
  .min(1, { error: 'Ingresa el nombre.' })
  .max(NAME_MAX, { error: `El nombre admite máximo ${NAME_MAX} caracteres.` })

export const codeField = z
  .string()
  .trim()
  .max(CODE_MAX, { error: `El código admite máximo ${CODE_MAX} caracteres.` })

export const phoneField = z
  .string()
  .trim()
  .refine((value) => value === '' || PHONE_PATTERN.test(value), { error: PHONE_MESSAGE })

export const descriptionField = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX, { error: `La descripción admite máximo ${DESCRIPTION_MAX} caracteres.` })

/** Resource select: '' means "let the backend choose its default resource". */
export const resourceField = z.string()

/** Optional text is sent as null when blank: the API never stores "" as "no data". */
export function blankToNull(value: string): string | null {
  return value === '' ? null : value
}

export function toResourceId(value: string): number | undefined {
  const id = Number(value)
  return value !== '' && Number.isInteger(id) && id > 0 ? id : undefined
}
