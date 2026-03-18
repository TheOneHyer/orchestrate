import { Session, User } from './types'

/**
 * Represents a single scheduling conflict detected between two sessions
 * for a shared resource (trainer, room, or student).
 */
export interface Conflict {
  /** The category of resource that is double-booked. */
  type: 'trainer' | 'room' | 'student'
  /** Human-readable description of the conflict. */
  message: string
  /** Whether the conflict is a hard block (`'error'`) or an advisory notice (`'warning'`). */
  severity: 'warning' | 'error'
  /** ID of the existing session that conflicts with the moved session. */
  conflictingSessionId: string
  /** Title of the conflicting session, for display in messages. */
  conflictingSessionTitle: string
  /** IDs of the specific resources (e.g. student user IDs) involved in the conflict. */
  affectedResourceIds?: string[]
}

/**
 * The result returned by a session conflict check, containing a summary flag
 * and the full list of detected conflicts.
 */
export interface ConflictCheckResult {
  /** `true` if at least one conflict was found. */
  hasConflicts: boolean
  /** All conflicts detected; empty array when `hasConflicts` is `false`. */
  conflicts: Conflict[]
}

/**
 * Checks a session being moved to a new time slot against all other sessions
 * for trainer, room, and student scheduling conflicts.
 *
 * @param draggedSession - The session whose time slot is being changed.
 * @param targetStartTime - Proposed new start time for the session.
 * @param targetEndTime - Proposed new end time for the session.
 * @param allSessions - All sessions in the system (including the dragged one, which is excluded internally).
 * @param users - Full user list, used to resolve student names for conflict messages.
 * @returns A {@link ConflictCheckResult} containing every conflict found.
 */
