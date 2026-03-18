import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKV } from '@github/spark/hooks'
import { calculateRiskLevel } from '@/lib/risk-history-tracker'
import type { RiskHistorySnapshot } from '@/lib/risk-history-tracker'
import type { Course, Session, User, WellnessCheckIn } from '@/lib/types'

type MockKVTuple<T> = readonly [T, (newValue: T | ((current: T) => T)) => void, () => void]

function createKVMockTuple<T>(defaultValue: T): MockKVTuple<T> {
    return [
        defaultValue,
        vi.fn() as (newValue: T | ((current: T) => T)) => void,
        vi.fn()
    ]
}

function mockKVWithSnapshots(snapshots: RiskHistorySnapshot[]) {
    vi.mocked(useKV).mockReturnValue(createKVMockTuple(snapshots) as unknown as ReturnType<typeof useKV>)
}

vi.mock('@github/spark/hooks', async () => {
    return {
        useKV: vi.fn(<T,>(_key: string, defaultValue: T) => createKVMockTuple(defaultValue))
    }
})

import { useRiskHistory } from './use-risk-history'

function createSnapshot(id: string, trainerId: string, riskScore: number, timestamp: string): RiskHistorySnapshot {
    return {
        id,
        trainerId,
        timestamp,
        riskScore,
        riskLevel: calculateRiskLevel(riskScore),
        utilizationRate: riskScore,
        hoursScheduled: 32,
        sessionCount: 8,
        consecutiveDays: 5,
        factorCount: 2
    }
}

const SNAPSHOTS: RiskHistorySnapshot[] = [
    createSnapshot('s-1', 'trainer-a', 30, '2026-03-01T00:00:00.000Z'),
    createSnapshot('s-2', 'trainer-a', 55, '2026-03-10T00:00:00.000Z'),
    createSnapshot('s-3', 'trainer-a', 80, '2026-03-15T00:00:00.000Z'),
    createSnapshot('s-4', 'trainer-b', 20, '2026-03-14T00:00:00.000Z'),
]

describe('use-risk-history (unit)', () => {
    const emptyUsers: User[] = []
    const emptySessions: Session[] = []
    const emptyCourses: Course[] = []
    const emptyWellnessCheckIns: WellnessCheckIn[] = []

    beforeEach(() => {
        vi.mocked(useKV).mockImplementation(<T,>(_key: string, defaultValue: T) => createKVMockTuple(defaultValue))
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('getTrainerHistory returns empty array when no snapshots exist', () => {
        const { result } = renderHook(() =>
            useRiskHistory(emptyUsers, emptySessions, emptyCourses, emptyWellnessCheckIns)
        )
        expect(result.current.getTrainerHistory('trainer-a')).toEqual([])
    })

    it('getTrainerHistory filters to a single trainer sorted oldest-first', () => {
        mockKVWithSnapshots(SNAPSHOTS)

        const { result } = renderHook(() =>
            useRiskHistory(emptyUsers, emptySessions, emptyCourses, emptyWellnessCheckIns)
        )

        const history = result.current.getTrainerHistory('trainer-a')
        expect(history).toHaveLength(3)
        expect(history[0].id).toBe('s-1')
        expect(history[2].id).toBe('s-3')
    })

    it('getTrainerHistory returns the N most recent entries sorted oldest-first', () => {
        mockKVWithSnapshots(SNAPSHOTS)
        const { result } = renderHook(() => useRiskHistory(emptyUsers, emptySessions, emptyCourses, emptyWellnessCheckIns))

        const limited = result.current.getTrainerHistory('trainer-a', 2)
        expect(limited).toHaveLength(2)
        expect(limited[0].id).toBe('s-2')
        expect(limited[1].id).toBe('s-3')
    })

    it('getTrainerHistory returns empty for a non-existent trainer when snapshots exist', () => {
        mockKVWithSnapshots(SNAPSHOTS)
        const { result } = renderHook(() => useRiskHistory(emptyUsers, emptySessions, emptyCourses, emptyWellnessCheckIns))

        expect(result.current.getTrainerHistory('trainer-nonexistent')).toEqual([])
    })

    it('getTrainerHistory with limit=0 returns an empty array', () => {
        mockKVWithSnapshots(SNAPSHOTS)
        const { result } = renderHook(() => useRiskHistory(emptyUsers, emptySessions, emptyCourses, emptyWellnessCheckIns))

        const limited = result.current.getTrainerHistory('trainer-a', 0)
        expect(limited).toEqual([])
    })

    it('getTrainerHistory with a negative limit behaves like limit=0', () => {
        mockKVWithSnapshots(SNAPSHOTS)
        const { result } = renderHook(() => useRiskHistory(emptyUsers, emptySessions, emptyCourses, emptyWellnessCheckIns))

        const limited = result.current.getTrainerHistory('trainer-a', -1)
        expect(limited).toEqual([])
    })

    it('getTrainerHistory with a large limit returns all available entries', () => {
        mockKVWithSnapshots(SNAPSHOTS)
        const { result } = renderHook(() => useRiskHistory(emptyUsers, emptySessions, emptyCourses, emptyWellnessCheckIns))

        const limited = result.current.getTrainerHistory('trainer-a', 100)
        expect(limited).toHaveLength(3)
        expect(limited[0].id).toBe('s-1')
        expect(limited[2].id).toBe('s-3')
    })

    it('clearHistory calls the setter with an empty array', () => {
        const setter = vi.fn() as unknown as (newValue: RiskHistorySnapshot[] | ((current: RiskHistorySnapshot[]) => RiskHistorySnapshot[])) => void
        vi.mocked(useKV).mockReturnValue([SNAPSHOTS, setter, vi.fn()] as unknown as ReturnType<typeof useKV>)

        const { result } = renderHook(() => useRiskHistory(emptyUsers, emptySessions, emptyCourses, emptyWellnessCheckIns))
        act(() => result.current.clearHistory())

        expect(setter).toHaveBeenCalledWith([])
    })

    it('returns fallback empty history structures when persisted history is undefined', () => {
        vi.mocked(useKV).mockReturnValue([undefined, vi.fn(), vi.fn()] as unknown as ReturnType<typeof useKV>)

        const { result } = renderHook(() => useRiskHistory(emptyUsers, emptySessions, emptyCourses, emptyWellnessCheckIns))

        expect(result.current.riskHistory).toEqual([])
        expect(result.current.getTrainerHistory('trainer-a')).toEqual([])
    })

    it('treats undefined current history as an empty array when taking snapshots', () => {
        const setter = vi.fn() as unknown as (newValue: RiskHistorySnapshot[] | ((current: RiskHistorySnapshot[]) => RiskHistorySnapshot[])) => void
        vi.mocked(useKV).mockReturnValue([undefined, setter, vi.fn()] as unknown as ReturnType<typeof useKV>)

        const trainer: User = {
            id: 'trainer-1',
            name: 'Trainer One',
            email: 'trainer1@example.com',
            role: 'trainer',
            department: 'Ops',
            certifications: [],
            hireDate: '2024-01-01T00:00:00.000Z',
        }

        const { result } = renderHook(() => useRiskHistory([trainer], emptySessions, emptyCourses, emptyWellnessCheckIns))

        act(() => result.current.takeSnapshots())

        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const updater = setter.mock.calls[0][0] as (current: RiskHistorySnapshot[] | undefined) => RiskHistorySnapshot[]
        const updated = updater(undefined)

        expect(updated).toHaveLength(1)
        expect(updated[0].trainerId).toBe('trainer-1')
    })
})
