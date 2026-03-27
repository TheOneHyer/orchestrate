import { applyScore, shouldNotifyCompletion } from './scoring'
import type { Enrollment } from './types'
import { parseISO } from 'date-fns'

function createMockEnrollment(overrides?: Partial<Enrollment>): Enrollment {
    return {
        id: 'enrollment-1',
        userId: 'user-1',
        courseId: 'course-1',
        status: 'in-progress',
        progress: 50,
        enrolledAt: '2024-01-01T00:00:00.000Z',
        ...overrides,
    }
}

describe('applyScore', () => {
    describe('passing scores', () => {
        it('marks enrollment completed when score equals pass score', () => {
            const enrollment = createMockEnrollment()
            const result = applyScore(80, 80, enrollment)
            expect(result.status).toBe('completed')
            expect(result.score).toBe(80)
            expect(result.progress).toBe(100)
            expect(result.completedAt).toBeTruthy()
        })

        it('marks enrollment completed when score exceeds pass score', () => {
            const enrollment = createMockEnrollment()
            const result = applyScore(95, 80, enrollment)
            expect(result.status).toBe('completed')
            expect(result.score).toBe(95)
        })

        it('marks enrollment completed with a perfect score', () => {
            const enrollment = createMockEnrollment()
            const result = applyScore(100, 80, enrollment)
            expect(result.status).toBe('completed')
        })

        it('marks completed when passScore is 0 and score is 0', () => {
            const enrollment = createMockEnrollment()
            const result = applyScore(0, 0, enrollment)
            expect(result.status).toBe('completed')
        })
    })

    describe('failing scores', () => {
        it('marks enrollment failed when score is below pass score and clears completedAt', () => {
            const enrollment = createMockEnrollment()
            const result = applyScore(79, 80, enrollment)
            expect(result.status).toBe('failed')
            expect(result.score).toBe(79)
            expect(result.progress).toBe(100)
            expect(result.completedAt).toBeUndefined()
        })

        it('marks failed when score is 0 and pass score is 80', () => {
            const enrollment = createMockEnrollment()
            const result = applyScore(0, 80, enrollment)
            expect(result.status).toBe('failed')
        })

        it('marks failed for a score of 99 with pass score of 100', () => {
            const enrollment = createMockEnrollment()
            const result = applyScore(99, 100, enrollment)
            expect(result.status).toBe('failed')
        })
    })

    describe('progress and completion timestamp', () => {
        it('always sets progress to 100', () => {
            const enrollment = createMockEnrollment()
            expect(applyScore(50, 80, enrollment).progress).toBe(100)
            expect(applyScore(90, 80, enrollment).progress).toBe(100)
        })

        it('sets completedAt to a valid ISO string for first completion', () => {
            const enrollment = createMockEnrollment()
            const result = applyScore(85, 80, enrollment)
            expect(result.completedAt).toBeTruthy()
            expect(typeof result.completedAt).toBe('string')
            expect(() => parseISO(result.completedAt!)).not.toThrow()
        })

        it('preserves existing completedAt when re-scoring a completed enrollment', () => {
            const existingCompletedAt = '2024-01-15T10:00:00.000Z'
            const enrollment = createMockEnrollment({
                status: 'completed',
                completedAt: existingCompletedAt,
            })
            const result = applyScore(95, 80, enrollment)
            expect(result.completedAt).toBe(existingCompletedAt)
        })

        it('clears completedAt when enrollment transitions to failed', () => {
            const enrollment = createMockEnrollment({
                status: 'completed',
                completedAt: '2024-01-15T10:00:00.000Z',
            })
            const result = applyScore(50, 80, enrollment)
            expect(result.status).toBe('failed')
            expect(result.completedAt).toBeUndefined()
        })
    })

    describe('boundary validation', () => {
        it('throws RangeError when score is below 0', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(-1, 80, enrollment)).toThrow(RangeError)
        })

        it('throws RangeError when score is NaN', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(Number.NaN, 80, enrollment)).toThrow(RangeError)
        })

        it('throws RangeError when passScore is NaN', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(80, Number.NaN, enrollment)).toThrow(RangeError)
        })

        it('throws RangeError when passScore is infinite', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(80, Number.POSITIVE_INFINITY, enrollment)).toThrow(RangeError)
        })

        it('throws RangeError when passScore is negative infinity', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(80, Number.NEGATIVE_INFINITY, enrollment)).toThrow(RangeError)
        })

        it('throws RangeError when score is positive infinity', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(Number.POSITIVE_INFINITY, 80, enrollment)).toThrow(RangeError)
        })

        it('throws RangeError when score is negative infinity', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(Number.NEGATIVE_INFINITY, 80, enrollment)).toThrow(RangeError)
        })

        it('throws RangeError when score exceeds 100', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(101, 80, enrollment)).toThrow(RangeError)
        })

        it('throws RangeError when passScore is below 0', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(80, -1, enrollment)).toThrow(RangeError)
        })

        it('throws RangeError when passScore exceeds 100', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(80, 101, enrollment)).toThrow(RangeError)
        })

        it('accepts 0 as a valid score', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(0, 50, enrollment)).not.toThrow()
        })

        it('accepts 100 as a valid score', () => {
            const enrollment = createMockEnrollment()
            expect(() => applyScore(100, 50, enrollment)).not.toThrow()
        })
    })
})