export function checkSessionConflicts(
  draggedSession: Session,
  targetStartTime: Date,
  targetEndTime: Date,
  allSessions: Session[],
  users: User[]
): ConflictCheckResult {
  const conflicts: Conflict[] = []

  const otherSessions = allSessions.filter(s => s.id !== draggedSession.id)

  for (const session of otherSessions) {
    const sessionStart = new Date(session.startTime)
    const sessionEnd = new Date(session.endTime)

    const hasTimeOverlap = 
      (targetStartTime >= sessionStart && targetStartTime < sessionEnd) ||
      (targetEndTime > sessionStart && targetEndTime <= sessionEnd) ||
      (targetStartTime <= sessionStart && targetEndTime >= sessionEnd)

    if (!hasTimeOverlap) continue

    if (session.trainerId === draggedSession.trainerId) {
      conflicts.push({
        type: 'trainer',
        message: `Trainer is already scheduled for "${session.title}" during this time`,
        severity: 'error',
        conflictingSessionId: session.id,
        conflictingSessionTitle: session.title
      })
    }

    if (session.location === draggedSession.location && draggedSession.location) {
      conflicts.push({
        type: 'room',
        message: `Room "${session.location}" is already booked for "${session.title}"`,
        severity: 'error',
        conflictingSessionId: session.id,
        conflictingSessionTitle: session.title
      })
    }

    const conflictingStudents = draggedSession.enrolledStudents.filter(studentId =>
      session.enrolledStudents.includes(studentId)
    )

    if (conflictingStudents.length > 0) {
      const studentNames = conflictingStudents
        .map(id => users.find(u => u.id === id)?.name || 'Unknown')
        .slice(0, 3)
        .join(', ')
      
      const remainingCount = conflictingStudents.length - 3
      const displayNames = remainingCount > 0 
        ? `${studentNames}, and ${remainingCount} more`
        : studentNames

      conflicts.push({
        type: 'student',
        message: `${conflictingStudents.length} student${conflictingStudents.length > 1 ? 's are' : ' is'} already enrolled in "${session.title}": ${displayNames}`,
        severity: 'error',
        conflictingSessionId: session.id,
        conflictingSessionTitle: session.title,
        affectedResourceIds: conflictingStudents
      })
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  }
}

/**
 * Formats an array of conflicts into a single human-readable message string,
 * grouping errors before warnings and prefixing each item with a bullet point.
 *
 * @param conflicts - The conflicts to format; an empty array returns an empty string.
 * @returns A newline-separated message string, or `''` if there are no conflicts.
 */
export function formatConflictMessage(conflicts: Conflict[]): string {
  if (conflicts.length === 0) return ''
  
  const errorConflicts = conflicts.filter(c => c.severity === 'error')
  const warningConflicts = conflicts.filter(c => c.severity === 'warning')
  
  const messages: string[] = []
  
  if (errorConflicts.length > 0) {
    messages.push('Cannot move session:')
    errorConflicts.forEach(c => {
      messages.push(`• ${c.message}`)
    })
  }
  
  if (warningConflicts.length > 0) {
    if (errorConflicts.length > 0) messages.push('')
    messages.push('Warnings:')
    warningConflicts.forEach(c => {
      messages.push(`• ${c.message}`)
    })
  }
  
  return messages.join('\n')
}

/**
 * Describes a conflict that would arise from enrolling a specific student
 * into a session whose time overlaps with another session they already attend.
 */
export interface StudentEnrollmentConflict {
  /** ID of the student who has the scheduling conflict. */
  studentId: string
  /** Display name of the conflicting student. */
  studentName: string
  /** The existing session that overlaps with the target session. */
  conflictingSession: Session
  /** Human-readable description of the conflict for display in the UI. */
  message: string
}

/**
 * The result of checking multiple students for enrollment conflicts,
 * separating conflicting students from those who can safely be enrolled.
 */
export interface EnrollmentConflictCheckResult {
  /** `true` if at least one student has an enrollment conflict. */
  hasConflicts: boolean
  /** Details of every student who cannot be enrolled due to a time conflict. */
  conflicts: StudentEnrollmentConflict[]
  /** IDs of students who have no conflict and may be enrolled. */
  allowedStudents: string[]
}

/**
 * Checks a list of students for scheduling conflicts before enrolling them
 * in a given session. A conflict occurs when a student is already enrolled
 * in another session that overlaps with the target session's time window.
 *
 * @param session - The session candidates are being enrolled into.
 * @param studentIds - IDs of the students to evaluate.
 * @param allSessions - All sessions in the system, used for overlap detection.
 * @param users - Full user list, used to resolve student names.
 * @returns An {@link EnrollmentConflictCheckResult} partitioning students into allowed and conflicting groups.
 */
export function checkStudentEnrollmentConflicts(
  session: Session,
  studentIds: string[],
  allSessions: Session[],
  users: User[]
): EnrollmentConflictCheckResult {
  const conflicts: StudentEnrollmentConflict[] = []
  const allowedStudents: string[] = []

  const sessionStart = new Date(session.startTime)
  const sessionEnd = new Date(session.endTime)

  for (const studentId of studentIds) {
    let hasConflict = false
    const student = users.find(u => u.id === studentId)
    const studentName = student?.name || 'Unknown Student'

    for (const otherSession of allSessions) {
      if (otherSession.id === session.id) continue
      if (!otherSession.enrolledStudents.includes(studentId)) continue

      const otherStart = new Date(otherSession.startTime)
      const otherEnd = new Date(otherSession.endTime)

      const hasTimeOverlap =
        (sessionStart >= otherStart && sessionStart < otherEnd) ||
        (sessionEnd > otherStart && sessionEnd <= otherEnd) ||
        (sessionStart <= otherStart && sessionEnd >= otherEnd)

      if (hasTimeOverlap) {
        conflicts.push({
          studentId,
          studentName,
          conflictingSession: otherSession,
          message: `${studentName} is already enrolled in "${otherSession.title}" at this time`
        })
        hasConflict = true
        break
      }
    }

    if (!hasConflict) {
      allowedStudents.push(studentId)
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    allowedStudents
  }
}
