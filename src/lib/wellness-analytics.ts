import { WellnessCheckIn, StressLevel, EnergyLevel, RecoveryPlan, WellnessTrend } from './types'
import { subDays, format } from 'date-fns'

/**
 * Calculates a composite wellness score (0–100) for a single check-in by
 * weighting mood, stress, energy, workload satisfaction, sleep quality,
 * physical wellbeing, and mental clarity.
 *
 * @param checkIn - The wellness check-in record to score.
 * @returns A rounded integer wellness score between 0 and 100.
 */
export function calculateWellnessScore(checkIn: WellnessCheckIn): number {
  const moodScore = checkIn.mood * 20
  const stressScore = getStressScore(checkIn.stress)
  const energyScore = getEnergyScore(checkIn.energy)
  const workloadScore = checkIn.workloadSatisfaction * 20
  const sleepScore = checkIn.sleepQuality * 20
  const physicalScore = checkIn.physicalWellbeing * 20
  const mentalScore = checkIn.mentalClarity * 20

  return Math.round(
    (moodScore * 0.15) +
    (stressScore * 0.2) +
    (energyScore * 0.15) +
    (workloadScore * 0.2) +
    (sleepScore * 0.1) +
    (physicalScore * 0.1) +
    (mentalScore * 0.1)
  )
}

/**
 * Converts a {@link StressLevel} value to a numeric score (0–100)
 * where higher values indicate lower stress.
 *
 * @param stress - The stress level to convert.
 * @returns 100 for `'low'`, 70 for `'moderate'`, 40 for `'high'`, 10 for `'critical'`.
 */
function getStressScore(stress: StressLevel): number {
  switch (stress) {
    case 'low': return 100
    case 'moderate': return 70
    case 'high': return 40
    case 'critical': return 10
  }
}

/**
 * Converts an {@link EnergyLevel} value to a numeric score (0–100)
 * where higher values indicate better energy.
 *
 * @param energy - The energy level to convert.
 * @returns 100 for `'excellent'`, 80 for `'energized'`, 60 for `'neutral'`, 40 for `'tired'`, 20 for `'exhausted'`.
 */
function getEnergyScore(energy: EnergyLevel): number {
  switch (energy) {
    case 'excellent': return 100
    case 'energized': return 80
    case 'neutral': return 60
    case 'tired': return 40
    case 'exhausted': return 20
  }
}

/**
 * Aggregates wellness check-in data for a trainer over a given period into a
 * {@link WellnessTrend} summary, including average mood, stress, energy levels,
 * and outstanding follow-up counts.
 *
 * @param checkIns - All wellness check-in records to filter from.
 * @param trainerId - The identifier of the trainer whose trend to compute.
 * @param timeRange - The look-back window: `'week'` (7 days), `'month'` (30 days), or `'quarter'` (90 days).
 * @returns A {@link WellnessTrend} object. When no check-ins exist in the period, all numeric fields are 0.
 */
export function analyzeWellnessTrend(
  checkIns: WellnessCheckIn[],
  trainerId: string,
  timeRange: 'week' | 'month' | 'quarter'
): WellnessTrend {
  const now = new Date()
  const daysBack = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90
  const startDate = subDays(now, daysBack)

  const relevantCheckIns = checkIns.filter(
    c => c.trainerId === trainerId &&
      new Date(c.timestamp) >= startDate &&
      new Date(c.timestamp) <= now
  )

  if (relevantCheckIns.length === 0) {
    return {
      trainerId,
      period: format(now, 'yyyy-MM'),
      averageMood: 0,
      averageStress: 0,
      averageEnergy: 0,
      checkInCount: 0,
      concernsRaised: 0,
      followUpsRequired: 0,
      recoveryPlansActive: 0
    }
  }

  const averageMood = relevantCheckIns.reduce((sum, c) => sum + c.mood, 0) / relevantCheckIns.length
  const stressLevels = relevantCheckIns.map(c => getStressScore(c.stress))
  const averageStress = stressLevels.reduce((sum, s) => sum + s, 0) / stressLevels.length
  const energyLevels = relevantCheckIns.map(c => getEnergyScore(c.energy))
  const averageEnergy = energyLevels.reduce((sum, e) => sum + e, 0) / energyLevels.length
  const concernsRaised = relevantCheckIns.filter(c => c.concerns && c.concerns.length > 0).length
  const followUpsRequired = relevantCheckIns.filter(c => c.followUpRequired && !c.followUpCompleted).length

  return {
    trainerId,
    period: format(now, 'yyyy-MM'),
    averageMood,
    averageStress,
    averageEnergy,
    checkInCount: relevantCheckIns.length,
    concernsRaised,
    followUpsRequired,
    recoveryPlansActive: 0
  }
}

