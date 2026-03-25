import { describe, expect, it } from 'vitest'

import { applyScore, shouldNotifyCompletion } from './scoring'

describe('applyScore', () => {
    describe('passing scores', () => {
        it('marks enrollment completed when score equals pass score', () => {
            const result = applyScore(80, 80)
            expect(result.status).toBe('completed')
            expect(result.score).toBe(80)
            expect(result.progress).toBe(100)
            expect(result.completedAt).toBeTruthy()
        })

        it('marks enrollment completed when score exceeds pass score', () => {
            const result = applyScore(95, 80)
            expect(result.status).toBe('completed')
            expect(result.score).toBe(95)
        })

        it('marks enrollment completed with a perfect score', () => {
            const result = applyScore(100, 80)
            expect(result.status).toBe('completed')
        })

        it('marks completed when passScore is 0 and score is 0', () => {
            const result = applyScore(0, 0)
            expect(result.status).toBe('completed')
        })
    })

    describe('failing scores', () => {
        it('marks enrollment failed when score is below pass score', () => {
            const result = applyScore(79, 80)
            expect(result.status).toBe('failed')
            expect(result.score).toBe(79)
            expect(result.progress).toBe(100)
            expect(result.completedAt).toBeTruthy()
        })

        it('marks failed when score is 0 and pass score is 80', () => {
            const result = applyScore(0, 80)
            expect(result.status).toBe('failed')
        })

        it('marks failed for a score of 99 with pass score of 100', () => {
            const result = applyScore(99, 100)
            expect(result.status).toBe('failed')
        })
    })

    describe('progress and completion timestamp', () => {
        it('always sets progress to 100', () => {
            expect(applyScore(50, 80).progress).toBe(100)
            expect(applyScore(90, 80).progress).toBe(100)
        })

        it('sets completedAt to a valid ISO string close to now', () => {
            const before = Date.now()
            const result = applyScore(85, 80)
            const after = Date.now()
            const ts = new Date(result.completedAt).getTime()
            expect(ts).toBeGreaterThanOrEqual(before)
            expect(ts).toBeLessThanOrEqual(after)
        })
    })

    describe('boundary validation', () => {
        it('throws RangeError when score is below 0', () => {
            expect(() => applyScore(-1, 80)).toThrow(RangeError)
        })

        it('throws RangeError when score is NaN', () => {
            expect(() => applyScore(Number.NaN, 80)).toThrow(RangeError)
        })

        it('throws RangeError when passScore is NaN', () => {
            expect(() => applyScore(80, Number.NaN)).toThrow(RangeError)
        })

        it('throws RangeError when passScore is infinite', () => {
            expect(() => applyScore(80, Number.POSITIVE_INFINITY)).toThrow(RangeError)
        })

        it('throws RangeError when passScore is negative infinity', () => {
            expect(() => applyScore(80, Number.NEGATIVE_INFINITY)).toThrow(RangeError)
        })

        it('throws RangeError when score is positive infinity', () => {
            expect(() => applyScore(Number.POSITIVE_INFINITY, 80)).toThrow(RangeError)
        })

        it('throws RangeError when score is negative infinity', () => {
            expect(() => applyScore(Number.NEGATIVE_INFINITY, 80)).toThrow(RangeError)
        })

        it('throws RangeError when score exceeds 100', () => {
            expect(() => applyScore(101, 80)).toThrow(RangeError)
        })

        it('throws RangeError when passScore is below 0', () => {
            expect(() => applyScore(80, -1)).toThrow(RangeError)
        })

        it('throws RangeError when passScore exceeds 100', () => {
            expect(() => applyScore(80, 101)).toThrow(RangeError)
        })

        it('accepts 0 as a valid score', () => {
            expect(() => applyScore(0, 50)).not.toThrow()
        })

        it('accepts 100 as a valid score', () => {
            expect(() => applyScore(100, 50)).not.toThrow()
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
