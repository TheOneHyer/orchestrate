import { describe, expect, it } from 'vitest'

import { PREVIEW_SEED_VERSION, createPreviewSeedData, getRiskLevelFromScore } from './preview-seed-data'

describe('preview-seed-data', () => {
    it('exposes the expected seed data version', () => {
        expect(PREVIEW_SEED_VERSION).toBe('preview-seed-v3')
    })

    it('creates deterministic preview data for a reference date', () => {
        const referenceDate = new Date('2026-03-16T12:00:00.000Z')
        const seed = createPreviewSeedData(referenceDate)

        expect(seed.targetTrainerCoverage).toBe(18)
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

        for (const enrollment of seed.enrollments) {
            const matchingSession = seed.sessions.find(
                (session) =>
                    session.id === enrollment.sessionId
                    && session.courseId === enrollment.courseId
                    && session.enrolledStudents.includes(enrollment.userId)
            )

            expect(matchingSession).toBeDefined()
        }

        for (const session of seed.sessions) {
            for (const userId of session.enrolledStudents) {
                expect(userIds.has(userId)).toBe(true)

                const matchingEnrollment = seed.enrollments.find(
                    (enrollment) =>
                        enrollment.sessionId === session.id
                        && enrollment.courseId === session.courseId
                        && enrollment.userId === userId
                )

                expect(matchingEnrollment).toBeDefined()
            }
        }

        const nowMs = referenceDate.getTime()
        const inProgressSession = seed.sessions.find(session => session.id === 'session-2')
        expect(inProgressSession).toBeDefined()
        expect(new Date(inProgressSession!.startTime).getTime()).toBe(nowMs - 60 * 60 * 1000)
    })

    it('includes certification edge states and complete recovery/wellness demo coverage', () => {
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
                expect.objectContaining({ status: 'completed' }),
                expect.objectContaining({ status: 'cancelled' }),
            ])
        )

        for (const plan of seed.recoveryPlans) {
            expect(plan.actions.some(action => action.completed)).toBe(true)
            expect(plan.checkIns.length).toBeGreaterThan(0)
        }

        expect(seed.recoveryPlans.some(plan => plan.actions.some(action => !action.completed))).toBe(true)

        const highRiskSnapshots = seed.riskHistorySnapshots.filter(snapshot => snapshot.riskLevel === 'high')
        const criticalRiskSnapshots = seed.riskHistorySnapshots.filter(snapshot => snapshot.riskLevel === 'critical')
        const mediumRiskSnapshots = seed.riskHistorySnapshots.filter(snapshot => snapshot.riskLevel === 'medium')
        const lowRiskSnapshots = seed.riskHistorySnapshots.filter(snapshot => snapshot.riskLevel === 'low')

        expect(highRiskSnapshots.length).toBeGreaterThan(0)
        expect(criticalRiskSnapshots.length).toBeGreaterThan(0)
        expect(mediumRiskSnapshots.length).toBeGreaterThan(0)
        expect(lowRiskSnapshots.length).toBeGreaterThan(0)

        const stressLevels = new Set(seed.wellnessCheckIns.map(checkIn => checkIn.stress))
        expect(stressLevels).toEqual(new Set(['low', 'moderate', 'high', 'critical']))

        const energyLevels = new Set(seed.wellnessCheckIns.map(checkIn => checkIn.energy))
        expect(energyLevels).toEqual(new Set(['exhausted', 'tired', 'neutral', 'energized', 'excellent']))

        expect(seed.wellnessCheckIns.some(checkIn => (checkIn.concerns?.length ?? 0) >= 2)).toBe(true)
        expect(seed.wellnessCheckIns.some(checkIn => checkIn.followUpRequired && !checkIn.followUpCompleted)).toBe(true)
        expect(seed.wellnessCheckIns.some(checkIn => checkIn.followUpRequired && checkIn.followUpCompleted)).toBe(true)

        const notificationTypes = new Set(seed.notifications.map(notification => notification.type))
        expect(notificationTypes).toEqual(new Set(['session', 'assignment', 'completion', 'reminder', 'system', 'workload']))
    })

    it('seeds mixed risk trend directions for burnout history', () => {
        const seed = createPreviewSeedData(new Date('2026-03-16T12:00:00.000Z'))
        const snapshotsByTrainer = seed.riskHistorySnapshots.reduce<Record<string, typeof seed.riskHistorySnapshots>>((accumulator, snapshot) => {
            if (!accumulator[snapshot.trainerId]) {
                accumulator[snapshot.trainerId] = []
            }

            accumulator[snapshot.trainerId].push(snapshot)
            return accumulator
        }, {})

        const trendDirections = Object.values(snapshotsByTrainer).map((snapshots) => {
            const orderedSnapshots = [...snapshots].sort(
                (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
            )

            expect(orderedSnapshots.length).toBeGreaterThanOrEqual(2)

            const earliestSnapshot = orderedSnapshots[0]
            const latestSnapshot = orderedSnapshots[orderedSnapshots.length - 1]
            return Math.sign(latestSnapshot.riskScore - earliestSnapshot.riskScore)
        })

        expect(trendDirections).toContain(-1)
        expect(trendDirections).toContain(0)
        expect(trendDirections).toContain(1)
    })

    it('maps risk-score cutoffs with exact boundary behavior', () => {
        const boundaryCases = [
            { score: 39, expected: 'low' as const },
            { score: 40, expected: 'medium' as const },
            { score: 64, expected: 'medium' as const },
            { score: 65, expected: 'high' as const },
            { score: 84, expected: 'high' as const },
            { score: 85, expected: 'critical' as const },
        ]

        for (const { score, expected } of boundaryCases) {
            expect(getRiskLevelFromScore(score)).toBe(expected)
        }
    })

    it('produces a deterministic, wrapping shift pattern across all sessions', () => {
        const seed = createPreviewSeedData(new Date('2026-03-16T12:00:00.000Z'))
        const shifts = seed.sessions.map(s => s.shift)

        // The shift array cycles through ['day', 'evening', 'night'] by index.
        // Verify the first cycle and that it wraps correctly at index 3.
        expect(shifts[0]).toBe('day')
        expect(shifts[1]).toBe('evening')
        expect(shifts[2]).toBe('night')
        expect(shifts[3]).toBe('day')   // wraps back to index 0
        expect(shifts[4]).toBe('evening')
    })
})
