import { User, Session, Course, ShiftType } from './types'
import { addDays, isWithinInterval, setHours, setMinutes } from 'date-fns'

export interface SchedulingConstraints {
  courseId: string
  requiredCertifications: string[]
  shifts: ShiftType[]
  dates: string[]
  startTime: string
  endTime: string
  location: string
  capacity: number
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly'
    endDate: string
  }
}

export interface TrainerMatch {
  trainer: User
  score: number
  matchReasons: string[]
  conflicts: string[]
  availability: 'available' | 'partial' | 'unavailable'
}

export interface ScheduleConflict {
  type: 'trainer-overlap' | 'student-overlap' | 'capacity-exceeded' | 'no-trainers' | 'shift-mismatch'
  resourceId?: string
  resourceName?: string
  sessionId?: string
  message: string
}

export interface SchedulingResult {
  success: boolean
  sessions: Partial<Session>[]
  conflicts: ScheduleConflict[]
  recommendations: string[]
}

export class TrainerScheduler {
  private trainers: User[]
  private existingSessions: Session[]
  private courses: Course[]

  constructor(trainers: User[], sessions: Session[], courses: Course[]) {
    this.trainers = trainers.filter(u => u.role === 'trainer')
    this.existingSessions = sessions
    this.courses = courses
  }

  findAvailableTrainers(constraints: SchedulingConstraints, targetDate: Date): TrainerMatch[] {
    const matches: TrainerMatch[] = []

    for (const trainer of this.trainers) {
      const match = this.evaluateTrainer(trainer, constraints, targetDate)
      if (match.score > 0) {
        matches.push(match)
      }
    }

    return matches.sort((a, b) => b.score - a.score)
  }

  private evaluateTrainer(
    trainer: User,
    constraints: SchedulingConstraints,
    targetDate: Date
  ): TrainerMatch {
    const matchReasons: string[] = []
    const conflicts: string[] = []
    let score = 0

    const hasCertifications = this.checkCertifications(
      trainer,
      constraints.requiredCertifications
    )
    if (hasCertifications.matches) {
      score += 50
      matchReasons.push(`Has all required certifications: ${hasCertifications.matched.join(', ')}`)
    } else {
      conflicts.push(`Missing certifications: ${hasCertifications.missing.join(', ')}`)
      return {
        trainer,
        score: 0,
        matchReasons,
        conflicts,
        availability: 'unavailable'
      }
    }

    const detailedShiftCheck = this.checkDetailedShiftOverlap(
      trainer,
      targetDate,
      constraints.startTime,
      constraints.endTime
    )

    if (detailedShiftCheck.hasOverlap) {
      score += 30
      matchReasons.push(`Working during session time: ${detailedShiftCheck.overlappingSchedules.join(', ')}`)
    } else {
      const hasShiftAlignment = this.checkShiftAlignment(trainer, constraints.shifts)
      if (hasShiftAlignment.matches) {
        score += 15
        matchReasons.push(`Works matching shifts: ${hasShiftAlignment.matched.join(', ')}, but no detailed schedule configured`)
        conflicts.push('Work schedule not configured - unable to verify actual time availability')
      } else {
        conflicts.push(`No shift overlap - trainer does not work on this day/time`)
        return {
          trainer,
          score: 0,
          matchReasons,
          conflicts,
          availability: 'unavailable'
        }
      }
    }

    const timeConflicts = this.checkTimeConflicts(trainer, targetDate, constraints)
    if (timeConflicts.length === 0) {
      score += 20
      matchReasons.push('No scheduling conflicts')
    } else {
      conflicts.push(...timeConflicts)
      score -= timeConflicts.length * 10
    }

    const workloadScore = this.calculateWorkloadScore(trainer, targetDate)
    score += workloadScore.score
    if (workloadScore.message) {
      matchReasons.push(workloadScore.message)
    }

    const availability = this.determineAvailability(score, conflicts)

    return {
      trainer,
      score: Math.max(0, score),
      matchReasons,
      conflicts,
      availability
    }
  }

