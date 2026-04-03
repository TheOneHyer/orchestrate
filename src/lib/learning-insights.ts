import { differenceInDays } from 'date-fns'

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
 * Determine the learning risk level from enrollment progress and elapsed days.
 *
 * @param progress - Current completion percentage (0–100)
 * @param daysSinceEnrollment - Full days elapsed since enrollment
 * @returns `'at-risk'` when `progress < 25` and `daysSinceEnrollment >= 21`, or `progress < 50` and `daysSinceEnrollment >= 45`; `'watch'` when `progress < 50` and `daysSinceEnrollment >= 14`, or `progress < 80` and `daysSinceEnrollment >= 35`; otherwise `'on-track'`
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
 * Produce prioritized learning-focus entries for active enrollments to surface stalled progress.
 *
 * @param enrollments - Enrollment records to evaluate (only `status === 'in-progress'` are considered).
 * @param courses - Course catalog used to resolve course titles.
 * @param now - Reference date used to calculate days since enrollment.
 * @returns An array of `LearningFocusItem` objects sorted by urgency: higher risk levels first, then larger `progressGap`, then greater `daysSinceEnrollment`.
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
            if (Number.isNaN(enrolledAt.getTime())) {
                return null
            }
            const daysSinceEnrollment = Math.max(
                0,
                differenceInDays(now, enrolledAt)
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
