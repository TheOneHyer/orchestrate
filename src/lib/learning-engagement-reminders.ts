import { isValid, parseISO } from 'date-fns'

import type { Course, Enrollment, Notification } from './types'

import { buildLearningEngagementItems } from './learning-engagement'

/** Generated reminder candidate for stalled learner engagement follow-up. */
export interface LearningEngagementReminderCandidate {
    /** Unique de-duplication key for this engagement reminder. */
    reminderKey: string
    /** Recipient user identifier. */
    userId: string
    /** Related enrollment identifier. */
    enrollmentId: string
    /** Related course identifier. */
    courseId: string
    /** Reminder title text. */
    title: string
    /** Reminder message body. */
    message: string
    /** Reminder urgency level. */
    priority: 'medium' | 'high'
}

/**
 * Builds deduplicated reminder candidates for stalled learner engagement events.
 *
 * @param enrollments - Enrollment records to evaluate.
 * @param courses - Course catalog used to resolve display names.
 * @param notifications - Existing notifications used for duplicate suppression.
 * @param now - Optional time reference for deterministic tests.
 * @returns Reminder candidates for new stalled/critical engagement nudges.
 */
export function buildLearningEngagementReminderCandidates(
    enrollments: Enrollment[],
    courses: Course[],
    notifications: Notification[],
    now: Date = new Date(),
): LearningEngagementReminderCandidate[] {
    const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]))
    const existingReminderKeys = new Set(
        notifications
            .map((notification) => notification.metadata?.engagementReminderKey)
            .filter((value): value is string => typeof value === 'string'),
    )

    return buildLearningEngagementItems(enrollments, courses, now)
        .filter((item) => {
            const enrollment = enrollmentById.get(item.enrollmentId)
            const lastProgressAt = enrollment?.lastProgressAt
            if (typeof lastProgressAt !== 'string' || lastProgressAt.length === 0) {
                return false
            }

            const parsedLastProgressAt = parseISO(lastProgressAt)
            return isValid(parsedLastProgressAt)
        })
        .map((item) => {
            const reminderKey = `${item.enrollmentId}:${item.severity}`
            if (existingReminderKeys.has(reminderKey)) {
                return null
            }

            const title =
                item.severity === 'critical-stall'
                    ? `Critical Learning Stall — ${item.courseTitle}`
                    : `Learning Stall Alert — ${item.courseTitle}`

            const message =
                item.severity === 'critical-stall'
                    ? `No learning activity detected for ${item.daysSinceProgress} days. Immediate manager intervention is recommended.`
                    : `No learning activity detected for ${item.daysSinceProgress} days. Send a coaching nudge to restart progress.`

            return {
                reminderKey,
                userId: item.userId,
                enrollmentId: item.enrollmentId,
                courseId: item.courseId,
                title,
                message,
                priority: item.severity === 'critical-stall' ? 'high' : 'medium',
            }
        })
        .filter((candidate): candidate is LearningEngagementReminderCandidate => candidate !== null)
}