  private checkCertifications(
    trainer: User,
    required: string[]
  ): { matches: boolean; matched: string[]; missing: string[] } {
    const matched = required.filter(cert => 
      trainer.certifications.some(tc => 
        tc.toLowerCase() === cert.toLowerCase()
      )
    )
    const missing = required.filter(cert => !matched.includes(cert))
    
    return {
      matches: missing.length === 0,
      matched,
      missing
    }
  }

  private checkShiftAlignment(
    trainer: User,
    requiredShifts: ShiftType[]
  ): { matches: boolean; matched: ShiftType[] } {
    const matched = requiredShifts.filter(shift => 
      trainer.shifts.includes(shift)
    )
    
    return {
      matches: matched.length > 0,
      matched
    }
  }

  private checkDetailedShiftOverlap(
    trainer: User,
    targetDate: Date,
    startTime: string,
    endTime: string
  ): { hasOverlap: boolean; overlappingSchedules: string[] } {
    if (!trainer.trainerProfile?.shiftSchedules || trainer.trainerProfile.shiftSchedules.length === 0) {
      return { hasOverlap: false, overlappingSchedules: [] }
    }

    const dayOfWeekMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const targetDayOfWeek = dayOfWeekMap[targetDate.getDay()] as any

    const [sessionStartHour, sessionStartMin] = startTime.split(':').map(Number)
    const [sessionEndHour, sessionEndMin] = endTime.split(':').map(Number)

    const sessionStartMinutes = sessionStartHour * 60 + sessionStartMin
    const sessionEndMinutes = sessionEndHour * 60 + sessionEndMin

    const overlappingSchedules: string[] = []

    for (const schedule of trainer.trainerProfile.shiftSchedules) {
      if (!schedule.daysWorked.includes(targetDayOfWeek)) {
        continue
      }

      const [schedStartHour, schedStartMin] = schedule.startTime.split(':').map(Number)
      const [schedEndHour, schedEndMin] = schedule.endTime.split(':').map(Number)

      let schedStartMinutes = schedStartHour * 60 + schedStartMin
      let schedEndMinutes = schedEndHour * 60 + schedEndMin

      if (schedEndMinutes < schedStartMinutes) {
        schedEndMinutes += 24 * 60
      }

      const hasOverlap = (
        (sessionStartMinutes >= schedStartMinutes && sessionStartMinutes < schedEndMinutes) ||
        (sessionEndMinutes > schedStartMinutes && sessionEndMinutes <= schedEndMinutes) ||
        (sessionStartMinutes <= schedStartMinutes && sessionEndMinutes >= schedEndMinutes)
      )

      if (hasOverlap) {
        overlappingSchedules.push(`${schedule.shiftCode} (${schedule.startTime}-${schedule.endTime})`)
      }
    }

    return {
      hasOverlap: overlappingSchedules.length > 0,
      overlappingSchedules
    }
  }

  private checkTimeConflicts(
    trainer: User,
    targetDate: Date,
    constraints: SchedulingConstraints
  ): string[] {
    const conflicts: string[] = []
    
    const [startHour, startMin] = constraints.startTime.split(':').map(Number)
    const [endHour, endMin] = constraints.endTime.split(':').map(Number)
    
    const proposedStart = setMinutes(setHours(targetDate, startHour), startMin)
    const proposedEnd = setMinutes(setHours(targetDate, endHour), endMin)

    const trainerSessions = this.existingSessions.filter(
      session => session.trainerId === trainer.id &&
                 session.status !== 'cancelled'
    )

    for (const session of trainerSessions) {
      const sessionStart = new Date(session.startTime)
      const sessionEnd = new Date(session.endTime)

      if (
        (proposedStart >= sessionStart && proposedStart < sessionEnd) ||
        (proposedEnd > sessionStart && proposedEnd <= sessionEnd) ||
        (proposedStart <= sessionStart && proposedEnd >= sessionEnd)
      ) {
        conflicts.push(
          `Conflict with session "${session.title}" (${this.formatTime(sessionStart)} - ${this.formatTime(sessionEnd)})`
        )
      }
    }

    return conflicts
  }

