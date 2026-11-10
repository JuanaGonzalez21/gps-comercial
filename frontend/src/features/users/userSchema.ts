import { z } from 'zod'
import type { RoleCode } from '@/api/types'

// Same limits as the backend (app/api/schemas/fields.py): e-mail up to 254, full name 1-120.
// The server validates again; its 409/422 messages are mapped onto these fields.

const ROLE_VALUES = ['admin', 'operator', 'viewer'] as const satisfies readonly RoleCode[]

export const userFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: 'Ingresa el correo electrónico.' })
    .max(254, { error: 'El correo puede tener máximo 254 caracteres.' })
    .pipe(z.email({ error: 'Ingresa un correo electrónico válido, por ejemplo nombre@empresa.com.' })),
  full_name: z
    .string()
    .trim()
    .min(1, { error: 'Ingresa el nombre completo.' })
    .max(120, { error: 'El nombre puede tener máximo 120 caracteres.' }),
  role: z.enum(ROLE_VALUES, { error: 'Elige un rol.' }),
})

export type UserFormInput = z.input<typeof userFormSchema>
export type UserFormOutput = z.output<typeof userFormSchema>

export const USER_FORM_FIELDS = ['email', 'full_name', 'role'] as const
