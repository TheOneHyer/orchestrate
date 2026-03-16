import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKV } from '@github/spark/hooks'
import type { CheckInSchedule, User } from '@/lib/types'

vi.mock('@github/spark/hooks', async () => {
    const { useState } = await import('react')
    return {
        useKV: vi.fn((_key: string, defaultValue: unknown) => useState(defaultValue))
    }
})

vi.mock('sonner', () => ({
    toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() }
}))

import { toast } from 'sonner'
import { useCheckInScheduler } from './use-check-in-scheduler'

const NOW = new Date('2026-03-16T10:00:00.000Z')

function createTrainer(id: string, name = `Trainer ${id}`): User {
    return {
        id,
        name,
        email: `${id}@example.com`,
        role: 'trainer',
        department: 'Operations',
        certifications: [],
        hireDate: '2020-01-01T00:00:00.000Z'
    }
}

function createSchedule(overrides: Partial<CheckInSchedule> = {}): CheckInSchedule {
    return {
        id: 'schedule-1',
        trainerId: 'trainer-1',
        frequency: 'weekly',
        startDate: '2026-03-01T00:00:00.000Z',
        nextScheduledDate: NOW.toISOString(),
        status: 'active',
        notificationEnabled: true,
        autoReminders: true,
        reminderHoursBefore: 4,
        createdBy: 'admin',
        createdAt: '2026-03-01T00:00:00.000Z',
        completedCheckIns: 0,
        missedCheckIns: 0,
        ...overrides
    }
}

describe('use-check-in-scheduler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useKV).mockImplementation((_key, defaultValue) => [defaultValue as any, vi.fn()] as any)
        vi.useFakeTimers()
        vi.setSystemTime(NOW)
        localStorage.clear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('triggers onTriggerCheckIn when a schedule is due (hoursDiff between -24 and 0)', () => {
        const dueTime = new Date(NOW.getTime() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
        const schedule = createSchedule({ nextScheduledDate: dueTime })
        vi.mocked(useKV).mockReturnValue([[schedule], vi.fn()] as any)

        const onTriggerCheckIn = vi.fn()
        renderHook(() =>
            useCheckInScheduler([createTrainer('trainer-1')], [], onTriggerCheckIn)
        )

        expect(onTriggerCheckIn).toHaveBeenCalledWith('trainer-1', 'Trainer trainer-1')
        expect(toast.info).not.toHaveBeenCalled()
        const setter = vi.mocked(useKV).mock.results[0]?.value?.[1]
        expect(setter).toBeDefined()
        expect(setter).not.toHaveBeenCalled()
    })

    it('shows a toast reminder when check-in is approaching within reminderHoursBefore window', () => {
        const upcomingTime = new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString() // 2 hours from now
        const schedule = createSchedule({ nextScheduledDate: upcomingTime, reminderHoursBefore: 4 })
        vi.mocked(useKV).mockReturnValue([[schedule], vi.fn()] as any)

        renderHook(() =>
            useCheckInScheduler([createTrainer('trainer-1')], [], undefined)
        )

        expect(toast.info).toHaveBeenCalledWith(
            'Wellness Check-In Reminder',
            expect.objectContaining({ description: expect.stringContaining('Trainer trainer-1') })
        )
        expect(localStorage.getItem(`reminder-schedule-1-${upcomingTime}`)).toBe('true')
    })

    it('does not fire a duplicate reminder if localStorage entry already exists', () => {
        const upcomingTime = new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString()
        const schedule = createSchedule({ nextScheduledDate: upcomingTime, reminderHoursBefore: 4 })
        vi.mocked(useKV).mockReturnValue([[schedule], vi.fn()] as any)
        localStorage.setItem(`reminder-schedule-1-${upcomingTime}`, 'true')

        renderHook(() => useCheckInScheduler([createTrainer('trainer-1')], [], undefined))

        expect(toast.info).not.toHaveBeenCalled()
    })

    it('increments missedCheckIns via setter when schedule is more than 24h overdue', () => {
        const overdueTime = new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString()
        const schedule = createSchedule({ nextScheduledDate: overdueTime })
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([[schedule], setter] as any)

        renderHook(() =>
            useCheckInScheduler([createTrainer('trainer-1')], [], undefined)
        )

        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const updaterFn = vi.mocked(setter).mock.calls[0][0] as (prev: CheckInSchedule[]) => CheckInSchedule[]
        const updated = updaterFn([schedule])
        expect(updated[0].missedCheckIns).toBe(1)
    })
})
