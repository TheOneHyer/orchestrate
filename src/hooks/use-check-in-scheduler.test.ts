import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKV } from '@github/spark/hooks'
import type { CheckInSchedule, User, WellnessCheckIn } from '@/lib/types'

vi.mock('@github/spark/hooks', () => ({
    useKV: vi.fn()
}))

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

function createCheckIn(overrides: Partial<WellnessCheckIn> = {}): WellnessCheckIn {
    return {
        id: 'check-1',
        trainerId: 'trainer-1',
        timestamp: '2026-03-15T00:00:00.000Z',
        mood: 3,
        stress: 'moderate',
        energy: 'neutral',
        workloadSatisfaction: 3,
        sleepQuality: 3,
        physicalWellbeing: 3,
        mentalClarity: 3,
        followUpRequired: false,
        ...overrides,
    }
}

function getUpdaterFn<T>(setter: ReturnType<typeof vi.fn>): (prev: T) => T {
    const updaterCall = [...vi.mocked(setter).mock.calls].reverse().find((call) => typeof call[0] === 'function')
    if (!updaterCall) {
        throw new Error('Expected setter to be called with an updater function')
    }

    return updaterCall[0] as (prev: T) => T
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
        const updaterFn = getUpdaterFn<CheckInSchedule[]>(setter)
        const updated = updaterFn([schedule])
        expect(updated[0].missedCheckIns).toBe(1)
        expect(schedule.missedCheckIns).toBe(0)
    })

    it('increments only the overdue schedule when updater runs against mixed schedules', () => {
        const overdueSchedule = createSchedule({
            id: 'schedule-overdue',
            trainerId: 'trainer-overdue',
            nextScheduledDate: new Date(NOW.getTime() - 26 * 60 * 60 * 1000).toISOString(),
            missedCheckIns: 0,
        })
        const activeSchedule = createSchedule({
            id: 'schedule-active',
            trainerId: 'trainer-active',
            nextScheduledDate: new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            missedCheckIns: 0,
        })

        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([[overdueSchedule, activeSchedule], setter] as any)

        renderHook(() =>
            useCheckInScheduler([createTrainer('trainer-overdue'), createTrainer('trainer-active')], [], undefined)
        )

        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const updaterFn = getUpdaterFn<CheckInSchedule[]>(setter)
        const updated = updaterFn([overdueSchedule, activeSchedule])

        const updatedOverdue = updated.find((schedule) => schedule.id === 'schedule-overdue')
        const updatedActive = updated.find((schedule) => schedule.id === 'schedule-active')

        expect(updatedOverdue?.missedCheckIns).toBe(1)
        expect(updatedActive?.missedCheckIns).toBe(0)
    })

    it('marks schedule completed when computed next date exceeds endDate', () => {
        const schedule = createSchedule({
            id: 'schedule-complete',
            frequency: 'weekly',
            endDate: '2026-03-05T00:00:00.000Z',
            lastCheckInDate: '2026-03-04T00:00:00.000Z',
        })

        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([[schedule], setter] as any)

        const { result } = renderHook(() =>
            useCheckInScheduler([createTrainer('trainer-1')], [], undefined)
        )

        result.current.updateScheduleNextDate('schedule-complete', '2026-03-04T00:00:00.000Z')

        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const updaterFn = getUpdaterFn<CheckInSchedule[]>(setter)
        const updated = updaterFn([schedule])

        expect(updated[0].status).toBe('completed')
        expect(updated[0].nextScheduledDate).toBe('2026-03-05T00:00:00.000Z')
        expect(updated[0].completedCheckIns).toBe(1)
    })

    it('falls back to weekly cadence for unknown frequency values', () => {
        const schedule = createSchedule({
            id: 'schedule-unknown',
            frequency: 'unknown' as CheckInSchedule['frequency'],
            lastCheckInDate: '2026-03-01T00:00:00.000Z',
        })

        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([[schedule], setter] as any)

        const { result } = renderHook(() =>
            useCheckInScheduler([createTrainer('trainer-1')], [], undefined)
        )

        result.current.updateScheduleNextDate('schedule-unknown', '2026-03-01T00:00:00.000Z')

        const updaterFn = getUpdaterFn<CheckInSchedule[]>(setter)
        const updated = updaterFn([schedule])
        expect(updated[0].nextScheduledDate).toBe('2026-03-08T00:00:00.000Z')
    })

    it('ignores inactive schedules', () => {
        const inactiveSchedule = createSchedule({
            id: 'inactive',
            status: 'paused',
            nextScheduledDate: new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        })
        const setter = vi.fn()
        const onTriggerCheckIn = vi.fn()
        vi.mocked(useKV).mockReturnValue([[inactiveSchedule], setter] as any)

        renderHook(() =>
            useCheckInScheduler([createTrainer('trainer-1')], [], onTriggerCheckIn)
        )

        expect(onTriggerCheckIn).not.toHaveBeenCalled()
        expect(toast.info).not.toHaveBeenCalled()
        expect(setter).not.toHaveBeenCalled()
    })

    it('ignores schedules with missing trainers', () => {
        const missingTrainerSchedule = createSchedule({
            id: 'missing-trainer',
            trainerId: 'trainer-missing',
            nextScheduledDate: new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        })

        const setter = vi.fn()
        const onTriggerCheckIn = vi.fn()
        vi.mocked(useKV).mockReturnValue([[missingTrainerSchedule], setter] as any)

        renderHook(() =>
            useCheckInScheduler([createTrainer('trainer-1')], [], onTriggerCheckIn)
        )

        expect(onTriggerCheckIn).not.toHaveBeenCalled()
        expect(toast.info).not.toHaveBeenCalled()
        expect(setter).not.toHaveBeenCalled()
    })

    it('updates matching active schedule when a newer check-in is observed', () => {
        const schedule = createSchedule({
            id: 'sync-schedule',
            trainerId: 'trainer-1',
            nextScheduledDate: new Date(NOW.getTime() + 48 * 60 * 60 * 1000).toISOString(),
            notificationEnabled: false,
            autoReminders: false,
            reminderHoursBefore: 1,
            lastCheckInDate: '2026-03-10T00:00:00.000Z',
        })

        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([[schedule], setter] as any)

        renderHook(() =>
            useCheckInScheduler(
                [createTrainer('trainer-1')],
                [
                    createCheckIn(),
                ],
                undefined
            )
        )

        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const updaterFn = getUpdaterFn<CheckInSchedule[]>(setter)
        const updated = updaterFn([schedule])

        expect(updated[0].lastCheckInDate).toBe('2026-03-15T00:00:00.000Z')
        expect(updated[0].completedCheckIns).toBe(1)
    })

    it('does not update schedule when latest check-in timestamp matches the recorded date', () => {
        const schedule = createSchedule({
            id: 'no-sync',
            trainerId: 'trainer-1',
            nextScheduledDate: new Date(NOW.getTime() + 48 * 60 * 60 * 1000).toISOString(),
            notificationEnabled: false,
            autoReminders: false,
            reminderHoursBefore: 1,
            lastCheckInDate: '2026-03-15T00:00:00.000Z',
        })

        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([[schedule], setter] as any)

        renderHook(() =>
            useCheckInScheduler(
                [createTrainer('trainer-1')],
                [
                    createCheckIn(),
                ],
                undefined
            )
        )

        expect(setter).not.toHaveBeenCalled()
    })

    it.each([
        ['daily', 'daily', undefined, '2026-03-11T00:00:00.000Z'],
        ['biweekly', 'biweekly', undefined, '2026-03-24T00:00:00.000Z'],
        ['monthly', 'monthly', undefined, '2026-04-10T00:00:00.000Z'],
        ['custom-3', 'custom', 3, '2026-03-13T00:00:00.000Z'],
        ['custom-default', 'custom', undefined, '2026-03-17T00:00:00.000Z'],
    ] as const)(
        'computes next date for $1 frequency (schedule id: $0)',
        (scheduleId, frequency, customDays, expectedDate) => {
            const baseDate = '2026-03-10T00:00:00.000Z'
            const schedule = createSchedule({
                id: scheduleId,
                frequency: frequency as 'daily' | 'biweekly' | 'monthly' | 'custom',
                customDays,
                lastCheckInDate: baseDate,
            })

            const schedules = [schedule]
            const setter = vi.fn()
            vi.mocked(useKV).mockReturnValue([schedules, setter] as any)

            const { result } = renderHook(() => useCheckInScheduler([createTrainer('trainer-1')], [], undefined))

            result.current.updateScheduleNextDate(scheduleId, baseDate)

            const updaterCalls = vi.mocked(setter).mock.calls
                .map((call) => call[0])
                .filter((arg): arg is (prev: CheckInSchedule[]) => CheckInSchedule[] => typeof arg === 'function')

            const updated = updaterCalls[0](schedules).find((s) => s.id === scheduleId)

            expect(updated?.nextScheduledDate).toBe(expectedDate)
        }
    )

    it('keeps schedules unchanged when updateScheduleNextDate is called with an unknown schedule id', () => {
        const schedule = createSchedule({ id: 'existing', completedCheckIns: 2 })
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([[schedule], setter] as any)

        const { result } = renderHook(() => useCheckInScheduler([createTrainer('trainer-1')], [], undefined))

        result.current.updateScheduleNextDate('missing-id', '2026-03-15T00:00:00.000Z')

        const updaterFn = getUpdaterFn<CheckInSchedule[]>(setter)
        const updated = updaterFn([schedule])
        expect(updated[0]).toEqual(schedule)
    })

    it('re-checks due schedules on the 30-minute interval', () => {
        const dueTime = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString()
        const schedule = createSchedule({ id: 'interval-schedule', nextScheduledDate: dueTime })
        vi.mocked(useKV).mockReturnValue([[schedule], vi.fn()] as any)

        const onTriggerCheckIn = vi.fn()
        renderHook(() => useCheckInScheduler([createTrainer('trainer-1')], [], onTriggerCheckIn))

        // Runs once on mount.
        expect(onTriggerCheckIn).toHaveBeenCalledTimes(1)

        // Runs again when the polling interval fires.
        act(() => {
            vi.advanceTimersByTime(30 * 60 * 1000)
        })
        expect(onTriggerCheckIn).toHaveBeenCalledTimes(2)
    })
})
