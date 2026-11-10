import { z } from 'zod'
import { isPathSafeFieldKey } from '@/api/passengers'

// Passenger custom fields (Wialon `jp`), mirroring backend/app/api/schemas/passengers.py:
// key 1-50 characters, value up to 255, keys unique ignoring case, at most 50 per passenger.

export const FIELD_KEY_MAX = 50
export const FIELD_VALUE_MAX = 255
export const MAX_CUSTOM_FIELDS = 50

export const DUPLICATE_KEY_MESSAGE = 'Ya existe un campo con esa clave en este pasajero.'

/** "Empresa" and "empresa" are the same key for the backend. */
export function foldKey(key: string): string {
  return key.trim().toLocaleLowerCase('es-CO')
}

export const fieldKey = z
  .string()
  .trim()
  .min(1, { error: 'Ingresa la clave del campo.' })
  .max(FIELD_KEY_MAX, { error: `La clave admite máximo ${FIELD_KEY_MAX} caracteres.` })
  .refine(isPathSafeFieldKey, { error: 'La clave no puede ser «.» ni «..».' })

export const fieldValue = z
  .string()
  .trim()
  .max(FIELD_VALUE_MAX, { error: `El valor admite máximo ${FIELD_VALUE_MAX} caracteres.` })

/** One field saved on its own; `takenKeys` are the keys of the passenger's other fields. */
export function customFieldSchema(takenKeys: readonly string[]) {
  const taken = new Set(takenKeys.map(foldKey))
  return z.object({
    key: fieldKey.refine((key) => !taken.has(foldKey(key)), { error: DUPLICATE_KEY_MESSAGE }),
    value: fieldValue,
  })
}

/** Fields typed while creating a passenger: their keys must not repeat. */
export const newCustomFields = z
  .array(z.object({ key: fieldKey, value: fieldValue }))
  .max(MAX_CUSTOM_FIELDS, { error: `Un pasajero admite máximo ${MAX_CUSTOM_FIELDS} campos.` })
  .superRefine((fields, context) => {
    const seen = new Set<string>()
    fields.forEach((field, index) => {
      const folded = foldKey(field.key)
      if (!folded) return // an empty key already has its own message
      if (seen.has(folded)) {
        context.addIssue({ code: 'custom', path: [index, 'key'], message: 'Esta clave está repetida.' })
      }
      seen.add(folded)
    })
  })
