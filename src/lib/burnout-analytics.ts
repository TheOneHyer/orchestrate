import { User, Session, Course, WellnessCheckIn } from './types'
import { differenceInDays, startOfDay, startOfWeek, endOfWeek, eachWeekOfInterval, subDays } from 'date-fns'
import { calculateSessionDuration } from './helpers'

export interface TrainerUtilization {
  trainerId: string
  utilizationRate: number
  hoursScheduled: number
  sessionCount: number
  consecutiveDays: number
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: RiskFactor[]
  recommendations: string[]
}

export interface RiskFactor {
  factor: string
  description: string
  impact: 'low' | 'medium' | 'high'
}

export interface UtilizationTrend {
  trainerId: string
  trend: 'increasing' | 'decreasing' | 'stable'
  changeRate: number
  dataPoints: DataPoint[]
}

export interface DataPoint {
  date: string
  utilization: number
  hours: number
  sessions: number
}

const STANDARD_WORK_HOURS_PER_WEEK = 40
const STANDARD_WORK_DAYS_PER_WEEK = 5
const OVERUTILIZATION_THRESHOLD = 85
const CRITICAL_THRESHOLD = 95
const MAX_CONSECUTIVE_DAYS_HEALTHY = 10

export function calculateTrainerUtilization(
  trainer: User,
  allSessions: Session[],
  courses: Course[],
  timeRange: 'week' | 'month' | 'quarter',
  wellnessCheckIns?: WellnessCheckIn[]
): TrainerUtilization {
  const now = new Date()
  const daysBack = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90
  const startDate = subDays(now, daysBack)

  const trainerSessions = allSessions.filter(session =>
    session.trainerId === trainer.id &&
    new Date(session.startTime) >= startDate &&
    new Date(session.startTime) <= now &&
    session.status !== 'cancelled'
  )

  const totalHours = trainerSessions.reduce((sum, session) => {
    const duration = calculateSessionDuration(
      new Date(session.startTime),
      new Date(session.endTime)
    )
    return sum + duration
  }, 0)

  const weeks = daysBack / 7
  const expectedHours = STANDARD_WORK_HOURS_PER_WEEK * weeks
  const utilizationRate = (totalHours / expectedHours) * 100

  const consecutiveDays = calculateConsecutiveDays(trainerSessions)

  const factors: RiskFactor[] = []
  let riskScore = 0

  if (utilizationRate > CRITICAL_THRESHOLD) {
    riskScore += 40
    factors.push({
      factor: 'Critical Overutilization',
      description: `Working at ${utilizationRate.toFixed(0)}% capacity - well above sustainable levels`,
      impact: 'high'
    })
  } else if (utilizationRate > OVERUTILIZATION_THRESHOLD) {
    riskScore += 25
    factors.push({
      factor: 'High Utilization',
      description: `Working at ${utilizationRate.toFixed(0)}% capacity - approaching burnout risk`,
      impact: 'medium'
    })
  }

  if (consecutiveDays > MAX_CONSECUTIVE_DAYS_HEALTHY) {
    riskScore += 30
    factors.push({
      factor: 'Extended Work Streak',
      description: `Working ${consecutiveDays} consecutive days without sufficient breaks`,
      impact: 'high'
    })
  } else if (consecutiveDays > 7) {
    riskScore += 15
    factors.push({
      factor: 'Long Work Streak',
      description: `Working ${consecutiveDays} consecutive days - rest needed soon`,
      impact: 'medium'
    })
  }

  const avgSessionsPerWeek = trainerSessions.length / weeks
  if (avgSessionsPerWeek > 15) {
    riskScore += 20
    factors.push({
      factor: 'High Session Frequency',
      description: `Averaging ${avgSessionsPerWeek.toFixed(1)} sessions per week - may cause fatigue`,
      impact: 'medium'
    })
  }

  const uniqueCourses = new Set(trainerSessions.map(s => s.courseId)).size
  if (uniqueCourses > 5) {
    riskScore += 10
    factors.push({
      factor: 'Course Variety Overload',
      description: `Teaching ${uniqueCourses} different courses - high context switching`,
      impact: 'low'
    })
  }

  if (wellnessCheckIns && wellnessCheckIns.length > 0) {
    const trainerCheckIns = wellnessCheckIns
      .filter(c => c.trainerId === trainer.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)

    if (trainerCheckIns.length > 0) {
      const avgMood = trainerCheckIns.reduce((sum, c) => sum + c.mood, 0) / trainerCheckIns.length
      const highStressCount = trainerCheckIns.filter(c => c.stress === 'high' || c.stress === 'critical').length
      const lowEnergyCount = trainerCheckIns.filter(c => c.energy === 'exhausted' || c.energy === 'tired').length
      const lowWorkloadSatisfaction = trainerCheckIns.filter(c => c.workloadSatisfaction <= 2).length

      if (avgMood < 2.5) {
        riskScore += 25
        factors.push({
          factor: 'Poor Wellbeing - Low Mood',
          description: `Average mood score of ${avgMood.toFixed(1)}/5 in recent check-ins`,
          impact: 'high'
        })
      } else if (avgMood < 3.5) {
        riskScore += 15
        factors.push({
          factor: 'Below Average Mood',
          description: `Average mood score of ${avgMood.toFixed(1)}/5 - monitor closely`,
          impact: 'medium'
        })
      }

      if (highStressCount >= 3) {
        riskScore += 30
        factors.push({
          factor: 'Chronic High Stress',
          description: `High/critical stress reported in ${highStressCount} of ${trainerCheckIns.length} recent check-ins`,
          impact: 'high'
        })
      } else if (highStressCount >= 2) {
        riskScore += 20
        factors.push({
          factor: 'Elevated Stress Levels',
          description: `High stress reported in ${highStressCount} recent check-ins`,
          impact: 'medium'
        })
      }

      if (lowEnergyCount >= 3) {
        riskScore += 20
        factors.push({
          factor: 'Persistent Fatigue',
          description: `Low energy reported in ${lowEnergyCount} of ${trainerCheckIns.length} recent check-ins`,
          impact: 'high'
        })
      } else if (lowEnergyCount >= 2) {
        riskScore += 12
        factors.push({
          factor: 'Energy Depletion',
          description: `Low energy reported in ${lowEnergyCount} recent check-ins`,
          impact: 'medium'
        })
      }

      if (lowWorkloadSatisfaction >= 2) {
        riskScore += 18
        factors.push({
          factor: 'Workload Dissatisfaction',
          description: `Poor workload satisfaction reported in ${lowWorkloadSatisfaction} recent check-ins`,
          impact: 'high'
        })
      }

      const concernsRaised = trainerCheckIns.filter(c => c.concerns && c.concerns.length > 0).length
      if (concernsRaised >= 3) {
        riskScore += 15
        factors.push({
          factor: 'Multiple Concerns Raised',
          description: `Concerns raised in ${concernsRaised} of ${trainerCheckIns.length} check-ins`,
          impact: 'medium'
        })
      }

      const followUpsPending = trainerCheckIns.filter(c => c.followUpRequired && !c.followUpCompleted).length
      if (followUpsPending > 0) {
        riskScore += 10
        factors.push({
          factor: 'Pending Follow-ups',
          description: `${followUpsPending} wellness follow-up${followUpsPending > 1 ? 's' : ''} pending`,
          impact: 'medium'
        })
      }
    }
  }

  const riskLevel = getRiskLevel(riskScore)
  const recommendations = generateRecommendations(factors, utilizationRate, consecutiveDays, trainer, wellnessCheckIns)

  return {
    trainerId: trainer.id,
    utilizationRate,
    hoursScheduled: totalHours,
    sessionCount: trainerSessions.length,
    consecutiveDays,
    riskScore,
    riskLevel,
    factors,
    recommendations
  }
}

