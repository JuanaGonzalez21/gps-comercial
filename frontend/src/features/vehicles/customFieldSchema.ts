import { z } from 'zod'

// Same limits as the API (backend/app/api/schemas/fields.py): name 1-50, value up to 255, both
// trimmed. The API checks again, including the duplicate name rule (409).
export const CUSTOM_FIELD_NAME_MAX = 50
export const CUSTOM_FIELD_VALUE_MAX = 255

export const DUPLICATE_NAME_MESSAGE = 'Ya existe un campo con ese nombre en este vehículo.'

/** Case-insensitive comparison, like the backend's casefold(). */
export function normalizeFieldName(name: string): string {
  return name.trim().toLocaleLowerCase('es-CO')
}

/** `takenNames`: names of the vehicle's other fields (the edited field itself excluded). */
export function customFieldSchema(takenNames: readonly string[]) {
  const taken = new Set(takenNames.map(normalizeFieldName))
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, { error: 'Escribe el nombre del campo.' })
        .max(CUSTOM_FIELD_NAME_MAX, {
          error: `El nombre admite máximo ${CUSTOM_FIELD_NAME_MAX} caracteres.`,
        }),
      value: z
        .string()
        .trim()
        .max(CUSTOM_FIELD_VALUE_MAX, {
          error: `El valor admite máximo ${CUSTOM_FIELD_VALUE_MAX} caracteres.`,
        }),
    })
    .refine((input) => !taken.has(normalizeFieldName(input.name)), {
      path: ['name'],
      error: DUPLICATE_NAME_MESSAGE,
    })
}

export type CustomFieldFormInput = z.input<ReturnType<typeof customFieldSchema>>
export type CustomFieldFormValues = z.output<ReturnType<typeof customFieldSchema>>
