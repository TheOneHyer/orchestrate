import { User, Session, ShiftType, UserRole } from './types'

export const PERMISSIONS = {
  admin: ['view_all', 'create_course', 'edit_course', 'delete_course', 'manage_users', 'view_analytics', 'send_notifications', 'create_session', 'edit_session', 'delete_session'],
  trainer: ['view_assigned', 'create_course', 'edit_own_course', 'create_session', 'edit_own_session', 'view_students', 'grade_assignments'],
  employee: ['view_enrolled', 'take_course', 'view_own_progress']
}

export function hasPermission(role: UserRole, permission: string): boolean {
  return PERMISSIONS[role]?.includes(permission) || false
}

export function canAccessCourse(user: User, courseCreatorId: string): boolean {
  if (user.role === 'admin') return true
  if (user.role === 'trainer' && user.id === courseCreatorId) return true
  return false
}

export function canAccessSession(user: User, session: Session): boolean {
  if (user.role === 'admin') return true
  if (user.role === 'trainer' && session.trainerId === user.id) return true
  if (user.role === 'employee' && session.enrolledStudents.includes(user.id)) return true
  return false
}

export function findAvailableTrainers(
  users: User[],
  requiredCertifications: string[],
  shift: ShiftType,
  excludeUserIds: string[] = []
): User[] {
  return users.filter(user => {
    if (user.role !== 'trainer') return false
    if (excludeUserIds.includes(user.id)) return false
    if (!user.shifts.includes(shift)) return false
    
    const hasCertifications = requiredCertifications.every(cert => 
      user.certifications.includes(cert)
    )
    
    return hasCertifications
  })
}

export function checkScheduleConflict(
  user: User,
  sessions: Session[],
  newSession: { startTime: string; endTime: string }
): boolean {
  const newStart = new Date(newSession.startTime)
  const newEnd = new Date(newSession.endTime)
  
  return sessions.some(session => {
    const sessionStart = new Date(session.startTime)
    const sessionEnd = new Date(session.endTime)
    
    const hasOverlap = (
      (newStart >= sessionStart && newStart < sessionEnd) ||
      (newEnd > sessionStart && newEnd <= sessionEnd) ||
      (newStart <= sessionStart && newEnd >= sessionEnd)
    )
    
    return hasOverlap && (
      session.trainerId === user.id ||
      session.enrolledStudents.includes(user.id)
    )
  })
}

export function calculateProgress(completedModules: number, totalModules: number): number {
  if (totalModules === 0) return 0
  return Math.round((completedModules / totalModules) * 100)
}

export function getShiftTimeRange(shift: ShiftType): { start: string; end: string } {
  const ranges = {
    day: { start: '06:00', end: '14:00' },
    evening: { start: '14:00', end: '22:00' },
    night: { start: '22:00', end: '06:00' }
  }
  return ranges[shift]
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function sortByDate(a: { startTime?: string; createdAt?: string }, b: { startTime?: string; createdAt?: string }): number {
  const dateA = new Date(a.startTime || a.createdAt || 0)
  const dateB = new Date(b.startTime || b.createdAt || 0)
  return dateB.getTime() - dateA.getTime()
}
