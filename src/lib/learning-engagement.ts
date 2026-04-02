import { differenceInDays } from 'date-fns'

import type { Course, Enrollment } from './types'

/** Engagement severity for stalled learner progress. */
export type LearningStallSeverity = 'stalled' | 'critical-stall'

/**
 * Insight describing a learner enrollment with little or no recent progress.
 */
export interface LearningEngagementItem {
    /** Enrollment identifier. */
    enrollmentId: string
    /** User identifier associated with the enrollment. */
    userId: string
    /** Course identifier associated with the enrollment. */
    courseId: string
    /** Resolved course title for display. */
    courseTitle: string
    /** Current enrollment progress percentage. */
    progress: number
    /** Number of full days since progress was last observed. */
    daysSinceProgress: number
    /** Stall severity bucket derived from inactivity duration. */
    severity: LearningStallSeverity
    /** Recommended action for the coach or manager. */
    recommendedAction: string
}

/** Default day threshold for considering an enrollment stalled. */
export const DEFAULT_STALL_DAYS = 7
/** Default day threshold for considering an enrollment critically stalled. */
export const DEFAULT_CRITICAL_STALL_DAYS = 14

/**
 * Builds engagement insights for enrollments that have gone stale.
 *
 * Uses `lastProgressAt` when present and valid, otherwise falls back to
 * `enrolledAt` as the last known activity timestamp.
 *
 * @param enrollments - Enrollments to evaluate for inactivity.
 * @param courses - Course catalog used to resolve course titles.
 * @param now - Reference timestamp used to calculate inactivity windows.
 * @param stallDays - Minimum inactivity days to include in results.
 * @param criticalDays - Inactivity days for the critical-stall severity.
 * @returns Sorted stalled engagement items by severity and inactivity days.
 */
export function buildLearningEngagementItems(
    enrollments: Enrollment[],
    courses: Course[],
    now: Date = new Date(),
    stallDays: number = DEFAULT_STALL_DAYS,
    criticalDays: number = DEFAULT_CRITICAL_STALL_DAYS,
): LearningEngagementItem[] {
    const courseById = new Map(courses.map((course) => [course.id, course]))

    const items = enrollments
        .filter((enrollment) => enrollment.status === 'in-progress' || enrollment.status === 'enrolled')
        .map((enrollment) => {
            const course = courseById.get(enrollment.courseId)
            if (!course) {
                return null
            }

            const lastProgressDate = enrollment.lastProgressAt
                ? new Date(enrollment.lastProgressAt)
                : null
            const activityDate =
                lastProgressDate && !Number.isNaN(lastProgressDate.getTime())
                    ? lastProgressDate
                    : new Date(enrollment.enrolledAt)
            if (Number.isNaN(activityDate.getTime())) {
                return null
            }

            const daysSinceProgress = Math.max(0, differenceInDays(now, activityDate))

            if (daysSinceProgress < stallDays) {
                return null
            }

            const severity: LearningStallSeverity =
                daysSinceProgress >= criticalDays ? 'critical-stall' : 'stalled'

            const recommendedAction =
                severity === 'critical-stall'
                    ? 'Escalate to manager and assign a same-week recovery checkpoint.'
                    : 'Send a coaching nudge and suggest the next micro-goal module.'

            return {
                enrollmentId: enrollment.id,
                userId: enrollment.userId,
                courseId: enrollment.courseId,
                courseTitle: course.title,
                progress: enrollment.progress,
                daysSinceProgress,
                severity,
                recommendedAction,
            }
        })
        .filter((item): item is LearningEngagementItem => item !== null)

    const severityWeight: Record<LearningStallSeverity, number> = {
        'critical-stall': 2,
        stalled: 1,
    }

    return items.sort((left, right) => {
        const severityDiff = severityWeight[right.severity] - severityWeight[left.severity]
        if (severityDiff !== 0) {
            return severityDiff
        }

        const daysDiff = right.daysSinceProgress - left.daysSinceProgress
        if (daysDiff !== 0) {
            return daysDiff
        }

        return left.enrollmentId.localeCompare(right.enrollmentId)
    })
}
