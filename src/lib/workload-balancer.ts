import { User, Session, Course } from './types'
import { isWithinInterval, startOfDay, endOfDay, addDays, startOfWeek } from 'date-fns'
import { calculateSessionDuration } from './helpers'

/**
 * Aggregated workload statistics for a single trainer within a given date range.
 */
export interface TrainerWorkload {
  /** The trainer user record. */
  trainer: User
  /** Total hours of sessions scheduled within the date range. */
  totalHours: number
  /** Total number of sessions within the date range. */
  sessionCount: number
  /** Utilization as a percentage of the standard 40-hour work week. */
  utilizationRate: number
  /** Remaining available hours before the trainer reaches the weekly limit. */
  availableHours: number
  /** Map of course ID to the number of sessions for that course. */
  sessionsByCourse: Map<string, number>
  /** Map of shift code to the number of sessions in that shift. */
  sessionsPerShift: Map<string, number>
}

/**
 * A workload balancing recommendation produced by the analysis engine.
 */
export interface WorkloadRecommendation {
  /** Category of action required to address the imbalance. */
  type: 'redistribute' | 'hire' | 'reduce' | 'optimize'
  /** Urgency of the recommendation. */
  priority: 'high' | 'medium' | 'low'
  /** Short title summarising the recommendation. */
  title: string
  /** Full human-readable explanation of the recommendation. */
  description: string
  /** Identifiers of the trainers affected by this recommendation. */
  affectedTrainers: string[]
  /** Estimated hours that could be freed by implementing this recommendation. */
  potentialSavings?: number
  /** Whether the recommendation can be acted upon with the current data. */
  actionable: boolean
}

/**
 * The complete output of a workload balance analysis covering all trainers
 * within a specific date range.
 */
export interface WorkloadAnalysis {
  /** Per-trainer workload statistics for all trainers included in the analysis. */
  workloads: TrainerWorkload[]
  /** Subset of trainers whose utilization is at or above the optimal maximum threshold. */
  overutilizedTrainers: TrainerWorkload[]
  /** Subset of trainers whose utilization falls below the optimal minimum threshold. */
  underutilizedTrainers: TrainerWorkload[]
  /** Prioritised list of workload balancing recommendations. */
  recommendations: WorkloadRecommendation[]
  /** A score from 0–100 indicating how evenly the workload is distributed; higher is better. */
  balanceScore: number
  /** Total available training hours across all trainers for the period. */
  totalCapacity: number
  /** Total hours actually scheduled across all trainers for the period. */
  totalUtilization: number
}

const MAX_HOURS_PER_WEEK = 40
const OPTIMAL_UTILIZATION_MIN = 60
const OPTIMAL_UTILIZATION_MAX = 85
const CRITICAL_UTILIZATION = 95

/**
 * Calculates aggregated workload statistics for a single trainer within the
 * specified date range.
 *
 * @param trainer - The trainer whose workload is being calculated.
 * @param sessions - All sessions from which the trainer's sessions are filtered.
 * @param startDate - Start of the evaluation period (inclusive, normalised to start of day).
 * @param endDate - End of the evaluation period (inclusive, normalised to end of day).
 * @returns A {@link TrainerWorkload} object with totals, utilization rate, and session breakdowns.
 */
export function calculateTrainerWorkload(
  trainer: User,
  sessions: Session[],
  startDate: Date,
  endDate: Date
): TrainerWorkload {
  const trainerSessions = sessions.filter(s => 
    s.trainerId === trainer.id &&
    isWithinInterval(new Date(s.startTime), {
      start: startOfDay(startDate),
      end: endOfDay(endDate)
    })
  )

  const totalHours = trainerSessions.reduce((sum, session) => {
    const duration = calculateSessionDuration(
      new Date(session.startTime),
      new Date(session.endTime)
    )
    return sum + duration
  }, 0)

  const utilizationRate = (totalHours / MAX_HOURS_PER_WEEK) * 100
  const availableHours = Math.max(0, MAX_HOURS_PER_WEEK - totalHours)

  const sessionsByCourse = new Map<string, number>()
  const sessionsPerShift = new Map<string, number>()

  trainerSessions.forEach(session => {
    sessionsByCourse.set(session.courseId, (sessionsByCourse.get(session.courseId) || 0) + 1)
  })

  return {
    trainer,
    totalHours,
    sessionCount: trainerSessions.length,
    utilizationRate,
    availableHours,
    sessionsByCourse,
    sessionsPerShift
  }
}

