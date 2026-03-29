import { parseNumericInput } from './parse-numeric-input'

describe('parseNumericInput', () => {
    it('parses valid integer strings', () => {
        expect(parseNumericInput('42', 10)).toBe(42)
        expect(parseNumericInput('-3', 10)).toBe(-3)
    })

    it('truncates decimal input toward zero', () => {
        expect(parseNumericInput('42.9', 10)).toBe(42)
        expect(parseNumericInput('-7.8', 10)).toBe(-7)
    })

    it('returns fallback for empty or whitespace-only values', () => {
        expect(parseNumericInput('', 15)).toBe(15)
        expect(parseNumericInput('   ', 15)).toBe(15)
    })

    it('truncates a non-integer fallbackValue', () => {
        expect(parseNumericInput('', 15.9)).toBe(15)
        expect(parseNumericInput('abc', 3.7)).toBe(3)
    })

    it('returns fallback for non-finite and invalid values', () => {
        expect(parseNumericInput('abc', 9)).toBe(9)
        expect(parseNumericInput('NaN', 9)).toBe(9)
        expect(parseNumericInput('Infinity', 9)).toBe(9)
        expect(parseNumericInput('-Infinity', 9)).toBe(9)
    })

    it('applies minimum and maximum bounds when provided', () => {
        expect(parseNumericInput('3', 0, 5)).toBe(5)
        expect(parseNumericInput('11', 0, undefined, 10)).toBe(10)
        expect(parseNumericInput('7', 0, 5, 10)).toBe(7)
    })

    it('clamps to max when value exceeds max and both min and max are given', () => {
        expect(parseNumericInput('15', 0, 5, 10)).toBe(10)
    })

    it('passes through exact boundary values without clamping', () => {
        expect(parseNumericInput('5', 0, 5, 10)).toBe(5)
        expect(parseNumericInput('10', 0, 5, 10)).toBe(10)
    })

    it('accepts equal minimum and maximum bounds', () => {
        expect(parseNumericInput('100', 0, 5, 5)).toBe(5)
        expect(parseNumericInput('5', 0, 5, 5)).toBe(5)
    })

    it('handles negative numbers correctly', () => {
        expect(parseNumericInput('-5', 0)).toBe(-5)
        expect(parseNumericInput('-5', 0, -3)).toBe(-3)
        expect(parseNumericInput('-1', 0, -10, 0)).toBe(-1)
    })

    it('throws when min is greater than max', () => {
        expect(() => parseNumericInput('7', 0, 10, 5)).toThrow(
            'parseNumericInput: min (10) must be less than or equal to max (5)'
        )
    })
})
