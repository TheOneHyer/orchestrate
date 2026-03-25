import type { User } from './types'

/**
 * Splits a block of pasted enrollment identifiers into unique normalized values.
 *
 * @param rawValue - User-entered text containing IDs, emails, or names.
 * @returns Unique non-empty identifier tokens in their original user-entered form.
 */
export function parseEnrollmentIdentifiers(rawValue: string): string[] {
  const seen = new Set<string>()

  return rawValue
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) {
        return false
      }

      const normalized = value.toLowerCase()
      if (seen.has(normalized)) {
        return false
      }

      seen.add(normalized)
      return true
    })
}

/**
 * Matches imported identifiers against available students using IDs, emails, and names.
 *
 * @param identifiers - Parsed identifiers to resolve.
 * @param students - Available students who may be matched.
 * @returns Matched student IDs and any identifiers that could not be resolved.
 */
export function matchStudentsByIdentifiers(identifiers: string[], students: User[]): { matchedIds: string[]; unmatched: string[] } {
  const matchedIds: string[] = []
  const unmatched: string[] = []
  const matchedSet = new Set<string>()

  identifiers.forEach((identifier) => {
    const normalizedIdentifier = identifier.trim().toLowerCase()
    const student = students.find((candidate) => {
      const normalizedName = candidate.name.trim().toLowerCase()
      const normalizedEmail = candidate.email.trim().toLowerCase()
      const normalizedId = candidate.id.trim().toLowerCase()
      const emailLocalPart = normalizedEmail.split('@')[0]

      return normalizedIdentifier === normalizedId ||
        normalizedIdentifier === normalizedEmail ||
        normalizedIdentifier === emailLocalPart ||
        normalizedIdentifier === normalizedName
    })

    if (!student) {
      unmatched.push(identifier)
      return
    }

    if (!matchedSet.has(student.id)) {
      matchedSet.add(student.id)
      matchedIds.push(student.id)
    }
  })

  return { matchedIds, unmatched }
}
