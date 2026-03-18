import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./burnout-analytics', () => ({
    calculateTrainerUtilization: vi.fn(),
}))

import { calculateTrainerUtilization } from './burnout-analytics'
import {
    aggregateSnapshotsByDay,
    analyzeRiskTrend,
    createRiskSnapshot,
    generateRiskReport,
    shouldTakeSnapshot,
    type RiskHistorySnapshot,
} from './risk-history-tracker'
import type { Course, Session, User, WellnessCheckIn } from './types'

const SYSTEM_TIME = new Date('2026-03-16T12:00:00.000Z')

function createTrainer(overrides: Partial<User> = {}): User {
    return {
        id: 'trainer-1',
        name: 'Riley Risk',
        email: 'riley@example.com',
        role: 'trainer',
        department: 'Operations',
        certifications: ['Safety'],
        hireDate: '2020-01-01T00:00:00.000Z',
        ...overrides,
    }
}

function createSnapshot(overrides: Partial<RiskHistorySnapshot> = {}): RiskHistorySnapshot {
    return {
        id: 'snapshot-1',
        trainerId: 'trainer-1',
        timestamp: '2026-03-10T12:00:00.000Z',
        riskScore: 50,
        riskLevel: 'medium',
        utilizationRate: 84,
        hoursScheduled: 38,
        sessionCount: 10,
        consecutiveDays: 5,
        factorCount: 2,
        ...overrides,
    }
}