/**
 * Analyses workload distribution across all trainers for a given period and
 * produces recommendations to improve balance.
 *
 * @param users - All users; only those with the `'trainer'` role are included.
 * @param sessions - All sessions used to compute per-trainer workloads.
 * @param courses - Course catalogue used when evaluating redistribution options.
 * @param startDate - Start of the evaluation period. Defaults to the start of the current week (Monday).
 * @param endDate - End of the evaluation period. Defaults to 6 days after `startDate`.
 * @returns A {@link WorkloadAnalysis} containing per-trainer workloads, over/under-utilised subsets,
 *          recommendations, balance score, and aggregate capacity figures.
 */
export function analyzeWorkloadBalance(
  users: User[],
  sessions: Session[],
  courses: Course[],
  startDate?: Date,
  endDate?: Date
): WorkloadAnalysis {
  const start = startDate || startOfWeek(new Date(), { weekStartsOn: 1 })
  const end = endDate || addDays(start, 6)

  const trainers = users.filter(u => u.role === 'trainer')
  
  const workloads = trainers.map(trainer => 
    calculateTrainerWorkload(trainer, sessions, start, end)
  )

  const overutilizedTrainers = workloads.filter(w => w.utilizationRate >= OPTIMAL_UTILIZATION_MAX)
  const underutilizedTrainers = workloads.filter(w => w.utilizationRate < OPTIMAL_UTILIZATION_MIN)
  
  const totalCapacity = trainers.length * MAX_HOURS_PER_WEEK
  const totalUtilization = workloads.reduce((sum, w) => sum + w.totalHours, 0)
  
  const variance = workloads.reduce((sum, w) => {
    const avgUtilization = totalUtilization / trainers.length
    return sum + Math.pow(w.totalHours - avgUtilization, 2)
  }, 0) / trainers.length

  const balanceScore = Math.max(0, 100 - (Math.sqrt(variance) / MAX_HOURS_PER_WEEK) * 100)

  const recommendations = generateRecommendations(
    workloads,
    overutilizedTrainers,
    underutilizedTrainers,
    sessions,
    courses,
    balanceScore
  )

  return {
    workloads,
    overutilizedTrainers,
    underutilizedTrainers,
    recommendations,
    balanceScore,
    totalCapacity,
    totalUtilization
  }
}

/**
 * Builds a prioritised list of workload balancing recommendations from the
 * per-trainer workload data.
 *
 * @param workloads - Complete list of trainer workloads for the period.
 * @param overutilized - Trainers at or above the optimal maximum utilization threshold.
 * @param underutilized - Trainers below the optimal minimum utilization threshold.
 * @param sessions - All sessions in the period (used for redistribution analysis).
 * @param courses - Course catalogue used to verify trainer certification eligibility.
 * @param balanceScore - The overall balance score (0–100) for the period.
 * @returns Up to 8 {@link WorkloadRecommendation} objects sorted by priority.
 */
