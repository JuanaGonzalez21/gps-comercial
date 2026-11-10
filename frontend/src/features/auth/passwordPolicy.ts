// Mirrors the backend policy (backend/app/services/passwords.py, docs/api-contract.md §4).
// The backend is the authority; this only gives live guidance while typing.

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export interface PasswordRule {
  id: string
  label: string
  test: (password: string) => boolean
}

export function passwordRules(email: string | null | undefined): PasswordRule[] {
  const localPart = (email ?? '').split('@')[0].toLowerCase()
  const rules: PasswordRule[] = [
    {
      id: 'length',
      label: `Entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres`,
      // Count code points like the backend, not UTF-16 units.
      test: (password) => {
        const length = [...password].length
        return length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH
      },
    },
    { id: 'lower', label: 'Una letra minúscula', test: (password) => /\p{Ll}/u.test(password) },
    { id: 'upper', label: 'Una letra mayúscula', test: (password) => /\p{Lu}/u.test(password) },
    { id: 'digit', label: 'Un número', test: (password) => /\p{Nd}/u.test(password) },
    {
      id: 'symbol',
      label: 'Un símbolo, por ejemplo ! # $ % & * ? @',
      test: (password) => /[^\p{L}\p{N}\s]/u.test(password),
    },
  ]
  if (localPart.length >= 3) {
    rules.push({
      id: 'email',
      label: 'Que no contenga tu usuario de correo',
      test: (password) => !password.toLowerCase().includes(localPart),
    })
  }
  return rules
}