  private calculateWorkloadScore(trainer: User, targetDate: Date): { score: number; message?: string } {
    const weekStart = addDays(targetDate, -targetDate.getDay())
    const weekEnd = addDays(weekStart, 7)

    const weekSessions = this.existingSessions.filter(session => {
      const sessionDate = new Date(session.startTime)
      return session.trainerId === trainer.id &&
             sessionDate >= weekStart &&
             sessionDate < weekEnd &&
             session.status !== 'cancelled'
    })

    if (weekSessions.length === 0) {
      return { score: 10, message: 'Low workload this week - highly available' }
    } else if (weekSessions.length < 3) {
      return { score: 5, message: 'Moderate workload - available' }
    } else if (weekSessions.length < 5) {
      return { score: 0, message: 'High workload this week' }
    } else {
      return { score: -10, message: 'Very high workload - may be overbooked' }
    }
  }

  private determineAvailability(
    score: number,
    conflicts: string[]
  ): 'available' | 'partial' | 'unavailable' {
    if (conflicts.some(c => c.includes('Missing certifications'))) {
      return 'unavailable'
    }
    if (score >= 70) return 'available'
    if (score >= 40) return 'partial'
    return 'unavailable'
  }

  autoScheduleSessions(constraints: SchedulingConstraints): SchedulingResult {
    const sessions: Partial<Session>[] = []
    const conflicts: ScheduleConflict[] = []
    const recommendations: string[] = []

    const dates = this.generateScheduleDates(constraints)

    if (dates.length === 0) {
      conflicts.push({
        type: 'no-trainers',
        message: 'No valid dates found for scheduling'
      })
      return { success: false, sessions, conflicts, recommendations }
    }

    for (const date of dates) {
      const result = this.scheduleSingleSession(constraints, date, conflicts, recommendations)
      if (result) {
        sessions.push(result)
      }
    }

    const course = this.courses.find(c => c.id === constraints.courseId)
    if (course) {
      recommendations.push(
        `Scheduled ${sessions.length} session(s) for "${course.title}"`
      )
    }

    if (sessions.length === 0) {
      recommendations.push(
        'Consider adjusting shift requirements or required certifications to find more trainers'
      )
      recommendations.push(
        'Review trainer availability and consider spreading sessions across more dates'
      )
    }

    return {
      success: sessions.length > 0,
      sessions,
      conflicts,
      recommendations
    }
  }

  private scheduleSingleSession(
    constraints: SchedulingConstraints,
    date: Date,
    conflicts: ScheduleConflict[],
    recommendations: string[]
  ): Partial<Session> | null {
    const availableTrainers = this.findAvailableTrainers(constraints, date)

    if (availableTrainers.length === 0) {
      conflicts.push({
        type: 'no-trainers',
        message: `No qualified trainers available for ${this.formatDate(date)}`
      })
      return null
    }

    const topTrainer = availableTrainers[0]

    if (topTrainer.availability === 'unavailable') {
      conflicts.push({
        type: 'no-trainers',
        resourceId: topTrainer.trainer.id,
        resourceName: topTrainer.trainer.name,
        message: `Best match trainer "${topTrainer.trainer.name}" is unavailable for ${this.formatDate(date)}: ${topTrainer.conflicts.join(', ')}`
      })
      return null
    }

    if (topTrainer.availability === 'partial') {
      recommendations.push(
        `Trainer "${topTrainer.trainer.name}" assigned with partial match (score: ${topTrainer.score}/100). ${topTrainer.conflicts.join('. ')}`
      )
    }

    const course = this.courses.find(c => c.id === constraints.courseId)
    
    const [startHour, startMin] = constraints.startTime.split(':').map(Number)
    const [endHour, endMin] = constraints.endTime.split(':').map(Number)
    
    const startTime = setMinutes(setHours(date, startHour), startMin)
    const endTime = setMinutes(setHours(date, endHour), endMin)

    const primaryShift = this.getPrimaryShift(constraints.shifts)

    return {
      courseId: constraints.courseId,
      trainerId: topTrainer.trainer.id,
      title: course?.title || 'Training Session',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      shift: primaryShift,
      location: constraints.location,
      capacity: constraints.capacity,
      enrolledStudents: [],
      status: 'scheduled',
      ...(constraints.recurrence && { recurrence: constraints.recurrence })
    }
  }

