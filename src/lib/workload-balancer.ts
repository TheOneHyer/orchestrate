import { User, Session, Course } from './types'
import { isWithinInterval, startOfDay, endOfDay, addDays, startOfWeek } from 'date-fns'
import { calculateSessionDuration } from './helpers'

export interface TrainerWorkload {
  trainer: User
  totalHours: number
  sessionCount: number
  utilizationRate: number
  availableHours: number
  sessionsByCourse: Map<string, number>
  sessionsPerShift: Map<string, number>
}

export interface WorkloadRecommendation {
  type: 'redistribute' | 'hire' | 'reduce' | 'optimize'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  affectedTrainers: string[]
  potentialSavings?: number
  actionable: boolean
}

export interface WorkloadAnalysis {
  workloads: TrainerWorkload[]
  overutilizedTrainers: TrainerWorkload[]
  underutilizedTrainers: TrainerWorkload[]
  recommendations: WorkloadRecommendation[]
  balanceScore: number
  totalCapacity: number
  totalUtilization: number
}

const MAX_HOURS_PER_WEEK = 40
const OPTIMAL_UTILIZATION_MIN = 60
const OPTIMAL_UTILIZATION_MAX = 85
const CRITICAL_UTILIZATION = 95

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
    sessionsPerShift.set(session.shift, (sessionsPerShift.get(session.shift) || 0) + 1)
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
      const hasShiftOverlap = under.trainer.shifts.some(shift => 
        overworked.trainer.shifts.includes(shift)
      )
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
      recommendations.push({
        type: 'hire',
        priority: 'high',
        title: `Consider hiring trainers with ${overworked.trainer.certifications.join(', ')} certifications`,
        description: `${overworked.trainer.name} is critically overloaded at ${overworked.utilizationRate.toFixed(0)}% with no available trainers to share the load. Consider hiring or certifying additional trainers for ${overworked.trainer.shifts.join(', ')} shifts.`,
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
        const hasShift = w.trainer.shifts.some(shift => overworked.trainer.shifts.includes(shift))
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
      w.trainer.shifts.forEach(shift => {
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

export function findRedistributionOpportunities(
  overutilizedTrainer: TrainerWorkload,
  underutilizedTrainer: TrainerWorkload,
  sessions: Session[],
  courses: Course[]
): Session[] {
  const overloadedSessions = sessions.filter(s => s.trainerId === overutilizedTrainer.trainer.id)
  
  const redistributable = overloadedSessions.filter(session => {
    const course = courses.find(c => c.id === session.courseId)
    if (!course) return false
    
    const hasShift = underutilizedTrainer.trainer.shifts.includes(session.shift)
    const hasCerts = course.certifications.every(cert => 
      underutilizedTrainer.trainer.certifications.includes(cert)
    )
    
    return hasShift && hasCerts
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
