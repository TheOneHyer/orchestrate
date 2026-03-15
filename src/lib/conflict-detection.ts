import { Session, User } from './types'

export interface Conflict {
  type: 'trainer' | 'room'
  message: string
  severity: 'warning' | 'error'
  conflictingSessionId: string
  conflictingSessionTitle: string
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
