import { Course, Enrollment } from '@/lib/types'

/** Represents the urgency level for an in-progress enrollment. */
export type LearningRiskLevel = 'on-track' | 'watch' | 'at-risk'

/**
 * Computed insight for a learner's active enrollment.
 */
export interface LearningFocusItem {
  /** Enrollment identifier. */
  enrollmentId: string
  /** Course identifier associated with the enrollment. */
  courseId: string
  /** Resolved course title. */
  courseTitle: string
  /** Current recorded completion percentage. */
  progress: number
  /** Number of full days since the learner enrolled. */
  daysSinceEnrollment: number
  /** Estimated expected progress based on a 60-day completion horizon. */
  expectedProgress: number
  /** Positive gap between expected and actual progress. */
  progressGap: number
  /** Risk level inferred from momentum and age of the enrollment. */
  riskLevel: LearningRiskLevel
  /** Suggested next step to help the learner recover momentum. */
  recommendedAction: string
}

const SIXTY_DAY_COMPLETION_WINDOW = 60

/**
 * Classifies risk for an enrollment using progress and time elapsed since enrollment.
 *
 * @param progress - Current completion percentage in the range 0 to 100.
 * @param daysSinceEnrollment - Full days since enrollment started.
 * @returns The derived risk level for the enrollment.
 */
export function classifyLearningRisk(progress: number, daysSinceEnrollment: number): LearningRiskLevel {
  if ((progress < 25 && daysSinceEnrollment >= 21) || (progress < 50 && daysSinceEnrollment >= 45)) {
    return 'at-risk'
  }

  if ((progress < 50 && daysSinceEnrollment >= 14) || (progress < 80 && daysSinceEnrollment >= 35)) {
    return 'watch'
  }

  return 'on-track'
}

/**
 * Builds prioritized enrollment insights that highlight stalled learner progress.
 *
 * @param enrollments - Enrollment records to evaluate.
 * @param courses - Course catalog used to resolve course titles.
 * @param now - Reference date used to calculate elapsed days.
 * @returns Sorted learning focus items from highest to lowest urgency.
 */
export function buildLearningFocusItems(
  enrollments: Enrollment[],
  courses: Course[],
  now: Date = new Date()
): LearningFocusItem[] {
  const courseById = new Map(courses.map((course) => [course.id, course]))

  const items = enrollments
    .filter((enrollment) => enrollment.status === 'in-progress')
    .map((enrollment) => {
      const course = courseById.get(enrollment.courseId)
      if (!course) {
        return null
      }

      const enrolledAt = new Date(enrollment.enrolledAt)
      const enrolledAtTime = enrolledAt.getTime()
      if (!Number.isFinite(enrolledAtTime)) {
        return null
      }
      const daysSinceEnrollment = Math.max(
        0,
        Math.floor((now.getTime() - enrolledAtTime) / (1000 * 60 * 60 * 24))
      )
      const expectedProgress = Math.min(100, Math.round((daysSinceEnrollment / SIXTY_DAY_COMPLETION_WINDOW) * 100))
      const progressGap = Math.max(0, expectedProgress - enrollment.progress)
      const riskLevel = classifyLearningRisk(enrollment.progress, daysSinceEnrollment)

      const recommendedAction = riskLevel === 'at-risk'
        ? 'Schedule a check-in and assign a short recovery milestone.'
        : riskLevel === 'watch'
          ? 'Send a reminder and suggest the next module in this course.'
          : 'Maintain cadence with one module this week.'

      return {
        enrollmentId: enrollment.id,
        courseId: course.id,
        courseTitle: course.title,
        progress: enrollment.progress,
        daysSinceEnrollment,
        expectedProgress,
        progressGap,
        riskLevel,
        recommendedAction,
      }
    })
    .filter((item): item is LearningFocusItem => item !== null)

  const riskWeight: Record<LearningRiskLevel, number> = {
    'at-risk': 3,
    watch: 2,
    'on-track': 1,
  }

  return items.sort((a, b) => {
    const riskDiff = riskWeight[b.riskLevel] - riskWeight[a.riskLevel]
    if (riskDiff !== 0) {
      return riskDiff
    }

    const gapDiff = b.progressGap - a.progressGap
    if (gapDiff !== 0) {
      return gapDiff
    }

    return b.daysSinceEnrollment - a.daysSinceEnrollment
  })
}