function generateRecommendations(
  workloads: TrainerWorkload[],
  overutilized: TrainerWorkload[],
  underutilized: TrainerWorkload[],
  sessions: Session[],
  courses: Course[],
  balanceScore: number
): WorkloadRecommendation[] {
  const recommendations: WorkloadRecommendation[] = []

  overutilized.forEach(overworked => {
    const criticallyOverloaded = overworked.utilizationRate >= CRITICAL_UTILIZATION
    
    const compatibleUnderutilized = underutilized.filter(under => {
      const overworkedShifts = overworked.trainer.trainerProfile?.shiftSchedules?.map(s => s.shiftCode) || []
      const underShifts = under.trainer.trainerProfile?.shiftSchedules?.map(s => s.shiftCode) || []
      const hasShiftOverlap = overworkedShifts.length > 0 && underShifts.length > 0 && 
        overworkedShifts.some(shift => underShifts.includes(shift))
      const hasCertOverlap = under.trainer.certifications.some(cert => 
        overworked.trainer.certifications.includes(cert)
      )
      return hasShiftOverlap && hasCertOverlap
    })

    if (compatibleUnderutilized.length > 0) {
      const redistributableHours = overworked.totalHours - (MAX_HOURS_PER_WEEK * (OPTIMAL_UTILIZATION_MAX / 100))
      
      recommendations.push({
        type: 'redistribute',
        priority: criticallyOverloaded ? 'high' : 'medium',
        title: `Redistribute ${overworked.trainer.name}'s workload`,
        description: `${overworked.trainer.name} is at ${overworked.utilizationRate.toFixed(0)}% utilization (${overworked.totalHours.toFixed(1)}h). Consider moving ${redistributableHours.toFixed(1)}h to ${compatibleUnderutilized[0].trainer.name} who is at ${compatibleUnderutilized[0].utilizationRate.toFixed(0)}%.`,
        affectedTrainers: [overworked.trainer.id, compatibleUnderutilized[0].trainer.id],
        potentialSavings: redistributableHours,
        actionable: true
      })
    } else if (criticallyOverloaded) {
      const shiftCodes = overworked.trainer.trainerProfile?.shiftSchedules?.map(s => s.shiftCode) || []
      const shiftInfo = shiftCodes.length > 0 ? ` for ${shiftCodes.join(', ')} shifts` : ''
      recommendations.push({
        type: 'hire',
        priority: 'high',
        title: `Consider hiring trainers with ${overworked.trainer.certifications.join(', ')} certifications`,
        description: `${overworked.trainer.name} is critically overloaded at ${overworked.utilizationRate.toFixed(0)}% with no available trainers to share the load. Consider hiring or certifying additional trainers${shiftInfo}.`,
        affectedTrainers: [overworked.trainer.id],
        actionable: false
      })
    }
  })

  const highlyUnderutilized = underutilized.filter(w => w.utilizationRate < 30)
  if (highlyUnderutilized.length >= 2) {
    const totalWastedHours = highlyUnderutilized.reduce((sum, w) => sum + w.availableHours, 0)
    
    recommendations.push({
      type: 'optimize',
      priority: 'medium',
      title: `Optimize trainer capacity utilization`,
      description: `${highlyUnderutilized.length} trainers are significantly underutilized with ${totalWastedHours.toFixed(0)}h of unused capacity. Consider scheduling more sessions or reassigning responsibilities.`,
      affectedTrainers: highlyUnderutilized.map(w => w.trainer.id),
      potentialSavings: totalWastedHours,
      actionable: true
    })
  }

  overutilized.forEach(overworked => {
    const duplicateCourses = Array.from(overworked.sessionsByCourse.entries())
      .filter(([_, count]) => count >= 3)
    
    if (duplicateCourses.length > 0) {
      const availableTrainers = workloads.filter(w => {
        const hasCapacity = w.availableHours >= 4
        const wShifts = w.trainer.trainerProfile?.shiftSchedules?.map(s => s.shiftCode) || []
        const overworkedShifts = overworked.trainer.trainerProfile?.shiftSchedules?.map(s => s.shiftCode) || []
        const hasShift = wShifts.length > 0 && overworkedShifts.length > 0 && 
          wShifts.some(shift => overworkedShifts.includes(shift))
        const canTeachCourse = duplicateCourses.some(([courseId, _]) => {
          const course = courses.find(c => c.id === courseId)
          return course?.certifications.every(cert => w.trainer.certifications.includes(cert))
        })
        return hasCapacity && hasShift && canTeachCourse && w.trainer.id !== overworked.trainer.id
      })

      if (availableTrainers.length > 0) {
        recommendations.push({
          type: 'redistribute',
          priority: 'medium',
          title: `Share ${overworked.trainer.name}'s recurring sessions`,
          description: `${overworked.trainer.name} is teaching ${duplicateCourses[0][1]} sessions of the same course. ${availableTrainers[0].trainer.name} can take over some sessions to balance the load.`,
          affectedTrainers: [overworked.trainer.id, availableTrainers[0].trainer.id],
          actionable: true
        })
      }
    }
  })

  if (balanceScore < 60) {
    const imbalancedShifts = new Map<string, { over: number; under: number }>()
    
    workloads.forEach(w => {
      const shiftCodes = w.trainer.trainerProfile?.shiftSchedules?.map(s => s.shiftCode) || []
      shiftCodes.forEach(shift => {
        if (!imbalancedShifts.has(shift)) {
          imbalancedShifts.set(shift, { over: 0, under: 0 })
        }
        const stats = imbalancedShifts.get(shift)!
        if (w.utilizationRate >= OPTIMAL_UTILIZATION_MAX) stats.over++
        if (w.utilizationRate < OPTIMAL_UTILIZATION_MIN) stats.under++
      })
    })

    imbalancedShifts.forEach((stats, shift) => {
      if (stats.over > 0 && stats.under > 0) {
        recommendations.push({
          type: 'optimize',
          priority: 'low',
          title: `Balance ${shift} shift workload distribution`,
          description: `The ${shift} shift has ${stats.over} overutilized and ${stats.under} underutilized trainers. Review session scheduling to distribute work more evenly.`,
          affectedTrainers: [],
          actionable: true
        })
      }
    })
  }

  const sortedByPriority = recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  return sortedByPriority.slice(0, 8)
}

