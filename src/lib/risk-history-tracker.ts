import { User, Session, Course, WellnessCheckIn } from './types'
import { calculateTrainerUtilization, TrainerUtilization } from './burnout-analytics'
import { subDays, format } from 'date-fns'

/**
 * A point-in-time snapshot of a trainer's burnout risk metrics, persisted for
 * historical trend analysis.
 */
export interface RiskHistorySnapshot {
  /** Unique identifier for the snapshot, combining trainer ID and creation timestamp. */
  id: string
  /** The identifier of the trainer this snapshot belongs to. */
  trainerId: string
  /** ISO 8601 string recording when this snapshot was created. */
  timestamp: string
  /** Composite risk score at the time of capture. */
  riskScore: number
  /** Categorical risk level at the time of capture. */
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  /** Utilization rate (percentage) at the time of capture. */
  utilizationRate: number
  /** Total hours scheduled in the look-back period at the time of capture. */
  hoursScheduled: number
  /** Number of sessions in the look-back period at the time of capture. */
  sessionCount: number
  /** Longest consecutive working-day streak at the time of capture. */
  consecutiveDays: number
  /** Number of individual risk factors identified at the time of capture. */
  factorCount: number
}

/**
 * Comprehensive risk trend analysis for a trainer over a defined historical period,
 * including directional trend, extremes, and time spent at elevated risk levels.
 */
export interface RiskTrendAnalysis {
  /** The unique identifier of the trainer. */
  trainerId: string
  /** The display name of the trainer. */
  trainerName: string
  /** The most recent risk snapshot within the analysed period. */
  currentRisk: RiskHistorySnapshot
  /** All snapshots for the trainer within the analysed period, sorted chronologically. */
  historicalData: RiskHistorySnapshot[]
  /** Overall direction of risk over the analysed period. */
  trendDirection: 'improving' | 'worsening' | 'stable'
  /** Average risk-score change between the earliest and most recent data windows. */
  changeRate: number
  /** Number of distinct calendar days where the trainer was at `'high'` risk. */
  daysInHighRisk: number
  /** Number of distinct calendar days where the trainer was at `'critical'` risk. */
  daysInCriticalRisk: number
  /** The highest risk score recorded within the period. */
  peakRiskScore: number
  /** ISO 8601 timestamp of when the peak risk score was recorded. */
  peakRiskDate: string
  /** The lowest risk score recorded within the period. */
  lowestRiskScore: number
  /** ISO 8601 timestamp of when the lowest risk score was recorded. */
  lowestRiskDate: string
}

/**
 * Maps a numeric risk score to a categorical risk level.
 *
 * @param score - The composite risk score to evaluate.
 * @returns `'critical'` (≥70), `'high'` (≥45), `'medium'` (≥25), or `'low'`.
 */
export function calculateRiskLevel(score: number): RiskHistorySnapshot['riskLevel'] {
  if (score >= 70) return 'critical'
  if (score >= 45) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}

// Basic inline boundary checks to guard the calculateRiskLevel thresholds.
// These act as lightweight tests to prevent regressions if the scoring model changes.
/**
 * Asserts that {@link calculateRiskLevel} returns the expected risk level for the given score.
 * Throws an error if the actual result differs, acting as an inline boundary test to guard
 * against regressions in the scoring thresholds.
 *
 * @param score - The score to pass to {@link calculateRiskLevel}.
 * @param expected - The expected risk level for the given score.
 * @throws {Error} When the actual risk level does not match the expected level.
 */
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
if (import.meta.env.DEV) {
  assertRiskLevelBoundary(24, 'low')
  assertRiskLevelBoundary(25, 'medium')
  assertRiskLevelBoundary(44, 'medium')
  assertRiskLevelBoundary(45, 'high')
  assertRiskLevelBoundary(69, 'high')
  assertRiskLevelBoundary(70, 'critical')
}

/**
 * Creates a point-in-time {@link RiskHistorySnapshot} for a trainer by computing
 * their current utilization and risk metrics using the last 30 days of data.
 *
 * @param trainer - The trainer for whom the snapshot is created.
 * @param sessions - All sessions used to compute utilization metrics.
 * @param courses - Course catalogue passed to the utilization calculator.
 * @param wellnessCheckIns - Wellness check-in records used in the risk calculation.
 * @returns A new {@link RiskHistorySnapshot} stamped with the current UTC timestamp.
 */
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

/**
 * Analyses historical risk snapshots for a trainer over the specified period to
 * determine the trend direction, rate of change, time at elevated risk, and
 * historical extremes.
 *
 * @param trainer - The trainer whose risk trend is being analysed.
 * @param historicalSnapshots - All persisted snapshots to filter from.
 * @param timeRange - The look-back window: `'week'` (7 days), `'month'` (30 days), or `'quarter'` (90 days). Defaults to `'month'`.
 * @returns A {@link RiskTrendAnalysis} object, or `null` when no snapshots exist in the period.
 */
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

/**
 * Generates an aggregate risk report across a set of trainers by running
 * {@link analyzeRiskTrend} for each trainer and summarising the results.
 *
 * @param trainers - The trainers to include in the report.
 * @param historicalSnapshots - All persisted snapshots used for each trainer's trend analysis.
 * @param timeRange - The look-back window applied to each trainer's analysis. Defaults to `'month'`.
 * @returns An object summarising the number of trainers at each risk level, trend counts,
 *          average risk score, and the individual {@link RiskTrendAnalysis} entries.
 *          Trainers with no snapshots in the period are excluded from all calculations.
 */
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

/**
 * Determines whether enough time has elapsed since the last risk snapshot to
 * warrant capturing a new one.
 *
 * @param trainerId - The identifier of the trainer (informational; not used in the calculation).
 * @param lastSnapshot - The most recent snapshot for the trainer, or `undefined` if none exists.
 * @param frequencyHours - Minimum hours between snapshots. Defaults to 24.
 * @returns `true` when no prior snapshot exists or when the elapsed time meets or exceeds `frequencyHours`.
 */
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

/**
 * Reduces a collection of risk snapshots to one representative snapshot per
 * calendar day by retaining only the most recent snapshot for each day.
 *
 * @param snapshots - The snapshots to aggregate (may contain multiple per day).
 * @returns A deduplicated array of snapshots sorted chronologically, one per day.
 */
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
