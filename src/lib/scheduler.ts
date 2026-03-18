import { User, Session, Course, ShiftType } from './types'
import { addDays, isWithinInterval } from 'date-fns'

/**
 * Defines the constraints used when scheduling one or more training sessions,
 * including course, timing, location, and optional recurrence settings.
 */
export interface SchedulingConstraints {
  /** The ID of the course for which sessions are being scheduled. */
  courseId: string
  /** List of certification names that a trainer must hold to lead this session. */
  requiredCertifications: string[]
  /** ISO date strings (e.g. `"2024-06-01"`) on which sessions should be scheduled. */
  dates: string[]
  /** Wall-clock start time of each session in `HH:MM` 24-hour format. */
  startTime: string
  /** Wall-clock end time of each session in `HH:MM` 24-hour format. */
  endTime: string
  /** Physical or virtual location where the session will be held. */
  location: string
  /** Maximum number of participants that can be enrolled in each session. */
  capacity: number
  /** Optional recurrence rule that generates additional session dates after each base date. */
  recurrence?: {
    /** How frequently recurring sessions should be generated. */
    frequency: 'daily' | 'weekly' | 'monthly'
    /** ISO date string after which no more recurring sessions are generated. */
    endDate: string
  }
  /** Shift periods (day / evening / night) that the session must be scheduled during. */
  shifts?: ShiftType[]
}

/**
 * Represents the result of evaluating a single trainer against a set of
 * scheduling constraints, including a numeric suitability score and
 * human-readable match reasons or conflict descriptions.
 */
export interface TrainerMatch {
  /** The trainer user object being evaluated. */
  trainer: User
  /** Composite suitability score (higher is better; 0 means ineligible). */
  score: number
  /** Human-readable reasons explaining why this trainer is a good match. */
  matchReasons: string[]
  /** Human-readable descriptions of any conflicts or shortcomings found. */
  conflicts: string[]
  /** Derived availability status based on the evaluated score and conflicts. */
  availability: 'available' | 'partial' | 'unavailable'
}

/**
 * Describes a single conflict or problem detected while attempting to schedule
 * one or more sessions.
 */
export interface ScheduleConflict {
  /** Category of the conflict that was detected. */
  type: 'trainer-overlap' | 'student-overlap' | 'capacity-exceeded' | 'no-trainers' | 'shift-mismatch' | 'invalid-course'
  /** ID of the resource (e.g. trainer or student) involved in the conflict, if applicable. */
  resourceId?: string
  /** Human-readable name of the conflicting resource, if applicable. */
  resourceName?: string
  /** ID of an existing session involved in the conflict, if applicable. */
  sessionId?: string
  /** Human-readable description of the conflict. */
  message: string
}

/**
 * The outcome returned by {@link TrainerScheduler.autoScheduleSessions},
 * containing all sessions that could be created, any conflicts encountered,
 * and actionable recommendations.
 */
export interface SchedulingResult {
  /** `true` if at least one session was successfully scheduled. */
  success: boolean
  /** Partial session objects ready to be persisted. */
  sessions: Partial<Session>[]
  /** All conflicts detected during the scheduling attempt. */
  conflicts: ScheduleConflict[]
  /** Human-readable suggestions for resolving conflicts or improving the schedule. */
  recommendations: string[]
}

/**
 * Handles trainer matching, conflict detection, workload analysis, and
 * automatic session scheduling for training courses.
 *
 * Filters the provided user list to only trainer-role accounts, then exposes
 * methods to evaluate trainer suitability, generate session objects, and
 * analyse scheduling feasibility against existing sessions and courses.
 */
export class TrainerScheduler {
  /** All users with the `trainer` role. */
  private trainers: User[]
  /** Already-persisted sessions used for conflict and workload checks. */
  private existingSessions: Session[]
  /** Available courses used to validate course IDs and look up titles. */
  private courses: Course[]

