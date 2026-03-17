import { User, Session, Course, WellnessCheckIn } from './types'
import { calculateTrainerUtilization, TrainerUtilization } from './burnout-analytics'
import { subDays, format } from 'date-fns'

export interface RiskHistorySnapshot {
  id: string
  trainerId: string
  timestamp: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  utilizationRate: number
  hoursScheduled: number
  sessionCount: number
  consecutiveDays: number
  factorCount: number
}

export interface RiskTrendAnalysis {
  trainerId: string
  trainerName: string
  currentRisk: RiskHistorySnapshot
  historicalData: RiskHistorySnapshot[]
  trendDirection: 'improving' | 'worsening' | 'stable'
  changeRate: number
  daysInHighRisk: number
  daysInCriticalRisk: number
  peakRiskScore: number
  peakRiskDate: string
  lowestRiskScore: number
  lowestRiskDate: string
}

export function calculateRiskLevel(score: number): RiskHistorySnapshot['riskLevel'] {
  if (score >= 70) return 'critical'
  if (score >= 45) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}

// Basic inline boundary checks to guard the calculateRiskLevel thresholds.
// These act as lightweight tests to prevent regressions if the scoring model changes.
function assertRiskLevelBoundary(score: number, expected: RiskHistorySnapshot['riskLevel']): void {
  const actual = calculateRiskLevel(score)
  if (actual !== expected) {
    throw new Error(
      `calculateRiskLevel(${score}) expected "${expected}" but received "${actual}". ` +
        'This indicates a regression in the risk score thresholds.'
    )
  }
}

// Edge cases around threshold boundaries: 24/25, 44/45, 69/70.
assertRiskLevelBoundary(24, 'low')
assertRiskLevelBoundary(25, 'medium')
assertRiskLevelBoundary(44, 'medium')
assertRiskLevelBoundary(45, 'high')
assertRiskLevelBoundary(69, 'high')
assertRiskLevelBoundary(70, 'critical')

export function createRiskSnapshot(
  trainer: User,
  sessions: Session[],
  courses: Course[],
  wellnessCheckIns: WellnessCheckIn[]
): RiskHistorySnapshot {
  const utilization = calculateTrainerUtilization(trainer, sessions, courses, 'month', wellnessCheckIns)

  return {
    id: `snapshot-${trainer.id}-${Date.now()}`,
    trainerId: trainer.id,
    timestamp: new Date().toISOString(),
    riskScore: utilization.riskScore,
    riskLevel: utilization.riskLevel,
    utilizationRate: utilization.utilizationRate,
    hoursScheduled: utilization.hoursScheduled,
    sessionCount: utilization.sessionCount,
    consecutiveDays: utilization.consecutiveDays,
    factorCount: utilization.factors.length
  }
}

