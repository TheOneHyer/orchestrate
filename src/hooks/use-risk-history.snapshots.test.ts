import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKV } from '@github/spark/hooks'
import { createRiskSnapshot, shouldTakeSnapshot } from '@/lib/risk-history-tracker'
import type { RiskHistorySnapshot } from '@/lib/risk-history-tracker'
import type { Course, Session, User, WellnessCheckIn } from '@/lib/types'

vi.mock('@github/spark/hooks', () => ({
    useKV: vi.fn(),
}))

vi.mock('@/lib/risk-history-tracker', () => ({
    createRiskSnapshot: vi.fn(),
    shouldTakeSnapshot: vi.fn(),
}))

import { useRiskHistory } from './use-risk-history'

type UseKVReturn = ReturnType<typeof useKV>
const SNAPSHOT_EFFECT_DELAY_MS = 5000

function createUseKVReturn<T>(value: T, setter?: ReturnType<typeof vi.fn>): UseKVReturn {
    return [
        value as UseKVReturn[0],
        (setter ?? vi.fn()) as UseKVReturn[1],
        vi.fn() as UseKVReturn[2],
    ]
}

function makeTrainer(id: string): User {
    return {
        id,
        name: `Trainer ${id}`,
        email: `${id}@example.com`,
        role: 'trainer',
        department: 'Operations',
        certifications: [],
        hireDate: '2022-01-01T00:00:00.000Z',
    }
}

function makeSnapshot(id: string, trainerId: string, timestamp: string): RiskHistorySnapshot {
    return {
        id,
        trainerId,
        timestamp,
        riskScore: 50,
        riskLevel: 'medium',
        utilizationRate: 80,
        hoursScheduled: 32,
        sessionCount: 8,
        consecutiveDays: 5,
        factorCount: 2,
    }
}

describe('use-risk-history snapshot flows', () => {
    const sessions: Session[] = []
    const courses: Course[] = []
    const checkIns: WellnessCheckIn[] = []

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.mocked(useKV).mockImplementation((_key, defaultValue) => createUseKVReturn(defaultValue))
        vi.mocked(shouldTakeSnapshot).mockReturnValue(false)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns early when there are no users', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue(createUseKVReturn([], setter))

        const { result } = renderHook(() => useRiskHistory([], sessions, courses, checkIns))
        act(() => result.current.takeSnapshots())

        expect(setter).not.toHaveBeenCalled()
    })

    it('returns early when users exist but none are trainers', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue(createUseKVReturn([], setter))

        const users: User[] = [
            {
                id: 'employee-1',
                name: 'Employee One',
                email: 'employee1@example.com',
                role: 'employee',
                department: 'Operations',
                certifications: [],
                hireDate: '2022-01-01T00:00:00.000Z',
            },
        ]

        const { result } = renderHook(() => useRiskHistory(users, sessions, courses, checkIns))
        act(() => result.current.takeSnapshots())

        expect(setter).not.toHaveBeenCalled()
    })

    it('keeps existing history when no trainer requires a new snapshot', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue(createUseKVReturn([], setter))

        const users = [makeTrainer('trainer-1')]
        const current = [makeSnapshot('s-1', 'trainer-1', '2026-03-15T00:00:00.000Z')]

        const { result } = renderHook(() => useRiskHistory(users, sessions, courses, checkIns))
        act(() => result.current.takeSnapshots())

        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const updater = setter.mock.calls[0][0] as (prev: RiskHistorySnapshot[]) => RiskHistorySnapshot[]
        expect(updater(current)).toEqual(current)
        expect(createRiskSnapshot).not.toHaveBeenCalled()
    })

    it('adds snapshots only for trainers that pass shouldTakeSnapshot', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue(createUseKVReturn([], setter))

        const users = [makeTrainer('trainer-1'), makeTrainer('trainer-2')]

        vi.mocked(shouldTakeSnapshot).mockImplementation((trainerId) => trainerId === 'trainer-1')
        vi.mocked(createRiskSnapshot).mockImplementation((trainer) =>
            makeSnapshot(`new-${trainer.id}`, trainer.id, '2026-03-16T00:00:00.000Z')
        )

        const { result } = renderHook(() => useRiskHistory(users, sessions, courses, checkIns))
        act(() => result.current.takeSnapshots())

        const updater = setter.mock.calls[0][0] as (prev: RiskHistorySnapshot[]) => RiskHistorySnapshot[]
        const updated = updater([])

        expect(updated).toHaveLength(1)
        expect(updated[0].trainerId).toBe('trainer-1')
        expect(createRiskSnapshot).toHaveBeenCalledTimes(1)
    })

    it('keeps history capped at 1000 entries when snapshots are added', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue(createUseKVReturn([], setter))

        const users = [makeTrainer('trainer-1')]
        vi.mocked(shouldTakeSnapshot).mockReturnValue(true)
        vi.mocked(createRiskSnapshot).mockReturnValue(
            makeSnapshot('new-snapshot', 'trainer-1', '2026-03-16T00:00:00.000Z')
        )

        const existing = Array.from({ length: 1000 }, (_, idx) =>
            makeSnapshot(`existing-${idx}`, 'trainer-1', `2026-03-${String((idx % 28) + 1).padStart(2, '0')}T00:00:00.000Z`)
        )

        const { result } = renderHook(() => useRiskHistory(users, sessions, courses, checkIns))
        act(() => result.current.takeSnapshots())

        const updater = setter.mock.calls[0][0] as (prev: RiskHistorySnapshot[]) => RiskHistorySnapshot[]
        const updated = updater(existing)

        expect(updated).toHaveLength(1000)
        expect(updated.find((snapshot) => snapshot.id === 'existing-0')).toBeUndefined()
        expect(updated.find((snapshot) => snapshot.id === 'new-snapshot')).toBeDefined()
    })

    it('runs snapshot collection from the delayed effect timer', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue(createUseKVReturn([], setter))

        const users = [makeTrainer('trainer-1')]
        vi.mocked(shouldTakeSnapshot).mockReturnValue(true)
        const timerSnapshot = makeSnapshot('timer-snapshot', 'trainer-1', '2026-03-16T00:00:00.000Z')
        vi.mocked(createRiskSnapshot).mockReturnValue(timerSnapshot)

        renderHook(() => useRiskHistory(users, sessions, courses, checkIns))

        act(() => {
            // Matches the delayed initial snapshot timer in useRiskHistory.
            vi.advanceTimersByTime(SNAPSHOT_EFFECT_DELAY_MS)
        })

        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const updaterCall = setter.mock.calls.find((call) => typeof call[0] === 'function')
        if (!updaterCall) {
            throw new Error('Expected updater function to be passed to setRiskHistory')
        }

        const updater = updaterCall[0] as (prev: RiskHistorySnapshot[]) => RiskHistorySnapshot[]
        const existing = [makeSnapshot('existing-snapshot', 'trainer-1', '2026-03-15T00:00:00.000Z')]
        const updated = updater(existing)

        expect(shouldTakeSnapshot).toHaveBeenCalledWith('trainer-1', existing[0], 24)
        expect(createRiskSnapshot).toHaveBeenCalledWith(users[0], sessions, courses, checkIns)
        expect(updated).toEqual([...existing, timerSnapshot])
    })
})
