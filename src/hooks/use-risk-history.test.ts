import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKV } from '@github/spark/hooks'
import type { RiskHistorySnapshot } from '@/lib/risk-history-tracker'

type MockKVTuple<T> = readonly [T, (newValue: T | ((current: T) => T)) => void, () => void]

function createKVMockTuple<T>(defaultValue: T): MockKVTuple<T> {
    return [
        defaultValue,
        vi.fn() as (newValue: T | ((current: T) => T)) => void,
        vi.fn()
    ]
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
        riskLevel: riskScore >= 70 ? 'critical' : riskScore >= 45 ? 'high' : 'low',
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
    beforeEach(() => {
        vi.mocked(useKV).mockImplementation(<T,>(_key: string, defaultValue: T) => createKVMockTuple(defaultValue))
    })

    it('getTrainerHistory returns empty array when no snapshots exist', () => {
        const { result } = renderHook(() =>
            useRiskHistory([], [], [], [])
        )
        expect(result.current.getTrainerHistory('trainer-a')).toEqual([])
    })

    it('getTrainerHistory filters to a single trainer sorted oldest-first', () => {
        vi.mocked(useKV).mockReturnValue(createKVMockTuple(SNAPSHOTS) as unknown as ReturnType<typeof useKV>)

        const { result } = renderHook(() =>
            useRiskHistory([], [], [], [])
        )

        const history = result.current.getTrainerHistory('trainer-a')
        expect(history).toHaveLength(3)
        expect(history[0].id).toBe('s-1')
        expect(history[2].id).toBe('s-3')
    })

    it('getTrainerHistory with limit returns N most recent entries', () => {
        vi.mocked(useKV).mockReturnValue(createKVMockTuple(SNAPSHOTS) as unknown as ReturnType<typeof useKV>)
        const { result } = renderHook(() => useRiskHistory([], [], [], []))

        const limited = result.current.getTrainerHistory('trainer-a', 2)
        expect(limited).toHaveLength(2)
        expect(limited[0].id).toBe('s-2')
        expect(limited[1].id).toBe('s-3')
    })

    it('clearHistory calls the setter with an empty array', () => {
        const setter = vi.fn() as unknown as (newValue: RiskHistorySnapshot[] | ((current: RiskHistorySnapshot[]) => RiskHistorySnapshot[])) => void
        vi.mocked(useKV).mockReturnValue([SNAPSHOTS, setter, vi.fn()] as unknown as ReturnType<typeof useKV>)

        const { result } = renderHook(() => useRiskHistory([], [], [], []))
        act(() => result.current.clearHistory())

        expect(setter).toHaveBeenCalledWith([])
    })
})