export function analyzeRiskTrend(
  trainer: User,
  historicalSnapshots: RiskHistorySnapshot[],
  timeRange: 'week' | 'month' | 'quarter' = 'month'
): RiskTrendAnalysis | null {
  const daysBack = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90
  const cutoffDate = subDays(new Date(), daysBack)

  const relevantSnapshots = historicalSnapshots
    .filter(s => s.trainerId === trainer.id && new Date(s.timestamp) >= cutoffDate)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  if (relevantSnapshots.length === 0) return null

  const currentRisk = relevantSnapshots[relevantSnapshots.length - 1]

  let trendDirection: 'improving' | 'worsening' | 'stable' = 'stable'
  let changeRate = 0

  if (relevantSnapshots.length >= 3) {
    const recent = relevantSnapshots.slice(-3)
    const older = relevantSnapshots.slice(0, Math.min(3, relevantSnapshots.length - 3))

    if (older.length > 0) {
      const recentAvg = recent.reduce((sum, s) => sum + s.riskScore, 0) / recent.length
      const olderAvg = older.reduce((sum, s) => sum + s.riskScore, 0) / older.length

      changeRate = recentAvg - olderAvg

      if (changeRate > 10) {
        trendDirection = 'worsening'
      } else if (changeRate < -10) {
        trendDirection = 'improving'
      }
    }
  }

  const daysInHighRisk = new Set(
    relevantSnapshots
      .filter(s => s.riskLevel === 'high')
      .map(s => new Date(s.timestamp).toISOString().slice(0, 10))
  ).size
  const daysInCriticalRisk = new Set(
    relevantSnapshots
      .filter(s => s.riskLevel === 'critical')
      .map(s => new Date(s.timestamp).toISOString().slice(0, 10))
  ).size

  const sortedByScore = [...relevantSnapshots].sort((a, b) => a.riskScore - b.riskScore)
  const lowestRisk = sortedByScore[0]
  const peakRisk = sortedByScore[sortedByScore.length - 1]

  return {
    trainerId: trainer.id,
    trainerName: trainer.name,
    currentRisk,
    historicalData: relevantSnapshots,
    trendDirection,
    changeRate,
    daysInHighRisk,
    daysInCriticalRisk,
    peakRiskScore: peakRisk.riskScore,
    peakRiskDate: peakRisk.timestamp,
    lowestRiskScore: lowestRisk.riskScore,
    lowestRiskDate: lowestRisk.timestamp
  }
}

export function generateRiskReport(
  trainers: User[],
  historicalSnapshots: RiskHistorySnapshot[],
  timeRange: 'week' | 'month' | 'quarter' = 'month'
): {
  totalTrainers: number
  trainersInCriticalRisk: number
  trainersInHighRisk: number
  trainersWithImprovingTrends: number
  trainersWithWorseningTrends: number
  averageRiskScore: number
  trends: RiskTrendAnalysis[]
} {
  const trends = trainers
    .map(trainer => analyzeRiskTrend(trainer, historicalSnapshots, timeRange))
    .filter((t): t is RiskTrendAnalysis => t !== null)

  const trainersInCriticalRisk = trends.filter(t => t.currentRisk.riskLevel === 'critical').length
  const trainersInHighRisk = trends.filter(t => t.currentRisk.riskLevel === 'high').length
  const trainersWithImprovingTrends = trends.filter(t => t.trendDirection === 'improving').length
  const trainersWithWorseningTrends = trends.filter(t => t.trendDirection === 'worsening').length

  const averageRiskScore = trends.length > 0
    ? trends.reduce((sum, t) => sum + t.currentRisk.riskScore, 0) / trends.length
    : 0

  return {
    totalTrainers: trainers.length,
    trainersInCriticalRisk,
    trainersInHighRisk,
    trainersWithImprovingTrends,
    trainersWithWorseningTrends,
    averageRiskScore,
    trends
  }
}

export function shouldTakeSnapshot(
  trainerId: string,
  lastSnapshot: RiskHistorySnapshot | undefined,
  frequencyHours: number = 24
): boolean {
  if (!lastSnapshot) return true

  const hoursSinceLastSnapshot =
    (Date.now() - new Date(lastSnapshot.timestamp).getTime()) / (1000 * 60 * 60)

  return hoursSinceLastSnapshot >= frequencyHours
}

export function aggregateSnapshotsByDay(
  snapshots: RiskHistorySnapshot[]
): RiskHistorySnapshot[] {
  const snapshotsByDay = new Map<string, RiskHistorySnapshot[]>()

  snapshots.forEach(snapshot => {
    const day = format(new Date(snapshot.timestamp), 'yyyy-MM-dd')
    if (!snapshotsByDay.has(day)) {
      snapshotsByDay.set(day, [])
    }
    snapshotsByDay.get(day)!.push(snapshot)
  })

  const aggregated: RiskHistorySnapshot[] = []

  snapshotsByDay.forEach((daySnapshots, day) => {
    const latest = daySnapshots.reduce((latest, current) =>
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    )
    aggregated.push(latest)
  })

  return aggregated.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}
