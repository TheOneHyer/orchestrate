import type { Enrollment } from './types'

/**
 * Asserts that a score value is a finite number within the valid 0–100 range.
 *
 * @param value - The numeric value to validate.
 * @param name - The parameter name used in the error message.
 * @throws {RangeError} When `value` is non-finite or outside the 0–100 range.
 */
function assertScoreRange(value: number, name: string): void {
    if (!Number.isFinite(value)) {
        throw new RangeError(`${name} must be a finite number between 0 and 100, received ${value}`)
    }

    if (value < 0 || value > 100) {
        throw new RangeError(`${name} must be between 0 and 100, received ${value}`)
    }
}

/**
 * The minimal set of fields applied to an enrollment record when a trainer
 * or admin records a final assessment score.
 */
export interface EnrollmentScoreUpdate {
    /** The numeric score achieved (0–100). */
    score: number
    /** Completion percentage after scoring — always 100 once a score is recorded. */
    progress: number
    /** New enrollment lifecycle status derived from the score vs. the pass threshold. */
    status: 'completed' | 'failed'
    /** ISO 8601 timestamp of when the score was recorded, or undefined if the status is 'failed'. */
    completedAt?: string
}

/**
 * Computes the enrollment field updates to apply when a score is recorded.
 *
 * If `score >= passScore` the enrollment transitions to `'completed'`; otherwise
 * it transitions to `'failed'`. Progress is always set to `100` because a score
 * represents a finished attempt regardless of outcome. When transitioning to
 * 'completed' for the first time, `completedAt` is set to the current UTC timestamp;
 * if the enrollment was already completed, the existing `completedAt` is preserved.
 * When transitioning to 'failed', `completedAt` is cleared (set to undefined).
 *
 * @param score - The assessment score achieved (0–100 inclusive).
 * @param passScore - The minimum score required to pass the course (0–100 inclusive).
 * @param enrollment - The existing enrollment record to check previous state.
 * @returns The enrollment field updates to apply.
 * @throws {RangeError} When `score` or `passScore` is outside the 0–100 range.
 */
export function applyScore(score: number, passScore: number, enrollment: Enrollment): EnrollmentScoreUpdate {
    assertScoreRange(score, 'score')
    assertScoreRange(passScore, 'passScore')

    const newStatus = score >= passScore ? 'completed' : 'failed'
    let completedAt: string | undefined

    if (newStatus === 'completed') {
        // Preserve existing completedAt if already completed, otherwise set new timestamp
        completedAt = enrollment.status === 'completed' && enrollment.completedAt
            ? enrollment.completedAt
            : new Date().toISOString()
    } else {
        // Clear completedAt for failed status
        completedAt = undefined
    }

    return {
        score,
        progress: 100,
        status: newStatus,
        completedAt,
    }
}

/**
 * Determines whether applying a score should emit a completion notification.
 *
 * @param currentStatus - The enrollment's status before the score is applied.
 * @param score - The score to apply (0–100).
 * @param passScore - The minimum passing score for the course (0–100).
 * @returns `true` if the enrollment is not already `'completed'` and `score` is greater than or equal to `passScore`, `false` otherwise.
 * @throws {RangeError} When `score` or `passScore` is not a finite number or is outside the inclusive 0–100 range.
 */
export function shouldNotifyCompletion(
    currentStatus: Enrollment['status'],
    score: number,
    passScore: number,
): boolean {
    assertScoreRange(score, 'score')
    assertScoreRange(passScore, 'passScore')

    return currentStatus !== 'completed' && score >= passScore
}