/**
 * Maps a numeric wellness score to a human-readable status category.
 *
 * @param score - The wellness score to evaluate (typically 0–100).
 * @returns `'excellent'` (≥85), `'good'` (≥70), `'fair'` (≥55), `'poor'` (≥40), or `'critical'`.
 */
export function getWellnessStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 55) return 'fair'
  if (score >= 40) return 'poor'
  return 'critical'
}

/**
 * Determines whether a recovery plan should be initiated for a trainer based on
 * their most recent wellness check-ins and current utilization rate.
 *
 * @param checkIns - All wellness check-in records to filter from.
 * @param trainerId - The identifier of the trainer to evaluate.
 * @param utilizationRate - The trainer's current utilization percentage.
 * @returns An object with `shouldTrigger` indicating whether a plan is warranted
 *          and `reasons` listing the conditions that led to the decision.
 */
export function shouldTriggerRecoveryPlan(
  checkIns: WellnessCheckIn[],
  trainerId: string,
  utilizationRate: number
): { shouldTrigger: boolean; reasons: string[] } {
  const recentCheckIns = checkIns
    .filter(c => c.trainerId === trainerId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 3)

  if (recentCheckIns.length === 0) {
    return { shouldTrigger: false, reasons: [] }
  }

  const reasons: string[] = []
  let shouldTrigger = false

  const latestCheckIn = recentCheckIns[0]
  const wellnessScore = calculateWellnessScore(latestCheckIn)

  if (wellnessScore < 50) {
    shouldTrigger = true
    reasons.push(`Low wellness score: ${wellnessScore}/100`)
  }

  if (latestCheckIn.stress === 'critical' || latestCheckIn.stress === 'high') {
    shouldTrigger = true
    reasons.push(`${latestCheckIn.stress === 'critical' ? 'Critical' : 'High'} stress level reported`)
  }

  if (latestCheckIn.energy === 'exhausted' || latestCheckIn.energy === 'tired') {
    shouldTrigger = true
    reasons.push(`Low energy level: ${latestCheckIn.energy}`)
  }

  if (latestCheckIn.workloadSatisfaction <= 2) {
    shouldTrigger = true
    reasons.push('Poor workload satisfaction')
  }

  if (recentCheckIns.length >= 2) {
    const scores = recentCheckIns.map(calculateWellnessScore)
    // recentCheckIns is newest-first, so each older score should be higher than
    // the immediately newer one for a strictly declining trend.
    const isStrictlyDeclining = scores.slice(1).every((olderScore, idx) => olderScore > scores[idx])

    if (isStrictlyDeclining && scores[0] < scores[scores.length - 1] - 15) {
      shouldTrigger = true
      reasons.push('Declining wellness trend detected')
    }
  }

  if (utilizationRate >= 85 && wellnessScore < 60) {
    shouldTrigger = true
    reasons.push('High utilization combined with reduced wellness')
  }

  if (latestCheckIn.followUpRequired && !latestCheckIn.followUpCompleted) {
    shouldTrigger = true
    reasons.push('Follow-up required from previous check-in')
  }

  return { shouldTrigger, reasons }
}

