/** Up to two initials: first and last word ("Admin Demo" → "AD"). */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts
  return letters.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}
