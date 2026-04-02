import { Course, Enrollment, Notification } from '@/lib/types'

import { buildLearningDeadlineInsights } from '@/lib/learning-deadlines'

/** Represents a generated reminder candidate for a learner deadline event. */
export interface LearningReminderCandidate {
    /** Unique de-duplication key for this reminder event. */
    reminderKey: string
    /** Recipient user identifier. */
    userId: string
    /** Related course identifier. */
    courseId: string
    /** Reminder notification title. */
    title: string
    /** Reminder notification message body. */
    message: string
    /** Notification urgency level. */
    priority: 'medium' | 'high'
}

/**
 * Builds unique reminder candidates for due-soon and overdue deadlines while
 * suppressing reminders that were already generated.
 *
 * @param enrollments - Enrollments to evaluate for reminder conditions.
 * @param courses - Course catalog for title resolution.
 * @param notifications - Existing notifications used for duplicate suppression.
 * @param now - Optional reference time for deterministic tests.
 * @returns New reminder candidates that should be emitted.
 */
export function buildLearningReminderCandidates(
    enrollments: Enrollment[],
    courses: Course[],
    notifications: Notification[],
    now: Date = new Date()
): LearningReminderCandidate[] {
    const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]))
    const existingReminderKeys = new Set(
        notifications
            .map((notification) => notification.metadata?.learningReminderKey)
            .filter((value): value is string => typeof value === 'string')
    )

    return buildLearningDeadlineInsights(enrollments, courses, now)
        .filter((insight) => insight.urgency === 'due-soon' || insight.urgency === 'overdue')
        .filter((insight) => {
            // Only emit reminders for enrollments with explicit targets to avoid noisy defaults.
            const enrollment = enrollmentById.get(insight.enrollmentId)
            return Boolean(enrollment?.targetCompletionDate)
        })
        .map((insight) => {
            const stage = insight.urgency === 'overdue' ? 'overdue' : 'due-soon'
            const reminderKey = `${insight.enrollmentId}:${stage}`
            if (existingReminderKeys.has(reminderKey)) {
                return null
            }

            const title = insight.urgency === 'overdue'
                ? `Overdue Training — ${insight.courseTitle}`
                : `Due Soon — ${insight.courseTitle}`

            const message = insight.urgency === 'overdue'
                ? `This training is ${Math.abs(insight.daysUntilDue)} day${Math.abs(insight.daysUntilDue) === 1 ? '' : 's'} overdue. Continue the course to get back on track.`
                : insight.daysUntilDue === 0
                    ? 'This training is due today. Finish remaining modules before the target date.'
                    : `This training is due in ${insight.daysUntilDue} day${insight.daysUntilDue === 1 ? '' : 's'}. Finish remaining modules before the target date.`

            return {
                reminderKey,
                userId: insight.userId,
                courseId: insight.courseId,
                title,
                message,
                priority: insight.urgency === 'overdue' ? 'high' : 'medium',
            }
        })
        .filter((candidate): candidate is LearningReminderCandidate => candidate !== null)
}