  /** Lookup array mapping `Date.getUTCDay()` index to lowercase day name. */
  private readonly dayOfWeekMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

  /**
   * Creates a new `TrainerScheduler` instance.
   *
   * @param trainers - Full list of application users; non-trainer roles are filtered out automatically.
   * @param sessions - All existing sessions used for conflict and workload calculations.
   * @param courses - All available courses used for validation and title lookup.
   */
  constructor(trainers: User[], sessions: Session[], courses: Course[]) {
    this.trainers = trainers.filter(u => u.role === 'trainer')
    this.existingSessions = sessions
    this.courses = courses
  }

  /**
   * Evaluates every trainer against the given constraints for a specific date
   * and returns the eligible matches sorted by descending score.
   *
   * @param constraints - The scheduling requirements (certifications, time, etc.).
   * @param targetDate - The calendar date for which availability is evaluated.
   * @returns Sorted array of {@link TrainerMatch} objects; trainers with a score of 0 are excluded.
   */
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

  /**
   * Produces a {@link TrainerMatch} for a single trainer by checking
   * certifications, shift overlap, time conflicts, and current workload.
   *
   * Returns a score of 0 and `availability: 'unavailable'` immediately if
   * the trainer lacks a required certification or does not work during the
   * requested session window.
   *
   * @param trainer - The trainer user to evaluate.
   * @param constraints - Scheduling requirements to check against.
   * @param targetDate - The specific date being evaluated.
   * @returns A fully populated {@link TrainerMatch} for the trainer.
   */
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
      conflicts.push(`Trainer does not work on this day/time`)
      return {
        trainer,
        score: 0,
        matchReasons,
        conflicts,
        availability: 'unavailable'
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

  /**
   * Compares a trainer's certifications against a required list using
   * case-insensitive matching.
   *
   * @param trainer - The trainer whose certifications are checked.
   * @param required - The list of certification names that must be present.
   * @returns An object indicating whether all requirements are met, which
   *   certifications were matched, and which are missing.
   */
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



  /**
   * Determines whether a trainer is scheduled to work during the proposed
   * session window by comparing the session time against each of the trainer's
   * shift schedules on the target day.
   *
   * Handles overnight shifts (where end time is numerically less than start
   * time) by adding 24 hours to the end.
   *
   * @param trainer - The trainer whose shift schedules are inspected.
   * @param targetDate - The UTC date of the proposed session.
   * @param startTime - Session start in `HH:MM` 24-hour format.
   * @param endTime - Session end in `HH:MM` 24-hour format.
   * @returns An object indicating whether any shift overlaps with the session
   *   window and the human-readable labels of those overlapping shifts.
   */
  private checkDetailedShiftOverlap(
    trainer: User,
    targetDate: Date,
    startTime: string,
    endTime: string
  ): { hasOverlap: boolean; overlappingSchedules: string[] } {
    if (!trainer.trainerProfile?.shiftSchedules || trainer.trainerProfile.shiftSchedules.length === 0) {
      return { hasOverlap: false, overlappingSchedules: [] }
    }

    const targetDayOfWeek = this.dayOfWeekMap[targetDate.getUTCDay()]

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

  /**
   * Detects overlaps between the proposed session window and any existing,
   * non-cancelled sessions assigned to the trainer on the same date.
   *
   * @param trainer - The trainer to check for existing session conflicts.
   * @param targetDate - The UTC date of the proposed session.
   * @param constraints - Contains the `startTime` and `endTime` of the proposed session.
   * @returns An array of human-readable conflict descriptions; empty if no conflicts exist.
   */
  private checkTimeConflicts(
    trainer: User,
    targetDate: Date,
    constraints: SchedulingConstraints
  ): string[] {
    const conflicts: string[] = []

    const proposedStart = this.combineDateWithTimeUtc(targetDate, constraints.startTime)
    const proposedEnd = this.combineDateWithTimeUtc(targetDate, constraints.endTime)

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

  /**
   * Calculates a score adjustment based on how many non-cancelled sessions the
   * trainer already has scheduled in the same UTC week as `targetDate`.
   *
   * Fewer sessions yield a higher (positive) score; many sessions yield a
   * penalty (negative score).
   *
   * @param trainer - The trainer whose weekly session count is measured.
   * @param targetDate - Used to determine the boundaries of the relevant week.
   * @returns An object with a numeric `score` adjustment and an optional
   *   human-readable `message` describing the workload level.
   */
  private calculateWorkloadScore(trainer: User, targetDate: Date): { score: number; message?: string } {
    const weekStart = this.getUtcWeekStart(targetDate)
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

  /**
   * Maps a composite score and conflict list to a three-level availability
   * label used in {@link TrainerMatch}.
   *
   * A trainer with missing certifications is always `'unavailable'` regardless
   * of score. Otherwise, scores ≥ 70 map to `'available'`, ≥ 40 to
   * `'partial'`, and below 40 to `'unavailable'`.
   *
   * @param score - The composite suitability score for the trainer.
   * @param conflicts - List of conflict descriptions already collected.
   * @returns The derived availability status.
   */
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

  /**
   * Attempts to create and assign sessions for every date derived from the
   * provided constraints (including any recurrence expansion).
   *
   * Validates the course ID first, then iterates over all generated dates,
   * finds the best available trainer for each, and builds partial session
   * objects ready for persistence. Conflicts and recommendations are collected
   * throughout and included in the result.
   *
   * @param constraints - Full scheduling constraints including course, dates, times, and recurrence.
   * @returns A {@link SchedulingResult} with generated sessions, detected conflicts, and recommendations.
   */
  autoScheduleSessions(constraints: SchedulingConstraints): SchedulingResult {
    const sessions: Partial<Session>[] = []
    const conflicts: ScheduleConflict[] = []
    const recommendations: string[] = []

    const course = this.courses.find(c => c.id === constraints.courseId)
    if (!course) {
      conflicts.push({
        type: 'invalid-course',
        message: `Course "${constraints.courseId}" does not exist`
      })
      recommendations.push('Select a valid course before scheduling sessions')
      return { success: false, sessions, conflicts, recommendations }
    }

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

  /**
   * Schedules a single session on the given date by selecting the highest-scoring
   * available trainer and constructing a partial session object.
   *
   * Pushes conflict or recommendation entries into the caller-supplied arrays when
   * no suitable trainer is found or the best match is only a partial fit.
   *
   * @param constraints - Scheduling constraints used to find trainers and build the session.
   * @param date - The specific date for this session.
   * @param conflicts - Mutable array to which any detected conflicts are appended.
   * @param recommendations - Mutable array to which any advisory messages are appended.
   * @returns A partial {@link Session} object if scheduling succeeded, or `null` on failure.
   */
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

    const startTime = this.combineDateWithTimeUtc(date, constraints.startTime)
    const endTime = this.combineDateWithTimeUtc(date, constraints.endTime)

    return {
      courseId: constraints.courseId,
      trainerId: topTrainer.trainer.id,
      title: course?.title || 'Training Session',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      location: constraints.location,
      capacity: constraints.capacity,
      enrolledStudents: [],
      status: 'scheduled',
      ...(constraints.recurrence && { recurrence: constraints.recurrence })
    }
  }

  /**
   * Converts the constraint's `dates` array into `Date` objects and expands
   * them with any recurrence rules to produce the full set of dates on which
   * sessions should be created.
   *
   * The returned array is sorted in ascending chronological order.
   *
   * @param constraints - Contains base dates and an optional recurrence rule.
   * @returns Sorted array of `Date` objects covering all intended session dates.
   */
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

  /**
   * Constructs a UTC `Date` by combining the year/month/day components of
   * `date` with the hours and minutes parsed from `time`.
   *
   * @param date - Provides the UTC year, month, and day.
   * @param time - Wall-clock time string in `HH:MM` 24-hour format.
   * @returns A new `Date` set to the combined UTC date and time.
   * @throws {Error} If `time` does not match the `HH:MM` format.
   */
  private combineDateWithTimeUtc(date: Date, time: string): Date {
    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)

    if (!timeMatch) {
      throw new Error(`Invalid time format: "${time}". Expected HH:MM in 24-hour format.`)
    }

    const hour = Number.parseInt(timeMatch[1], 10)
    const minute = Number.parseInt(timeMatch[2], 10)

    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        hour,
        minute,
        0,
        0
      )
    )
  }

  /**
   * Returns the Sunday that begins the week containing `date`, expressed
   * in UTC midnight.
   *
   * @param date - Any date within the week of interest.
   * @returns A `Date` representing 00:00 UTC on the Sunday starting that week.
   */
  private getUtcWeekStart(date: Date): Date {
    const utcMidnight = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    )
    return addDays(utcMidnight, -utcMidnight.getUTCDay())
  }

