import { describe, expect, it } from 'vitest'

import { normalizeNavigationValue } from './navigation-utils'

describe('normalizeNavigationValue', () => {
    it('returns null for empty values', () => {
        expect(normalizeNavigationValue('')).toBeNull()
        expect(normalizeNavigationValue('   ')).toBeNull()
        expect(normalizeNavigationValue('/')).toBeNull()
        expect(normalizeNavigationValue('/?source=notification')).toBeNull()
        expect(normalizeNavigationValue('/#section')).toBeNull()
    })

    it('wraps plain view values in object structure', () => {
        expect(normalizeNavigationValue('schedule')).toEqual({ view: 'schedule' })
        expect(normalizeNavigationValue('notifications')).toEqual({ view: 'notifications' })
    })

    it('normalizes slash-prefixed static routes', () => {
        expect(normalizeNavigationValue('/burnout-dashboard')).toEqual({ view: 'burnout-dashboard' })
        expect(normalizeNavigationValue('/certifications')).toEqual({ view: 'certifications' })
        expect(normalizeNavigationValue('/certifications/')).toEqual({ view: 'certifications' })
    })

    it('extracts userId payload from people path', () => {
        expect(normalizeNavigationValue('/people/trainer-1')).toEqual({
            view: 'people',
            data: { userId: 'trainer-1' },
        })
        expect(normalizeNavigationValue('/people/')).toEqual({ view: 'people' })
    })

    it('handles unusual people-path inputs consistently', () => {
        expect(normalizeNavigationValue('/people/trainer-1/')).toEqual({
            view: 'people',
            data: { userId: 'trainer-1' },
        })

        expect(normalizeNavigationValue('/people/')).toEqual({ view: 'people' })

        expect(normalizeNavigationValue('/people//trainer-1')).toEqual({
            view: 'people//trainer-1',
        })

        expect(normalizeNavigationValue('/people/trainer-1?foo=bar')).toEqual({
            view: 'people',
            data: { userId: 'trainer-1' },
        })

        expect(normalizeNavigationValue('/people/trainer-1#section')).toEqual({
            view: 'people',
            data: { userId: 'trainer-1' },
        })
    })

    it('extracts sessionId payload from schedule path', () => {
        expect(normalizeNavigationValue('/schedule/session-7')).toEqual({
            view: 'schedule',
            data: { sessionId: 'session-7' },
        })
        expect(normalizeNavigationValue('/schedule/session-7/')).toEqual({
            view: 'schedule',
            data: { sessionId: 'session-7' },
        })
        expect(normalizeNavigationValue('/schedule/')).toEqual({ view: 'schedule' })
    })

    it('strips query string from schedule session path', () => {
        expect(normalizeNavigationValue('/schedule/session-7?ref=notification')).toEqual({
            view: 'schedule',
            data: { sessionId: 'session-7' },
        })
    })

    it('strips hash fragment from schedule session path', () => {
        expect(normalizeNavigationValue('/schedule/session-7#anchor')).toEqual({
            view: 'schedule',
            data: { sessionId: 'session-7' },
        })
    })

    it('does not extract sessionId when schedule path has more than two segments', () => {
        expect(normalizeNavigationValue('/schedule/session-7/extra')).toEqual({
            view: 'schedule/session-7/extra',
        })
    })

    it('handles invalid encoding in schedule path by surfacing URI errors', () => {
        expect(() => normalizeNavigationValue('/schedule/%ZZ')).toThrow(URIError)
    })

    it('decodes special characters', () => {
        expect(normalizeNavigationValue('/people/user%2Fname')).toEqual({
            view: 'people',
            data: { userId: 'user/name' },
        })
        expect(normalizeNavigationValue('/people/user%3Fname')).toEqual({
            view: 'people',
            data: { userId: 'user?name' },
        })
        expect(normalizeNavigationValue('/people/user%23name')).toEqual({
            view: 'people',
            data: { userId: 'user#name' },
        })
    })

    it('decodes unicode characters', () => {
        expect(normalizeNavigationValue('/people/caf%C3%A9')).toEqual({
            view: 'people',
            data: { userId: 'caf\u00E9' },
        })
    })

    it('handles multiple encoded chars in a segment', () => {
        expect(normalizeNavigationValue('/people/one%20two%2Fthree')).toEqual({
            view: 'people',
            data: { userId: 'one two/three' },
        })
    })

    it('handles invalid encoding by surfacing URI errors', () => {
        expect(() => normalizeNavigationValue('/people/%ZZ')).toThrow(URIError)
    })

    it('does not extract userId when path has more than two segments', () => {
        expect(normalizeNavigationValue('/people/trainer-1/extra')).toEqual({
            view: 'people/trainer-1/extra',
        })
    })

    it('strips query string from view name for non-special routes', () => {
        expect(normalizeNavigationValue('/burnout-dashboard?ref=notification')).toEqual({
            view: 'burnout-dashboard',
        })
    })
    it('returns the two-segment path as view when segment is not people or schedule', () => {
        expect(normalizeNavigationValue('/training/module-1')).toEqual({
            view: 'training/module-1',
        })
    })
})