/**
 * Estimates the overall completion progress of a recovery plan as a percentage (0–100)
 * by combining the proportion of completed actions with utilization improvement progress.
 *
 * @param plan - The recovery plan to evaluate.
 * @returns A rounded integer representing the plan's progress percentage.
 */
export function calculateRecoveryProgress(plan: RecoveryPlan): number {
  if (plan.actions.length === 0) return 0

  const completedActions = plan.actions.filter(a => a.completed).length
  const actionProgress = (completedActions / plan.actions.length) * 70

  // Treat being at or below target utilization as full utilization-progress credit.
  const utilizationImprovement = plan.currentUtilization <= plan.targetUtilization
    ? 30
    : Math.max(0, Math.min(30, (plan.targetUtilization / plan.currentUtilization) * 30))

  return Math.round(actionProgress + utilizationImprovement)
}

/**
 * Generates a prioritised list of recovery recommendations for a trainer based
 * on utilization rate, wellness score, stress level, and energy level.
 *
 * @param utilizationRate - The trainer's current utilization as a percentage.
 * @param wellnessScore - The trainer's most recent composite wellness score (0–100).
 * @param stress - The trainer's current reported stress level.
 * @param energy - The trainer's current reported energy level.
 * @returns An ordered array of recommendation strings, from most to least urgent.
 */
export function getRecoveryPlanRecommendations(
  utilizationRate: number,
  wellnessScore: number,
  stress: StressLevel,
  energy: EnergyLevel
): string[] {
  const recommendations: string[] = []

  if (utilizationRate >= 95) {
    recommendations.push('URGENT: Reduce workload to below 85% immediately')
    recommendations.push('Redistribute at least 15-20% of scheduled sessions')
    recommendations.push('Provide 3-5 consecutive days off')
  } else if (utilizationRate >= 85) {
    recommendations.push('Reduce workload by 10-15% over next 2 weeks')
    recommendations.push('Limit new course assignments')
    recommendations.push('Schedule 2 consecutive days off within next week')
  }

  if (stress === 'critical') {
    recommendations.push('Immediate mental health support consultation')
    recommendations.push('Consider temporary leave or reduced schedule')
    recommendations.push('Provide stress management resources')
  } else if (stress === 'high') {
    recommendations.push('Schedule wellness consultation with HR')
    recommendations.push('Offer stress management workshop')
  }

  if (energy === 'exhausted' || energy === 'tired') {
    recommendations.push('Review sleep patterns and work-life balance')
    recommendations.push('Reduce evening/night shift sessions if possible')
    recommendations.push('Encourage use of paid time off')
  }

  if (wellnessScore < 50) {
    recommendations.push('Implement comprehensive recovery plan')
    recommendations.push('Weekly wellness check-ins required')
    recommendations.push('Consider professional wellness coaching')
  } else if (wellnessScore < 70) {
    recommendations.push('Bi-weekly wellness check-ins')
    recommendations.push('Monitor workload closely')
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue current wellness monitoring')
    recommendations.push('Maintain regular check-in schedule')
  }

  return recommendations
}

/**
 * Generates a week-by-week set of utilization targets for a recovery plan by
 * linearly interpolating from the current to the target utilization over the
 * specified number of weeks.
 *
 * @param currentUtilization - The trainer's current utilization percentage.
 * @param targetUtilization - The desired end-of-plan utilization percentage.
 * @param durationWeeks - Total number of weeks in the recovery plan.
 * @returns An array of milestone objects, one per week, each containing the week
 *          number, target utilization, and a descriptive label.
 */