  /**
   * Generates additional session dates by stepping forward from `startDate`
   * according to the recurrence frequency until the `endDate` is reached.
   *
   * Note: "monthly" recurrence is approximated as 30-day intervals.
   *
   * @param startDate - The first occurrence date (not included in the returned array).
   * @param recurrence - Contains the `frequency` step and the exclusive `endDate`.
   * @returns An array of `Date` objects for each generated recurrence.
   */
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

  /**
   * Selects the primary (most daytime-preferred) shift from a list of shifts,
   * using the priority order: `day` → `evening` → `night`.
   *
   * @param shifts - Array of shift types assigned to a trainer.
   * @returns The highest-priority shift type present in the array.
   */
  private getPrimaryShift(shifts: ShiftType[]): ShiftType {
    if (shifts.includes('day')) return 'day'
    if (shifts.includes('evening')) return 'evening'
    return 'night'
  }

  /**
   * Formats a `Date` as a human-readable 12-hour clock string in UTC,
   * e.g. `"9:00 AM"`.
   *
   * @param date - The date/time to format.
   * @returns A locale-formatted time string.
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    })
  }

  /**
   * Formats a `Date` as a verbose human-readable date string,
   * e.g. `"Monday, Jun 1, 2024"`.
   *
   * @param date - The date to format.
   * @returns A locale-formatted date string including weekday.
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  /**
   * Finds eligible trainers for the given constraints and date, excluding any
   * trainer IDs in `excludeTrainerIds` and filtering out zero-score matches.
   *
   * Useful for surfacing substitutes when the originally assigned trainer
   * becomes unavailable.
   *
   * @param constraints - Scheduling requirements to evaluate trainers against.
   * @param targetDate - The date for which alternative trainers are needed.
   * @param excludeTrainerIds - IDs of trainers to omit from the results (defaults to `[]`).
   * @returns Filtered and sorted array of {@link TrainerMatch} objects.
   */
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

  /**
   * Performs a lightweight feasibility check for the given scheduling
   * constraints without actually creating sessions.
   *
   * Checks whether certified trainers exist and whether any of them work the
   * required shifts. Also warns when the number of requested dates exceeds
   * estimated trainer capacity.
   *
   * @param constraints - The scheduling constraints to evaluate.
   * @returns An object indicating feasibility, the count of qualified trainers,
   *   a list of detected issues, and actionable suggestions for resolving them.
   */
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

  /**
   * Aggregates workload metrics for a specific trainer over a date range.
   *
   * Counts all non-cancelled sessions that start within the interval, sums
   * their durations in hours, and breaks down the count by shift type.
   *
   * @param trainerId - The ID of the trainer to analyse.
   * @param startDate - Inclusive start of the date range.
   * @param endDate - Inclusive end of the date range.
   * @returns An object with total session count, total scheduled hours,
   *   a per-shift session breakdown, and a `conflicts` count (currently always 0).
   */
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
