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

  // Precompute lookup maps to avoid repeatedly scanning and normalizing students.
  const idMap = new Map<string, string>()
  const emailMap = new Map<string, string>()
  const localPartMap = new Map<string, string[]>()
  const nameMap = new Map<string, string[]>()

  students.forEach((student) => {
    const normalizedId = student.id.trim().toLowerCase()
    const normalizedEmail = student.email.trim().toLowerCase()
    const emailLocalPart = normalizedEmail.split('@')[0]
    const normalizedName = student.name.trim().toLowerCase()

    // Preserve "first match wins" semantics by only setting if the key is new.
    if (!idMap.has(normalizedId)) {
      idMap.set(normalizedId, student.id)
    }

    if (!emailMap.has(normalizedEmail)) {
      emailMap.set(normalizedEmail, student.id)
    }

    const existingLocalPartIds = localPartMap.get(emailLocalPart)
    if (existingLocalPartIds) {
      existingLocalPartIds.push(student.id)
    } else {
      localPartMap.set(emailLocalPart, [student.id])
    }

    const existingNameIds = nameMap.get(normalizedName)
    if (existingNameIds) {
      existingNameIds.push(student.id)
    } else {
      nameMap.set(normalizedName, [student.id])
    }
  })

  identifiers.forEach((identifier) => {
    const normalizedIdentifier = identifier.trim().toLowerCase()

    // First, try strict id/email match.
    const strictIdMatch = idMap.get(normalizedIdentifier)
    const strictEmailMatch = emailMap.get(normalizedIdentifier)
    const strictMatchId = strictIdMatch ?? strictEmailMatch

    if (strictMatchId) {
      if (!matchedSet.has(strictMatchId)) {
        matchedSet.add(strictMatchId)
        matchedIds.push(strictMatchId)
      }
      return
    }

    // Fallback: match by email local-part or full name.
    const localPartIds = localPartMap.get(normalizedIdentifier) ?? []
    const nameIds = nameMap.get(normalizedIdentifier) ?? []

    const combinedIds = new Set<string>()
    localPartIds.forEach((id) => combinedIds.add(id))
    nameIds.forEach((id) => combinedIds.add(id))

    if (combinedIds.size !== 1) {
      unmatched.push(identifier)
      return
    }

    const [studentId] = Array.from(combinedIds)

    if (!matchedSet.has(studentId)) {
      matchedSet.add(studentId)
      matchedIds.push(studentId)
    }
  })

  return { matchedIds, unmatched }
}