export function generateRecoveryMilestones(
  currentUtilization: number,
  targetUtilization: number,
  durationWeeks: number
): { week: number; targetUtilization: number; description: string }[] {
  const milestones: { week: number; targetUtilization: number; description: string }[] = []
  const utilizationDrop = currentUtilization - targetUtilization
  const dropPerWeek = utilizationDrop / durationWeeks

  for (let week = 1; week <= durationWeeks; week++) {
    const weekTarget = currentUtilization - (dropPerWeek * week)
    let description = ''

    if (week === 1) {
      description = 'Initial workload reduction and recovery plan kickoff'
    } else if (week === Math.ceil(durationWeeks / 2)) {
      description = 'Mid-point review and adjustment'
    } else if (week === durationWeeks) {
      description = 'Target utilization achieved - plan completion review'
    } else {
      description = 'Continue workload reduction and wellness monitoring'
    }

    milestones.push({
      week,
      targetUtilization: Math.round(weekTarget * 10) / 10,
      description
    })
  }

  return milestones
}

/**
 * Analyses all available wellness check-ins for a trainer and returns a list of
 * actionable insights with severity ratings based on mood, stress, energy, and
 * recurring concerns.
 *
 * @param checkIns - All wellness check-in records to filter from.
 * @param trainerId - The identifier of the trainer to evaluate.
 * @returns An array of insight objects each containing a descriptive message and
 *          a severity of `'info'`, `'warning'`, or `'critical'`.
 */
export function getWellnessInsights(
  checkIns: WellnessCheckIn[],
  trainerId: string
): { insight: string; severity: 'info' | 'warning' | 'critical' }[] {
  const insights: { insight: string; severity: 'info' | 'warning' | 'critical' }[] = []

  const trainerCheckIns = checkIns
    .filter(c => c.trainerId === trainerId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  if (trainerCheckIns.length === 0) {
    insights.push({
      insight: 'No wellness check-ins recorded - schedule initial check-in',
      severity: 'warning'
    })
    return insights
  }

  const recent = trainerCheckIns.slice(0, 5)
  const avgMood = recent.reduce((sum, c) => sum + c.mood, 0) / recent.length

  if (avgMood < 2.5) {
    insights.push({
      insight: 'Consistently low mood scores - immediate intervention recommended',
      severity: 'critical'
    })
  } else if (avgMood < 3.5) {
    insights.push({
      insight: 'Below-average mood scores - monitor closely',
      severity: 'warning'
    })
  }

  const highStressCount = recent.filter(c => c.stress === 'high' || c.stress === 'critical').length
  if (highStressCount >= 3) {
    insights.push({
      insight: `High stress reported in ${highStressCount} of last ${recent.length} check-ins`,
      severity: 'critical'
    })
  }

  const lowEnergyCount = recent.filter(c => c.energy === 'exhausted' || c.energy === 'tired').length
  if (lowEnergyCount >= 3) {
    insights.push({
      insight: `Low energy levels persistent across ${lowEnergyCount} recent check-ins`,
      severity: 'warning'
    })
  }

  const commonConcerns = new Map<string, number>()
  trainerCheckIns.slice(0, 10).forEach(c => {
    c.concerns?.forEach(concern => {
      commonConcerns.set(concern, (commonConcerns.get(concern) || 0) + 1)
    })
  })

  Array.from(commonConcerns.entries())
    .filter(([_, count]) => count >= 2)
    .forEach(([concern, count]) => {
      insights.push({
        insight: `Recurring concern: "${concern}" (${count} times)`,
        severity: count >= 3 ? 'warning' : 'info'
      })
    })

  const daysSinceLastCheckIn = Math.floor(
    (Date.now() - new Date(trainerCheckIns[0].timestamp).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysSinceLastCheckIn > 14) {
    insights.push({
      insight: `Last check-in was ${daysSinceLastCheckIn} days ago - schedule new check-in`,
      severity: 'warning'
    })
  }

  if (insights.length === 0) {
    insights.push({
      insight: 'Wellness indicators within normal range',
      severity: 'info'
    })
  }

  return insights
}
