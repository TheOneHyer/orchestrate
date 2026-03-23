import { describe, expect, it } from 'vitest'

import { PREVIEW_SEED_VERSION, createPreviewSeedData } from './preview-seed-data'

describe('preview-seed-data', () => {
    it('exposes the expected seed data version', () => {
        expect(PREVIEW_SEED_VERSION).toBe('preview-seed-v2')
    })

    it('creates deterministic preview data for a reference date', () => {
        const referenceDate = new Date('2026-03-16T12:00:00.000Z')
        const seed = createPreviewSeedData(referenceDate)

        expect(seed.targetTrainerCoverage).toBe(24)
        expect(seed.users).toHaveLength(55)
        expect(seed.sessions).toHaveLength(48)
        expect(seed.courses).toHaveLength(24)
        expect(seed.enrollments).toHaveLength(30)
        expect(seed.notifications).toHaveLength(24)
        expect(seed.wellnessCheckIns).toHaveLength(24)
        expect(seed.checkInSchedules).toHaveLength(18)
        expect(seed.scheduleTemplates).toHaveLength(12)
        expect(seed.riskHistorySnapshots).toHaveLength(36)

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

        expect(seed.recoveryPlans).toHaveLength(6)
        expect(seed.recoveryPlans).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ status: 'active' }),
                expect.objectContaining({ status: 'in-progress' }),
            ])
        )

        for (const plan of seed.recoveryPlans) {
            expect(plan.actions).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ completed: false }),
                    expect.objectContaining({ completed: true }),
                ])
            )
            expect(plan.checkIns.length).toBeGreaterThan(0)
        }

        const highRiskSnapshots = seed.riskHistorySnapshots.filter(snapshot => snapshot.riskLevel === 'high')
        const criticalRiskSnapshots = seed.riskHistorySnapshots.filter(snapshot => snapshot.riskLevel === 'critical')

        expect(highRiskSnapshots.length).toBeGreaterThan(0)
        expect(criticalRiskSnapshots.length).toBeGreaterThan(0)
    })
})
