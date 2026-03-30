import { describe, expect, it } from 'vitest'

import { getFirstValidationErrorMessage } from './courses-utils'

describe('getFirstValidationErrorMessage', () => {
    it('returns the pass score validation message when present', () => {
        const message = getFirstValidationErrorMessage({
            passScore: { message: 'Pass score must be between 0 and 100.' },
        })

        expect(message).toBe('Pass score must be between 0 and 100.')
    })

    it('returns nested module title validation message when available', () => {
        const message = getFirstValidationErrorMessage({
            moduleDetails: [
                {
                    title: { message: 'Each module needs a title and positive duration.' },
                },
            ],
        })

        expect(message).toBe('Each module needs a title and positive duration.')
    })

    it('returns module-level validation messages before scanning nested module errors', () => {
        const message = getFirstValidationErrorMessage({
            moduleDetails: {
                message: 'At least one module is required.',
            },
        })

        expect(message).toBe('At least one module is required.')
    })

    it('falls back to the generic validation message when no known errors exist', () => {
        const message = getFirstValidationErrorMessage({})

        expect(message).toBe('Please review the course details and try again.')
    })
})
