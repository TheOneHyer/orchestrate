import { Session, User } from './types'

export interface Conflict {
  type: 'trainer' | 'room' | 'student'
  message: string
  severity: 'warning' | 'error'
  conflictingSessionId: string
  conflictingSessionTitle: string
  affectedResourceIds?: string[]
}

export interface ConflictCheckResult {
  hasConflicts: boolean
  conflicts: Conflict[]
}

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

export interface StudentEnrollmentConflict {
  studentId: string
  studentName: string
  conflictingSession: Session
  message: string
}

export interface EnrollmentConflictCheckResult {
  hasConflicts: boolean
  conflicts: StudentEnrollmentConflict[]
  allowedStudents: string[]
}

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