function calculateConsecutiveDays(sessions: Session[]): number {
  if (sessions.length === 0) return 0

  const uniqueDates = [...new Set(
    sessions.map(session => startOfDay(new Date(session.startTime)).getTime())
  )]
    .sort((left, right) => left - right)
    .map(timestamp => new Date(timestamp))

  let maxStreak = 1
  let currentStreak = 1

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1])
    const currDate = new Date(uniqueDates[i])
    const daysDiff = differenceInDays(currDate, prevDate)

    if (daysDiff === 1) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 1
    }
  }

  return maxStreak
}

function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 70) return 'critical'
  if (score >= 45) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}

export function getBurnoutRiskLevel(utilizationRate: number): 'low' | 'medium' | 'high' | 'critical' {
  if (utilizationRate >= CRITICAL_THRESHOLD) return 'critical'
  if (utilizationRate >= OVERUTILIZATION_THRESHOLD) return 'high'
  if (utilizationRate >= 70) return 'medium'
  return 'low'
}

function generateRecommendations(
  factors: RiskFactor[],
  utilizationRate: number,
  consecutiveDays: number,
  trainer: User,
  wellnessCheckIns?: WellnessCheckIn[]
): string[] {
  const recommendations: string[] = []

  if (utilizationRate > CRITICAL_THRESHOLD) {
    recommendations.push('Immediate workload reduction required - redistribute at least 20% of sessions to other trainers')
    recommendations.push('Schedule mandatory time off within the next 7 days')
    recommendations.push('Conduct wellness check-in and assess trainer capacity')
  } else if (utilizationRate > OVERUTILIZATION_THRESHOLD) {
    recommendations.push('Reduce session load by 10-15% over the next two weeks')
    recommendations.push('Avoid assigning new courses until utilization drops below 80%')
    recommendations.push('Schedule a rest period within the next 14 days')
  }

  if (consecutiveDays > MAX_CONSECUTIVE_DAYS_HEALTHY) {
    recommendations.push('Provide at least 2 consecutive days off immediately')
    recommendations.push('Implement maximum 5-day work week policy for this trainer')
  } else if (consecutiveDays > 7) {
    recommendations.push('Schedule a rest day within the next 3 days')
  }

  if (factors.some(f => f.factor.includes('Session Frequency'))) {
    recommendations.push('Space out sessions more evenly across the week')
    recommendations.push('Consider longer session blocks instead of many short sessions')
  }

  if (factors.some(f => f.factor.includes('Course Variety'))) {
    recommendations.push('Focus trainer on 3-4 core courses to reduce context switching')
    recommendations.push('Provide additional prep time when introducing new course material')
  }

  if (wellnessCheckIns && wellnessCheckIns.length > 0) {
    const trainerCheckIns = wellnessCheckIns.filter(c => c.trainerId === trainer.id)

    if (trainerCheckIns.some(c => c.stress === 'critical' || c.stress === 'high')) {
      recommendations.push('Schedule immediate stress management intervention or counseling')
    }

    if (trainerCheckIns.some(c => c.energy === 'exhausted')) {
      recommendations.push('Consider flexible scheduling or reduced hours to address fatigue')
    }

    if (trainerCheckIns.some(c => c.followUpRequired && !c.followUpCompleted)) {
      recommendations.push('Complete pending wellness follow-ups as high priority')
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Current workload is within healthy ranges')
    recommendations.push('Continue monitoring utilization trends')
    recommendations.push('Maintain regular check-ins to ensure trainer wellbeing')
  }

  return recommendations
}

export function getUtilizationTrend(
  trainer: User,
  allSessions: Session[],
  timeRange: 'week' | 'month' | 'quarter'
): UtilizationTrend {
  const now = new Date()
  const daysBack = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90
  const startDate = subDays(now, daysBack)

  const weeks = eachWeekOfInterval({ start: startDate, end: now })

  const dataPoints: DataPoint[] = weeks.map(weekStart => {
    const weekEnd = endOfWeek(weekStart)

    const weekSessions = allSessions.filter(session => {
      const sessionDate = new Date(session.startTime)
      return (
        session.trainerId === trainer.id &&
        sessionDate >= weekStart &&
        sessionDate <= weekEnd &&
        session.status !== 'cancelled'
      )
    })

    const hours = weekSessions.reduce((sum, session) => {
      const duration = calculateSessionDuration(
        new Date(session.startTime),
        new Date(session.endTime)
      )
      return sum + duration
    }, 0)

    const utilization = (hours / STANDARD_WORK_HOURS_PER_WEEK) * 100

    return {
      date: weekStart.toISOString(),
      utilization,
      hours,
      sessions: weekSessions.length
    }
  })

  const trend = calculateTrend(dataPoints)
  const changeRate = calculateChangeRate(dataPoints)

  return {
    trainerId: trainer.id,
    trend,
    changeRate,
    dataPoints
  }
}

function calculateTrend(dataPoints: DataPoint[]): 'increasing' | 'decreasing' | 'stable' {
  if (dataPoints.length < 2) return 'stable'

  const recentPoints = dataPoints.slice(-4)
  let increases = 0
  let decreases = 0

  for (let i = 1; i < recentPoints.length; i++) {
    const diff = recentPoints[i].utilization - recentPoints[i - 1].utilization
    if (diff > 5) increases++
    else if (diff < -5) decreases++
  }

  if (increases > decreases && increases >= 2) return 'increasing'
  if (decreases > increases && decreases >= 2) return 'decreasing'
  return 'stable'
}

function calculateChangeRate(dataPoints: DataPoint[]): number {
  if (dataPoints.length < 2) return 0

  const recentPoints = dataPoints.slice(-4)
  const firstAvg = (recentPoints[0].utilization + (recentPoints[1]?.utilization || recentPoints[0].utilization)) / 2
  const lastAvg = (recentPoints[recentPoints.length - 2]?.utilization + recentPoints[recentPoints.length - 1].utilization) / 2

  return lastAvg - firstAvg
}

export interface BurnoutRiskAssessment {
  trainerId: string
  riskScore: number
  risk: 'low' | 'moderate' | 'high' | 'critical'
  factors: string[]
  recommendations: string[]
}

export function calculateBurnoutRisk(
  trainerId: string,
  allSessions: Session[],
  wellnessCheckIns: WellnessCheckIn[],
  allUsers: User[],
  allCourses: Course[]
): BurnoutRiskAssessment {
  const trainer = allUsers.find(u => u.id === trainerId)
  if (!trainer) {
    return {
      trainerId,
      riskScore: 0,
      risk: 'low',
      factors: [],
      recommendations: []
    }
  }

  const utilization = calculateTrainerUtilization(trainer, allSessions, allCourses, 'month')
  const recentCheckIns = wellnessCheckIns
    .filter(c => c.trainerId === trainerId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5)

  let riskScore = utilization.riskScore
  const factors: string[] = []
  const recommendations: string[] = []

  if (recentCheckIns.length > 0) {
    const avgMood = recentCheckIns.reduce((sum, c) => sum + c.mood, 0) / recentCheckIns.length
    const highStressCount = recentCheckIns.filter(c => c.stress === 'high' || c.stress === 'critical').length

    if (avgMood < 2.5) {
      riskScore += 20
      factors.push('Low mood reported in recent check-ins')
    }

    if (highStressCount >= 3) {
      riskScore += 25
      factors.push('Consistent high stress levels')
      recommendations.push('Schedule immediate wellness intervention')
    }

    const concernsRaised = recentCheckIns.filter(c => c.concerns && c.concerns.length > 0).length
    if (concernsRaised >= 3) {
      riskScore += 15
      factors.push('Multiple concerns raised')
    }
  }

  factors.push(...utilization.factors.map(f => f.description))
  recommendations.push(...utilization.recommendations)

  let risk: 'low' | 'moderate' | 'high' | 'critical' = 'low'
  if (riskScore >= 80) risk = 'critical'
  else if (riskScore >= 60) risk = 'high'
  else if (riskScore >= 40) risk = 'moderate'

  return {
    trainerId,
    riskScore: Math.min(100, riskScore),
    risk,
    factors,
    recommendations
  }
}
