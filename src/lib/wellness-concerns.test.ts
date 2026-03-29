import { COMMON_CONCERNS } from './wellness-concerns'

describe('COMMON_CONCERNS', () => {
    it('contains the expected ordered concern list', () => {
        expect(COMMON_CONCERNS).toEqual([
            'Too many sessions scheduled',
            'Insufficient preparation time',
            'Challenging student behaviors',
            'Lack of administrative support',
            'Unclear expectations',
            'Technology issues',
            'Personal/family stress',
            'Physical health concerns',
            'Sleep difficulties',
            'Work-life balance',
        ])
    })

    it('contains only non-empty unique strings', () => {
        expect(COMMON_CONCERNS.every((concern) => concern.trim().length > 0)).toBe(true)
        expect(new Set(COMMON_CONCERNS).size).toBe(COMMON_CONCERNS.length)
    })
})