describe('risk-history-tracker', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(SYSTEM_TIME)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('creates a snapshot from utilization analytics', () => {
        vi.mocked(calculateTrainerUtilization).mockReturnValue({
            trainerId: 'trainer-1',
            utilizationRate: 91,
            hoursScheduled: 52,
            sessionCount: 13,
            consecutiveDays: 8,
            riskScore: 77,
            riskLevel: 'high',
            factors: [
                { factor: 'High Utilization', description: 'At 91% capacity', impact: 'high' },
                { factor: 'Extended Streak', description: 'No full day off', impact: 'medium' },
            ],
            recommendations: ['Reduce load by 10%'],
        })

        const trainer = createTrainer()
        const sessions = [] as Session[]
        const courses = [] as Course[]
        const wellnessCheckIns = [] as WellnessCheckIn[]
        const snapshot = createRiskSnapshot(trainer, sessions, courses, wellnessCheckIns)

        expect(calculateTrainerUtilization).toHaveBeenCalledWith(trainer, sessions, courses, 'month', wellnessCheckIns)

        expect(snapshot.id).toBe(`snapshot-${trainer.id}-${SYSTEM_TIME.getTime()}`)
        expect(snapshot.timestamp).toBe(SYSTEM_TIME.toISOString())
        expect(snapshot).toMatchObject({
            trainerId: 'trainer-1',
            riskScore: 77,
            riskLevel: 'high',
            utilizationRate: 91,
            hoursScheduled: 52,
            sessionCount: 13,
            consecutiveDays: 8,
            factorCount: 2,
        })
    })

    it('returns null when no snapshots are in the selected time range', () => {
        const trend = analyzeRiskTrend(createTrainer(), [
            createSnapshot({ timestamp: '2025-01-01T00:00:00.000Z' }),
        ], 'month')

        expect(trend).toBeNull()
    })

    it('applies week cutoff by excluding snapshots older than 7 days', () => {
        const trainer = createTrainer()
        const trend = analyzeRiskTrend(trainer, [
            createSnapshot({ id: 'old-week', timestamp: '2026-03-08T12:00:00.000Z', riskScore: 20, riskLevel: 'low' }),
            createSnapshot({ id: 'in-week', timestamp: '2026-03-15T12:00:00.000Z', riskScore: 55, riskLevel: 'high' }),
        ], 'week')

        expect(trend).not.toBeNull()
        expect(trend?.historicalData.map((snapshot) => snapshot.id)).toEqual(['in-week'])
        expect(trend?.currentRisk.id).toBe('in-week')
    })

    it('uses the quarter range cutoff for snapshots between 30 and 90 days old', () => {
        const trainer = createTrainer()
        const snapshots = [
            createSnapshot({ id: 'sixty-days', timestamp: '2026-01-20T12:00:00.000Z', riskScore: 42, riskLevel: 'medium' }),
        ]

        expect(analyzeRiskTrend(trainer, snapshots, 'month')).toBeNull()
        const quarterTrend = analyzeRiskTrend(trainer, snapshots, 'quarter')
        expect(quarterTrend).not.toBeNull()
        expect(quarterTrend?.historicalData).toHaveLength(1)
        expect(quarterTrend?.historicalData[0].id).toBe('sixty-days')
    })

    it('detects worsening trends from older to recent risk averages', () => {
        const trainer = createTrainer()
        const trend = analyzeRiskTrend(trainer, [
            createSnapshot({ id: 's1', timestamp: '2026-02-20T12:00:00.000Z', riskScore: 20, riskLevel: 'low' }),
            createSnapshot({ id: 's2', timestamp: '2026-02-24T12:00:00.000Z', riskScore: 25, riskLevel: 'low' }),
            createSnapshot({ id: 's3', timestamp: '2026-02-28T12:00:00.000Z', riskScore: 30, riskLevel: 'medium' }),
            createSnapshot({ id: 's4', timestamp: '2026-03-06T12:00:00.000Z', riskScore: 52, riskLevel: 'high' }),
            createSnapshot({ id: 's5', timestamp: '2026-03-10T12:00:00.000Z', riskScore: 56, riskLevel: 'high' }),
            createSnapshot({ id: 's6', timestamp: '2026-03-15T12:00:00.000Z', riskScore: 60, riskLevel: 'critical' }),
        ], 'month')

        expect(trend).not.toBeNull()
        expect(trend?.trendDirection).toBe('worsening')
        expect(trend?.changeRate).toBe(31)
        expect(trend?.daysInHighRisk).toBe(2)
        expect(trend?.daysInCriticalRisk).toBe(1)
        expect(trend?.peakRiskScore).toBe(60)
        expect(trend?.lowestRiskScore).toBe(20)
        expect(trend?.currentRisk.id).toBe('s6')
    })

    it('detects improving trends when recent average is significantly lower', () => {
        const trend = analyzeRiskTrend(createTrainer(), [
            createSnapshot({ id: 'i1', timestamp: '2026-02-20T12:00:00.000Z', riskScore: 75, riskLevel: 'critical' }),
            createSnapshot({ id: 'i2', timestamp: '2026-02-24T12:00:00.000Z', riskScore: 70, riskLevel: 'high' }),
            createSnapshot({ id: 'i3', timestamp: '2026-02-28T12:00:00.000Z', riskScore: 68, riskLevel: 'high' }),
            createSnapshot({ id: 'i4', timestamp: '2026-03-06T12:00:00.000Z', riskScore: 42, riskLevel: 'medium' }),
            createSnapshot({ id: 'i5', timestamp: '2026-03-10T12:00:00.000Z', riskScore: 35, riskLevel: 'low' }),
            createSnapshot({ id: 'i6', timestamp: '2026-03-15T12:00:00.000Z', riskScore: 30, riskLevel: 'low' }),
        ], 'month')

        expect(trend?.trendDirection).toBe('improving')
        expect(trend?.changeRate).toBeCloseTo(-35.3333, 4)
    })

    it('keeps trend stable when there is insufficient history for comparison', () => {
        const trend = analyzeRiskTrend(createTrainer(), [
            createSnapshot({ id: 'x1', timestamp: '2026-03-10T12:00:00.000Z', riskScore: 55 }),
            createSnapshot({ id: 'x2', timestamp: '2026-03-15T12:00:00.000Z', riskScore: 56 }),
        ], 'month')

        expect(trend?.trendDirection).toBe('stable')
        expect(trend?.changeRate).toBe(0)
    })

    it('generates portfolio risk report across trainers', () => {
        const trainers = [
            createTrainer({ id: 'trainer-1', name: 'Trainer One' }),
            createTrainer({ id: 'trainer-2', name: 'Trainer Two' }),
            createTrainer({ id: 'trainer-3', name: 'Trainer Three' }),
        ]

        const snapshots = [
            createSnapshot({ id: 'a1', trainerId: 'trainer-1', timestamp: '2026-02-20T12:00:00.000Z', riskScore: 20, riskLevel: 'low' }),
            createSnapshot({ id: 'a2', trainerId: 'trainer-1', timestamp: '2026-02-24T12:00:00.000Z', riskScore: 25, riskLevel: 'low' }),
            createSnapshot({ id: 'a3', trainerId: 'trainer-1', timestamp: '2026-02-28T12:00:00.000Z', riskScore: 30, riskLevel: 'medium' }),
            createSnapshot({ id: 'a4', trainerId: 'trainer-1', timestamp: '2026-03-06T12:00:00.000Z', riskScore: 52, riskLevel: 'high' }),
            createSnapshot({ id: 'a5', trainerId: 'trainer-1', timestamp: '2026-03-10T12:00:00.000Z', riskScore: 56, riskLevel: 'high' }),
            createSnapshot({ id: 'a6', trainerId: 'trainer-1', timestamp: '2026-03-15T12:00:00.000Z', riskScore: 60, riskLevel: 'critical' }),

            createSnapshot({ id: 'b1', trainerId: 'trainer-2', timestamp: '2026-02-20T12:00:00.000Z', riskScore: 75, riskLevel: 'critical' }),
            createSnapshot({ id: 'b2', trainerId: 'trainer-2', timestamp: '2026-02-24T12:00:00.000Z', riskScore: 70, riskLevel: 'high' }),
            createSnapshot({ id: 'b3', trainerId: 'trainer-2', timestamp: '2026-02-28T12:00:00.000Z', riskScore: 68, riskLevel: 'high' }),
            createSnapshot({ id: 'b4', trainerId: 'trainer-2', timestamp: '2026-03-06T12:00:00.000Z', riskScore: 42, riskLevel: 'medium' }),
            createSnapshot({ id: 'b5', trainerId: 'trainer-2', timestamp: '2026-03-10T12:00:00.000Z', riskScore: 35, riskLevel: 'low' }),
            createSnapshot({ id: 'b6', trainerId: 'trainer-2', timestamp: '2026-03-15T12:00:00.000Z', riskScore: 30, riskLevel: 'low' }),
        ]

        const report = generateRiskReport(trainers, snapshots)

        expect(report.totalTrainers).toBe(3)
        expect(report.trends).toHaveLength(2)
        expect(report.trainersInCriticalRisk).toBe(1)
        expect(report.trainersInHighRisk).toBe(0)
        expect(report.trainersWithWorseningTrends).toBe(1)
        expect(report.trainersWithImprovingTrends).toBe(1)
        expect(report.averageRiskScore).toBe(45)
    })

    it('generates an empty report when trainers are present but snapshots array is empty', () => {
        const trainers = [
            createTrainer({ id: 'trainer-1', name: 'Trainer One' }),
            createTrainer({ id: 'trainer-2', name: 'Trainer Two' }),
        ]

        const report = generateRiskReport(trainers, [])

        expect(report.totalTrainers).toBe(2)
        expect(report.trends).toHaveLength(0)
        expect(report.trainersInCriticalRisk).toBe(0)
        expect(report.trainersInHighRisk).toBe(0)
        expect(report.trainersWithWorseningTrends).toBe(0)
        expect(report.trainersWithImprovingTrends).toBe(0)
        expect(report.averageRiskScore).toBe(0)
    })

    it('allows snapshot creation when no previous snapshot exists', () => {
        expect(shouldTakeSnapshot('trainer-1', undefined)).toBe(true)
    })

    it('respects snapshot cadence threshold in hours', () => {
        const recentSnapshot = createSnapshot({
            timestamp: '2026-03-16T04:30:00.000Z',
        })

        const oldSnapshot = createSnapshot({
            timestamp: '2026-03-14T00:00:00.000Z',
        })

        expect(shouldTakeSnapshot('trainer-1', recentSnapshot, 12)).toBe(false)
        expect(shouldTakeSnapshot('trainer-1', oldSnapshot, 24)).toBe(true)
    })

    it('aggregates snapshots by day using the latest snapshot of each day', () => {
        const aggregated = aggregateSnapshotsByDay([
            createSnapshot({ id: 'd1-a', timestamp: '2026-03-10T08:00:00.000Z', riskScore: 40 }),
            createSnapshot({ id: 'd1-b', timestamp: '2026-03-10T18:00:00.000Z', riskScore: 55 }),
            createSnapshot({ id: 'd2-a', timestamp: '2026-03-11T09:00:00.000Z', riskScore: 60 }),
            createSnapshot({ id: 'd2-b', timestamp: '2026-03-11T19:30:00.000Z', riskScore: 50 }),
            createSnapshot({ id: 'd3', timestamp: '2026-03-12T12:00:00.000Z', riskScore: 45 }),
        ])

        expect(aggregated.map(snapshot => snapshot.id)).toEqual(['d1-b', 'd2-b', 'd3'])
    })

    it('keeps the current latest snapshot when reduce compares against an older timestamp', () => {
        const aggregated = aggregateSnapshotsByDay([
            createSnapshot({ id: 'same-day-latest-first', timestamp: '2026-03-10T20:00:00.000Z', riskScore: 55 }),
            createSnapshot({ id: 'same-day-older-second', timestamp: '2026-03-10T09:00:00.000Z', riskScore: 35 }),
        ])

        expect(aggregated).toHaveLength(1)
        expect(aggregated[0].id).toBe('same-day-latest-first')
    })
})
