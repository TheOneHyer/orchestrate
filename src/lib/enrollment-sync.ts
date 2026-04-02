import { addDays } from 'date-fns'

import type { Enrollment, Session } from '@/lib/types'
import { DEFAULT_TARGET_COMPLETION_DAYS } from '@/lib/learning-deadlines'

/**
 * Input contract for session-to-enrollment reconciliation.
 */
export interface ReconcileSessionEnrollmentsOptions {
    /** Existing enrollments persisted in state. */
    enrollments: Enrollment[]
    /** Current sessions that define active student registrations. */
    sessions: Session[]
    /** Timestamp used for deterministic enrollment creation and updates. */
    nowIso: string
    /** Factory for generating enrollment identifiers when creating new records. */
    createEnrollmentId: () => string
    /** Default target completion horizon in days when no explicit target exists. */
    targetCompletionDays?: number
}

/**
 * Reconciles enrollments from session rosters while preserving historical records.
 *
 * Active session-linked enrollments are derived from `session.enrolledStudents`.
 * Existing non-session enrollments are preserved as-is. Session-linked enrollments
 * that no longer appear in any roster are removed unless they are terminal
 * (`completed` or `failed`) to keep historical outcomes.
 *
 * @param options - Reconciliation input data.
 * @returns A normalized enrollment array reflecting current session rosters.
 */
export function reconcileSessionEnrollments(options: ReconcileSessionEnrollmentsOptions): Enrollment[] {
    const {
        enrollments,
        sessions,
        nowIso,
        createEnrollmentId,
        targetCompletionDays = DEFAULT_TARGET_COMPLETION_DAYS,
    } = options

    if (sessions.length === 0) {
        return enrollments
    }

    const activeSessionMembership = new Map<string, { sessionId: string; userId: string; courseId: string }>()

    sessions.forEach((session) => {
        if (!session.courseId || session.enrolledStudents.length === 0) {
            return
        }

        new Set(session.enrolledStudents).forEach((userId) => {
            activeSessionMembership.set(`${session.id}:${userId}`, {
                sessionId: session.id,
                userId,
                courseId: session.courseId,
            })
        })
    })

    const existingSessionEnrollments = new Map<string, Enrollment>()
    const preservedNonSessionEnrollments = enrollments.filter((enrollment) => {
        if (!enrollment.sessionId) {
            return true
        }

        const key = `${enrollment.sessionId}:${enrollment.userId}`
        if (!existingSessionEnrollments.has(key)) {
            existingSessionEnrollments.set(key, enrollment)
        }

        return false
    })

    const reconciledSessionEnrollments: Enrollment[] = []

    activeSessionMembership.forEach(({ sessionId, userId, courseId }, key) => {
        const existingEnrollment = existingSessionEnrollments.get(key)

        if (existingEnrollment) {
            const baseDate = new Date(existingEnrollment.enrolledAt)
            const resolvedBaseDate = Number.isNaN(baseDate.getTime()) ? new Date(nowIso) : baseDate
            const existingTarget = existingEnrollment.targetCompletionDate
            const parsedExistingTarget = existingTarget ? new Date(existingTarget) : null
            const hasValidExistingTarget =
                parsedExistingTarget !== null && !Number.isNaN(parsedExistingTarget.getTime())
            const targetCompletionDate = hasValidExistingTarget
                ? existingTarget!
                : addDays(resolvedBaseDate, targetCompletionDays).toISOString()

            reconciledSessionEnrollments.push({
                ...existingEnrollment,
                courseId,
                targetCompletionDate,
                lastProgressAt: existingEnrollment.lastProgressAt ?? nowIso,
            })
            return
        }

        reconciledSessionEnrollments.push({
            id: createEnrollmentId(),
            userId,
            courseId,
            sessionId,
            status: 'enrolled',
            progress: 0,
            enrolledAt: nowIso,
            targetCompletionDate: addDays(new Date(nowIso), targetCompletionDays).toISOString(),
            lastProgressAt: nowIso,
        })
    })

    const preservedTerminalSessionEnrollments = enrollments.filter((enrollment) => {
        if (!enrollment.sessionId) {
            return false
        }

        const key = `${enrollment.sessionId}:${enrollment.userId}`
        if (activeSessionMembership.has(key)) {
            return false
        }

        return enrollment.status === 'completed' || enrollment.status === 'failed'
    })

    return [
        ...preservedNonSessionEnrollments,
        ...preservedTerminalSessionEnrollments,
        ...reconciledSessionEnrollments,
    ]
}
