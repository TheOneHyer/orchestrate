import { User, Session, UserRole } from './types'

/**
 * Maps each user role to its list of allowed permission strings.
 * Admins hold the broadest set; employees the narrowest.
 */
export const PERMISSIONS = {
  admin: ['view_all', 'create_course', 'edit_course', 'delete_course', 'manage_users', 'view_analytics', 'send_notifications', 'create_session', 'edit_session', 'delete_session'],
  trainer: ['view_assigned', 'create_course', 'edit_own_course', 'create_session', 'edit_own_session', 'view_students', 'grade_assignments'],
  employee: ['view_enrolled', 'take_course', 'view_own_progress']
}

/**
 * Checks whether a given role includes a specific permission.
 *
 * @param role - The role to check against the {@link PERMISSIONS} map.
 * @param permission - The permission string to look up.
 * @returns `true` if the role has the permission, `false` otherwise.
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  return PERMISSIONS[role]?.includes(permission) || false
}

/**
 * Determines whether a user may read or edit a course based on their role
 * and whether they created the course.
 *
 * @param user - The user requesting access.
 * @param courseCreatorId - The user ID of the course's original creator.
 * @returns `true` if the user is an admin, or a trainer who created the course.
 */
export function canAccessCourse(user: User, courseCreatorId: string): boolean {
  if (user.role === 'admin') return true
  if (user.role === 'trainer' && user.id === courseCreatorId) return true
  return false
}

/**
 * Determines whether a user may access a specific session.
 *
 * Admins can access any session. Trainers can access sessions they lead.
 * Employees can access sessions in which they are enrolled.
 *
 * @param user - The user requesting access.
 * @param session - The session being accessed.
 * @returns `true` if the user has permission to access the session.
 */
export function canAccessSession(user: User, session: Session): boolean {
  if (user.role === 'admin') return true
  if (user.role === 'trainer' && session.trainerId === user.id) return true
  if (user.role === 'employee' && session.enrolledStudents.includes(user.id)) return true
  return false
}

/**
 * Filters a list of users to those who are trainers, hold all required
 * certifications, and are not in the exclusion list.
 *
 * @param users - Full list of users to search.
 * @param requiredCertifications - Certifications every returned trainer must possess.
 * @param excludeUserIds - User IDs to exclude from the results (e.g. already assigned trainers).
 * @returns Array of trainers who meet all criteria.
 */
export function findAvailableTrainers(
  users: User[],
  requiredCertifications: string[],
  excludeUserIds: string[] = []
): User[] {
  return users.filter(user => {
    if (user.role !== 'trainer') return false
    if (excludeUserIds.includes(user.id)) return false
    
    const hasCertifications = requiredCertifications.every(cert => 
      user.certifications.includes(cert)
    )
    
    return hasCertifications
  })
}

/**
 * Checks whether a user (as a trainer or enrolled student) has a scheduling
 * conflict with a proposed new session time.
 *
 * A conflict exists when the new session time overlaps with any existing session
 * in which the user is either the trainer or an enrolled student.
 *
 * @param user - The user whose schedule is being checked.
 * @param sessions - Existing sessions to check against.
 * @param newSession - The proposed session time window.
 * @returns `true` if at least one conflict is found, `false` otherwise.
 */
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

/**
 * Calculates the percentage of modules completed, rounded to the nearest integer.
 *
 * @param completedModules - Number of modules the user has finished.
 * @param totalModules - Total number of modules in the course.
 * @returns Completion percentage (0–100), or 0 if there are no modules.
 */
export function calculateProgress(completedModules: number, totalModules: number): number {
  if (totalModules === 0) return 0
  return Math.round((completedModules / totalModules) * 100)
}

/**
 * Formats a duration given in minutes into a human-readable string
 * such as `"2h 30m"`, `"2h"`, or `"45m"`.
 *
 * @param minutes - Total duration in minutes.
 * @returns A formatted duration string.
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/**
 * Generates a loosely unique ID string by combining the current timestamp
 * with a random alphanumeric suffix.
 *
 * @returns A unique identifier string in the form `"<timestamp>-<random>"`.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Comparator function for sorting objects in descending chronological order.
 * Uses `startTime` if present, falling back to `createdAt`.
 *
 * @param a - First object to compare.
 * @param b - Second object to compare.
 * @returns Negative, zero, or positive number suitable for `Array.prototype.sort`.
 */
export function sortByDate(a: { startTime?: string; createdAt?: string }, b: { startTime?: string; createdAt?: string }): number {
  const dateA = new Date(a.startTime || a.createdAt || 0)
  const dateB = new Date(b.startTime || b.createdAt || 0)
  return dateB.getTime() - dateA.getTime()
}

/**
 * Calculates the duration between two `Date` objects in fractional hours.
 *
 * Handles overnight sessions (where `endTime` is numerically before `startTime`)
 * by treating the end time as belonging to the following calendar day.
 *
 * @param startTime - The session start date/time.
 * @param endTime - The session end date/time.
 * @returns Duration in hours (always non-negative).
 */
export function calculateSessionDuration(startTime: Date, endTime: Date): number {
  const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
  
  if (duration < 0) {
    return (24 * 60 * 60 * 1000 + endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
  }
  
  return duration
}

/**
 * Returns `true` if a trainer user has at least one shift schedule configured
 * in their trainer profile.
 *
 * @param user - The user to inspect.
 * @returns `true` if the user has one or more configured shift schedules.
 */
export function hasConfiguredSchedule(user: User): boolean {
  return !!(user.trainerProfile?.shiftSchedules && user.trainerProfile.shiftSchedules.length > 0)
}

/**
 * Filters a list of users to return only trainers who have no shift schedules configured.
 *
 * @param users - Full list of users to inspect.
 * @returns Array of trainer users with no configured shift schedules.
 */
export function getTrainersWithoutSchedules(users: User[]): User[] {
  return users.filter(user => user.role === 'trainer' && !hasConfiguredSchedule(user))
}