/**
 * Identifies specific sessions from an overutilised trainer that can feasibly be
 * reassigned to an underutilised trainer, respecting certification requirements
 * and the receiving trainer's available hours.
 *
 * @param overutilizedTrainer - The trainer whose load needs to be reduced.
 * @param underutilizedTrainer - The candidate trainer to receive redistributed sessions.
 * @param sessions - All sessions to search for transferable candidates.
 * @param courses - Course catalogue used to validate certification requirements.
 * @returns An array of {@link Session} objects that can be moved to the underutilised trainer,
 *          limited to the hours needed to bring the overloaded trainer to the optimal maximum.
 */
export function findRedistributionOpportunities(
  overutilizedTrainer: TrainerWorkload,
  underutilizedTrainer: TrainerWorkload,
  sessions: Session[],
  courses: Course[]
): Session[] {
  const overloadedSessions = sessions.filter(s => s.trainerId === overutilizedTrainer.trainer.id)
  
  const underShifts = underutilizedTrainer.trainer.trainerProfile?.shiftSchedules?.map(s => s.shiftCode) || []
  
  const redistributable = overloadedSessions.filter(session => {
    const course = courses.find(c => c.id === session.courseId)
    if (!course) return false
    
    const hasCerts = course.certifications.every(cert => 
      underutilizedTrainer.trainer.certifications.includes(cert)
    )
    
    return hasCerts
  })

  const targetHours = overutilizedTrainer.totalHours - (MAX_HOURS_PER_WEEK * (OPTIMAL_UTILIZATION_MAX / 100))
  let accumulatedHours = 0
  const sessionsToMove: Session[] = []

  for (const session of redistributable) {
    if (accumulatedHours >= targetHours) break
    
    const duration = calculateSessionDuration(
      new Date(session.startTime),
      new Date(session.endTime)
    )
    
    if (underutilizedTrainer.availableHours >= duration) {
      sessionsToMove.push(session)
      accumulatedHours += duration
    }
  }

  return sessionsToMove
}
