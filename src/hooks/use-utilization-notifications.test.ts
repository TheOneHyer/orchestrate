import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Notification, Session, User } from '@/lib/types'

import { useUtilizationNotifications } from './use-utilization-notifications'

const NOW = new Date('2026-03-16T10:00:00.000Z') // a Monday

function createTrainer(id: string): User {
    return {
        id,
        name: `Trainer ${id}`,
        email: `${id}@example.com`,
        role: 'trainer',
        department: 'Operations',
        certifications: ['Safety'],
        hireDate: '2020-01-01T00:00:00.000Z',
        trainerProfile: {
            authorizedRoles: ['trainer'],
            shiftSchedules: [{
                shiftCode: 'DAY',
                daysWorked: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                startTime: '08:00',
                endTime: '17:00',
                totalHoursPerWeek: 40
            }],
            tenure: { hireDate: '2020-01-01T00:00:00.000Z', yearsOfService: 6, monthsOfService: 72 },
            specializations: []
        }
    }
}

// Build sessions to hit a target weekly utilization for a trainer
// utilization = totalHours / 40 * 100
// Sessions MUST fall within the current week: 2026-03-16 (Mon) – 2026-03-22 (Sun)
function buildSessions(trainerId: string, hoursPerSession: number, count: number): Session[] {
    if (count < 0 || count > 14) {
        throw new Error('buildSessions supports between 0 and 14 sessions to avoid duplicate day/slot collisions')
    }
    if (hoursPerSession <= 0 || hoursPerSession > 10) {
        throw new Error('buildSessions requires hoursPerSession > 0 and <= 10')
    }

    return Array.from({ length: count }, (_, i) => {
        // Distribute across the 7 days of the week; use afternoon slot for overflow
        const dayOffset = i % 7
        const isAfternoon = i >= 7
        const day = 16 + dayOffset          // March 16–22
        const morningEndHour = 8 + hoursPerSession
        const startHour = isAfternoon ? Math.max(13, morningEndHour) : 8
        const startDate = new Date(Date.UTC(2026, 2, day, startHour, 0, 0))
        const endDate = new Date(startDate.getTime() + hoursPerSession * 60 * 60 * 1000)
        return {
            id: `session-${trainerId}-${i}`,
            courseId: 'course-1',
            trainerId,
            title: `Session ${i}`,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            location: 'Room A',
            capacity: 10,
            enrolledStudents: [],
            status: 'scheduled' as const
        }
    })
}

describe('use-utilization-notifications', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(NOW)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('fires high-priority notifications on first render when trainer exceeds 85% utilization', () => {
        const trainer = createTrainer('trainer-1')
        // 9 sessions × 4h = 36h → 90% utilization (above OVERUTILIZED_THRESHOLD = 85)
        const sessions = buildSessions(trainer.id, 4, 9)
        const onCreateNotification = vi.fn()

        renderHook(() => useUtilizationNotifications([trainer], sessions, onCreateNotification))

        expect(onCreateNotification).toHaveBeenCalledTimes(2)
        const calls = vi.mocked(onCreateNotification).mock.calls.map(c => c[0] as Omit<Notification, 'id' | 'createdAt'>)
        expect(calls.some(n => n.userId === trainer.id && n.priority === 'high')).toBe(true)
        expect(calls.some(n => n.userId === 'admin' && n.priority === 'high')).toBe(true)
    })

    it('fires critical notifications when trainer exceeds 95% utilization', () => {
        const trainer = createTrainer('trainer-2')
        // 10 sessions × 4h = 40h → 100% utilization (above CRITICALLY_OVERUTILIZED_THRESHOLD = 95)
        const sessions = buildSessions(trainer.id, 4, 10)
        const onCreateNotification = vi.fn()

        renderHook(() => useUtilizationNotifications([trainer], sessions, onCreateNotification))

        expect(onCreateNotification).toHaveBeenCalledTimes(2)
        const calls = vi.mocked(onCreateNotification).mock.calls.map(c => c[0] as Omit<Notification, 'id' | 'createdAt'>)
        expect(calls.some(n => n.userId === trainer.id && n.priority === 'critical')).toBe(true)
        expect(calls.some(n => n.userId === 'admin' && n.priority === 'critical')).toBe(true)
    })

    it('fires a "workload normalized" notification when utilization drops from over-threshold', () => {
        const trainer = createTrainer('trainer-3')
        const overloadedSessions = buildSessions(trainer.id, 4, 9) // 90%
        const normalSessions = buildSessions(trainer.id, 2, 4) // 20%
        const onCreateNotification = vi.fn()

        const { rerender } = renderHook(
            ({ sessions }: { sessions: Session[] }) =>
                useUtilizationNotifications([trainer], sessions, onCreateNotification),
            { initialProps: { sessions: overloadedSessions } }
        )

        vi.mocked(onCreateNotification).mockClear()
        rerender({ sessions: normalSessions })

        const calls = vi.mocked(onCreateNotification).mock.calls.map(c => c[0] as Omit<Notification, 'id' | 'createdAt'>)
        expect(calls.length).toBe(2)

        const trainerNormalizedCalls = calls.filter(n => n.title === 'Workload Normalized')
        expect(trainerNormalizedCalls).toHaveLength(1)
        expect(trainerNormalizedCalls[0].userId).toBe(trainer.id)
        expect(trainerNormalizedCalls[0].priority).toBe('low')

        const adminNormalizedCalls = calls.filter(n => n.title === `Workload Balanced: ${trainer.name}`)
        expect(adminNormalizedCalls).toHaveLength(1)
        expect(adminNormalizedCalls[0].userId).toBe('admin')
        expect(adminNormalizedCalls[0].priority).toBe('low')
    })

    it('does not fire notifications when there are no users or sessions', () => {
        const onCreateNotification = vi.fn()
        renderHook(() => useUtilizationNotifications([], [], onCreateNotification))
        expect(onCreateNotification).not.toHaveBeenCalled()
    })
})