describe('shouldNotifyCompletion', () => {
    it('returns true when previous status is "enrolled" and score passes', () => {
        expect(shouldNotifyCompletion('enrolled', 85, 80)).toBe(true)
    })

    it('returns true when previous status is "in-progress" and score passes', () => {
        expect(shouldNotifyCompletion('in-progress', 80, 80)).toBe(true)
    })

    it('returns true when previous status is "failed" and score now passes', () => {
        expect(shouldNotifyCompletion('failed', 90, 80)).toBe(true)
    })

    it('returns false when previous status is "completed" (already completed, no duplicate)', () => {
        expect(shouldNotifyCompletion('completed', 95, 80)).toBe(false)
    })

    it('returns false when score is below the pass threshold', () => {
        expect(shouldNotifyCompletion('enrolled', 70, 80)).toBe(false)
    })

    it('returns false when status is "in-progress" and score fails', () => {
        expect(shouldNotifyCompletion('in-progress', 50, 80)).toBe(false)
    })

    it('returns false when status is "failed" and score still fails', () => {
        expect(shouldNotifyCompletion('failed', 40, 80)).toBe(false)
    })

    it('throws RangeError when score is below 0', () => {
        expect(() => shouldNotifyCompletion('enrolled', -1, 80)).toThrow(RangeError)
    })

    it('throws RangeError when score is NaN', () => {
        expect(() => shouldNotifyCompletion('enrolled', Number.NaN, 80)).toThrow(RangeError)
    })

    it('throws RangeError when score is positive infinity', () => {
        expect(() => shouldNotifyCompletion('enrolled', Number.POSITIVE_INFINITY, 80)).toThrow(RangeError)
    })

    it('throws RangeError when score is negative infinity', () => {
        expect(() => shouldNotifyCompletion('enrolled', Number.NEGATIVE_INFINITY, 80)).toThrow(RangeError)
    })

    it('throws RangeError when passScore is NaN', () => {
        expect(() => shouldNotifyCompletion('enrolled', 80, Number.NaN)).toThrow(RangeError)
    })

    it('throws RangeError when passScore is positive infinity', () => {
        expect(() => shouldNotifyCompletion('enrolled', 80, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    })

    it('throws RangeError when passScore is negative infinity', () => {
        expect(() => shouldNotifyCompletion('enrolled', 80, Number.NEGATIVE_INFINITY)).toThrow(RangeError)
    })

    it('throws RangeError when score exceeds 100', () => {
        expect(() => shouldNotifyCompletion('enrolled', 101, 80)).toThrow(RangeError)
    })

    it('throws RangeError when passScore is below 0', () => {
        expect(() => shouldNotifyCompletion('enrolled', 80, -1)).toThrow(RangeError)
    })

    it('throws RangeError when passScore exceeds 100', () => {
        expect(() => shouldNotifyCompletion('enrolled', 80, 101)).toThrow(RangeError)
    })
})