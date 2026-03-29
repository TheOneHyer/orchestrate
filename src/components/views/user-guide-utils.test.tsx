import { BookOpen } from '@phosphor-icons/react'

import { getSectionOrFallback, type Section } from './user-guide-utils'

describe('getSectionOrFallback', () => {
    const sections: Section[] = [
        {
            id: 'overview',
            label: 'Overview',
            icon: BookOpen,
            roles: ['admin'],
            content: <p>Overview content</p>,
        },
        {
            id: 'notifications',
            label: 'Notifications',
            icon: BookOpen,
            roles: ['admin', 'trainer'],
            content: <p>Notification content</p>,
        },
    ]

    it('returns the matching section when key exists', () => {
        const result = getSectionOrFallback(sections, 'notifications')

        expect(result.id).toBe('notifications')
        expect(result.label).toBe('Notifications')
    })

    it('returns the first section when key is missing or undefined', () => {
        expect(getSectionOrFallback(sections).id).toBe('overview')
        expect(getSectionOrFallback(sections, 'unknown').id).toBe('overview')
    })

    it('returns a safe placeholder section when no sections are available', () => {
        const fallback = getSectionOrFallback([], 'overview')

        expect(fallback.id).toBe('')
        expect(fallback.label).toBe('No Sections Available')
        expect(fallback.icon).toBe(BookOpen)
        expect(fallback.roles).toEqual([])
        // Content should match the stable placeholder string returned by the fallback.
        expect(fallback.content).toBe('No guide sections are available for your role.')
    })
})
