import { describe, expect, it } from 'vitest'

import { PREVIEW_SEED_VERSION, createPreviewSeedData } from './preview-seed-data'

describe('preview-seed-data', () => {
    it('exposes the expected seed data version', () => {
        expect(PREVIEW_SEED_VERSION).toBe('preview-seed-v1')
    })

    it('creates deterministic preview data for a reference date', () => {
        const referenceDate = new Date('2026-03-16T12:00:00.000Z')
        const seed = createPreviewSeedData(referenceDate)

        expect(seed.targetTrainerCoverage).toBe(4)
        expect(seed.users.length).toBeGreaterThan(0)
        expect(seed.sessions.length).toBeGreaterThan(0)
        expect(seed.courses.length).toBeGreaterThan(0)
        expect(seed.scheduleTemplates.length).toBeGreaterThan(0)
        expect(seed.riskHistorySnapshots.length).toBeGreaterThan(0)

        const sessionStatusSet = new Set(seed.sessions.map(session => session.status))
        expect(sessionStatusSet).toEqual(new Set(['completed', 'in-progress', 'scheduled', 'cancelled']))

        const courseIds = new Set(seed.courses.map(course => course.id))
        for (const session of seed.sessions) {
            expect(courseIds.has(session.courseId)).toBe(true)
        }

        const userIds = new Set(seed.users.map(user => user.id))
        for (const enrollment of seed.enrollments) {
            expect(userIds.has(enrollment.userId)).toBe(true)
        }

        const nowMs = referenceDate.getTime()
        const inProgressSession = seed.sessions.find(session => session.id === 'session-2')
        expect(inProgressSession).toBeDefined()
        expect(new Date(inProgressSession!.startTime).getTime()).toBe(nowMs - 60 * 60 * 1000)
    })

    it('includes certification edge states and active recovery flows', () => {
        const seed = createPreviewSeedData(new Date('2026-03-16T12:00:00.000Z'))

        const trainerCertStatuses = seed.users
            .filter(user => user.role === 'trainer')
            .flatMap(user => user.trainerProfile?.certificationRecords ?? [])
            .map(record => record.status)

        expect(trainerCertStatuses).toEqual(expect.arrayContaining(['active', 'expiring-soon', 'expired']))

        expect(seed.recoveryPlans).toHaveLength(1)
        expect(seed.recoveryPlans[0]).toEqual(
            expect.objectContaining({
                status: 'active',
                actions: expect.arrayContaining([
                    expect.objectContaining({ completed: false }),
                    expect.objectContaining({ completed: true }),
                ]),
            })
        )
    })
})