  private generateScheduleDates(constraints: SchedulingConstraints): Date[] {
    const dates: Date[] = []
    
    for (const dateStr of constraints.dates) {
      const date = new Date(dateStr)
      dates.push(date)

      if (constraints.recurrence) {
        const recurrenceDates = this.generateRecurrenceDates(
          date,
          constraints.recurrence
        )
        dates.push(...recurrenceDates)
      }
    }

    return dates.sort((a, b) => a.getTime() - b.getTime())
  }

  private generateRecurrenceDates(
    startDate: Date,
    recurrence: { frequency: 'daily' | 'weekly' | 'monthly'; endDate: string }
  ): Date[] {
    const dates: Date[] = []
    const endDate = new Date(recurrence.endDate)
    let currentDate = new Date(startDate)

    const increment = {
      daily: 1,
      weekly: 7,
      monthly: 30
    }[recurrence.frequency]

    while (currentDate < endDate) {
      currentDate = addDays(currentDate, increment)
      if (currentDate < endDate) {
        dates.push(new Date(currentDate))
      }
    }

    return dates
  }

  private getPrimaryShift(shifts: ShiftType[]): ShiftType {
    if (shifts.includes('day')) return 'day'
    if (shifts.includes('evening')) return 'evening'
    return 'night'
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  findAlternativeTrainers(
    constraints: SchedulingConstraints,
    targetDate: Date,
    excludeTrainerIds: string[] = []
  ): TrainerMatch[] {
    const allMatches = this.findAvailableTrainers(constraints, targetDate)
    return allMatches
      .filter(match => !excludeTrainerIds.includes(match.trainer.id))
      .filter(match => match.score > 0)
  }

  analyzeSchedulingFeasibility(
    constraints: SchedulingConstraints
  ): {
    feasible: boolean
    availableTrainerCount: number
    issues: string[]
    suggestions: string[]
  } {
    const issues: string[] = []
    const suggestions: string[] = []

    const certifiedTrainers = this.trainers.filter(trainer =>
      constraints.requiredCertifications.every(cert =>
        trainer.certifications.some(tc => 
          tc.toLowerCase() === cert.toLowerCase()
        )
      )
    )

    if (certifiedTrainers.length === 0) {
      issues.push('No trainers have the required certifications')
      suggestions.push('Review certification requirements or train additional staff')
    }

    const shiftMatchedTrainers = certifiedTrainers.filter(trainer =>
      constraints.shifts.some(shift => trainer.shifts.includes(shift))
    )

    if (shiftMatchedTrainers.length === 0 && certifiedTrainers.length > 0) {
      issues.push('Certified trainers do not work the required shifts')
      suggestions.push('Adjust shift requirements or trainer schedules')
    }

    const dates = this.generateScheduleDates(constraints)
    if (dates.length > shiftMatchedTrainers.length * 3) {
      issues.push('Too many sessions for available trainer capacity')
      suggestions.push('Consider spreading sessions over a longer period or adding more trainers')
    }

    return {
      feasible: issues.length === 0,
      availableTrainerCount: shiftMatchedTrainers.length,
      issues,
      suggestions
    }
  }

  getTrainerWorkload(
    trainerId: string,
    startDate: Date,
    endDate: Date
  ): {
    totalSessions: number
    scheduledHours: number
    sessionsByShift: Record<ShiftType, number>
    conflicts: number
  } {
    const trainerSessions = this.existingSessions.filter(
      session => session.trainerId === trainerId &&
                 session.status !== 'cancelled' &&
                 isWithinInterval(new Date(session.startTime), { start: startDate, end: endDate })
    )

    const sessionsByShift: Record<ShiftType, number> = {
      day: 0,
      evening: 0,
      night: 0
    }

    let totalHours = 0

    for (const session of trainerSessions) {
      sessionsByShift[session.shift]++
      const duration = (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60)
      totalHours += duration
    }

    return {
      totalSessions: trainerSessions.length,
      scheduledHours: totalHours,
      sessionsByShift,
      conflicts: 0
    }
  }
}
