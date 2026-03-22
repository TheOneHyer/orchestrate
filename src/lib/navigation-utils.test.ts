import { describe, expect, it } from 'vitest'

import { normalizeNavigationValue } from './navigation-utils'

describe('normalizeNavigationValue', () => {
    it('returns null for empty values', () => {
        expect(normalizeNavigationValue('')).toBeNull()
        expect(normalizeNavigationValue('   ')).toBeNull()
        expect(normalizeNavigationValue('/')).toBeNull()
    })

    it('returns plain view values unchanged', () => {
        expect(normalizeNavigationValue('schedule')).toEqual({ view: 'schedule' })
        expect(normalizeNavigationValue('notifications')).toEqual({ view: 'notifications' })
    })

    it('normalizes slash-prefixed static routes', () => {
        expect(normalizeNavigationValue('/burnout-dashboard')).toEqual({ view: 'burnout-dashboard' })
        expect(normalizeNavigationValue('/certifications')).toEqual({ view: 'certifications' })
    })

    it('extracts userId payload from people path', () => {
        expect(normalizeNavigationValue('/people/trainer-1')).toEqual({
            view: 'people',
            data: { userId: 'trainer-1' },
        })
    })

    it('extracts sessionId payload from schedule path', () => {
        expect(normalizeNavigationValue('/schedule/session-7')).toEqual({
            view: 'schedule',
            data: { sessionId: 'session-7' },
        })
    })

    it('decodes path payload values', () => {
        expect(normalizeNavigationValue('/people/user%201')).toEqual({
            view: 'people',
            data: { userId: 'user 1' },
        })
    })
})
