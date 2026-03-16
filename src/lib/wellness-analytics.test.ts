import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    analyzeWellnessTrend,
    calculateRecoveryProgress,
    calculateWellnessScore,
    generateRecoveryMilestones,
    getRecoveryPlanRecommendations,
    getWellnessInsights,
    getWellnessStatus,
    shouldTriggerRecoveryPlan,
} from './wellness-analytics'
import type { RecoveryPlan, WellnessCheckIn } from './types'

const SYSTEM_TIME = new Date('2026-03-16T12:00:00.000Z')

function createCheckIn(overrides: Partial<WellnessCheckIn> = {}): WellnessCheckIn {
    return {
        id: 'check-in-1',
        trainerId: 'trainer-1',
        timestamp: '2026-03-15T12:00:00.000Z',
        mood: 4,
        stress: 'moderate',
        energy: 'energized',
        workloadSatisfaction: 4,
        sleepQuality: 4,
        physicalWellbeing: 4,
        mentalClarity: 4,
        concerns: [],
        followUpRequired: false,
        followUpCompleted: false,
        ...overrides,
    }
}

function createRecoveryPlan(overrides: Partial<RecoveryPlan> = {}): RecoveryPlan {
    return {
        id: 'plan-1',
        trainerId: 'trainer-1',
        createdBy: 'admin-1',
        createdAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        triggerReason: 'High stress',
        targetUtilization: 80,
        currentUtilization: 95,
        startDate: '2026-03-01T00:00:00.000Z',
        targetCompletionDate: '2026-03-31T00:00:00.000Z',
        actions: [
            {
                id: 'action-1',
                type: 'workload-reduction',
                description: 'Reduce workload by 10%',
                targetDate: '2026-03-10T00:00:00.000Z',
                completed: true,
            },
            {
                id: 'action-2',
                type: 'support-session',
                description: 'Weekly support check-in',
                targetDate: '2026-03-12T00:00:00.000Z',
                completed: false,
            },
        ],
        checkIns: [],
        ...overrides,
    }
}

describe('wellness-analytics', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(SYSTEM_TIME)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('calculates wellness score with weighted factors', () => {
        const checkIn = createCheckIn()
        const expected = Math.round(
            (checkIn.mood * 20 * 0.15) +
            (70 * 0.2) +
            (80 * 0.15) +
            (checkIn.workloadSatisfaction * 20 * 0.2) +
            (checkIn.sleepQuality * 20 * 0.1) +
            (checkIn.physicalWellbeing * 20 * 0.1) +
            (checkIn.mentalClarity * 20 * 0.1)
        )
        const score = calculateWellnessScore(checkIn)

        expect(expected).toBe(78)
        expect(score).toBe(expected)
    })

    it('returns an empty trend summary when no check-ins are in range', () => {
        const trend = analyzeWellnessTrend([], 'trainer-1', 'month')

        expect(trend).toMatchObject({
            trainerId: 'trainer-1',
            period: '2026-03',
            checkInCount: 0,
            concernsRaised: 0,
            followUpsRequired: 0,
            recoveryPlansActive: 0,
        })
    })

    it('aggregates only relevant check-ins for trainer and timeframe', () => {
        const trend = analyzeWellnessTrend(
            [
                createCheckIn({
                    id: 'a',
                    timestamp: '2026-03-15T12:00:00.000Z',
                    mood: 5,
                    stress: 'low',
                    energy: 'energized',
                    concerns: ['Workload'],
                    followUpRequired: true,
                    followUpCompleted: false,
                }),
                createCheckIn({
                    id: 'b',
                    timestamp: '2026-03-11T12:00:00.000Z',
                    mood: 3,
                    stress: 'high',
                    energy: 'tired',
                    concerns: [],
                    followUpRequired: false,
                }),
                createCheckIn({
                    id: 'c',
                    trainerId: 'trainer-2',
                    timestamp: '2026-03-14T12:00:00.000Z',
                }),
                createCheckIn({
                    id: 'd',
                    timestamp: '2026-02-01T12:00:00.000Z',
                }),
            ],
            'trainer-1',
            'week'
        )

        expect(trend.checkInCount).toBe(2)
        expect(trend.averageMood).toBe(4)
        expect(trend.averageStress).toBe(70)
        expect(trend.averageEnergy).toBe(60)
        expect(trend.concernsRaised).toBe(1)
        expect(trend.followUpsRequired).toBe(1)
    })

    it('maps wellness status by score thresholds', () => {
        expect(getWellnessStatus(85)).toBe('excellent')
        expect(getWellnessStatus(84)).toBe('good')
        expect(getWellnessStatus(70)).toBe('good')
        expect(getWellnessStatus(69)).toBe('fair')
        expect(getWellnessStatus(55)).toBe('fair')
        expect(getWellnessStatus(54)).toBe('poor')
        expect(getWellnessStatus(40)).toBe('poor')
        expect(getWellnessStatus(39)).toBe('critical')
    })

    it('does not trigger recovery plan when no check-ins exist', () => {
        const result = shouldTriggerRecoveryPlan([], 'trainer-1', 90)

        expect(result.shouldTrigger).toBe(false)
        expect(result.reasons).toEqual([])
    })

    it('triggers recovery plan when risk conditions are present', () => {
        const result = shouldTriggerRecoveryPlan(
            [
                createCheckIn({
                    id: 'latest',
                    timestamp: '2026-03-16T09:00:00.000Z',
                    mood: 1,
                    stress: 'critical',
                    energy: 'exhausted',
                    workloadSatisfaction: 1,
                    followUpRequired: true,
                    followUpCompleted: false,
                }),
                createCheckIn({
                    id: 'prev-1',
                    timestamp: '2026-03-15T09:00:00.000Z',
                    mood: 2,
                    stress: 'high',
                    energy: 'tired',
                    workloadSatisfaction: 2,
                }),
                createCheckIn({
                    id: 'prev-2',
                    timestamp: '2026-03-14T09:00:00.000Z',
                    mood: 3,
                    stress: 'moderate',
                    energy: 'neutral',
                    workloadSatisfaction: 3,
                }),
            ],
            'trainer-1',
            90
        )

        expect(result.shouldTrigger).toBe(true)
        expect(result.reasons).toEqual(
            expect.arrayContaining([
                expect.stringContaining('Low wellness score'),
                'Critical stress level reported',
                'Low energy level: exhausted',
                'Poor workload satisfaction',
                'High utilization combined with reduced wellness',
                'Follow-up required from previous check-in',
            ])
        )
    })

    it('returns zero progress when a recovery plan has no actions', () => {
        const result = calculateRecoveryProgress(createRecoveryPlan({ actions: [] }))

        expect(result).toBe(0)
    })

    it('calculates recovery progress from completed actions', () => {
        const result = calculateRecoveryProgress(createRecoveryPlan())

        // 1 of 2 actions complete => 35 points, plus the current utilization formula contributes 30 points.
        expect(result).toBe(65)
    })

    it('generates intensive recommendations for high-risk conditions', () => {
        const recommendations = getRecoveryPlanRecommendations(96, 45, 'critical', 'exhausted')

        expect(recommendations).toEqual(
            expect.arrayContaining([
                'URGENT: Reduce workload to below 85% immediately',
                'Immediate mental health support consultation',
                'Review sleep patterns and work-life balance',
                'Implement comprehensive recovery plan',
            ])
        )
    })

    it('returns baseline recommendations when no triggers are present', () => {
        const recommendations = getRecoveryPlanRecommendations(70, 85, 'low', 'excellent')

        expect(recommendations).toEqual([
            'Continue current wellness monitoring',
            'Maintain regular check-in schedule',
        ])
    })

    it('creates milestone schedule with first, midpoint, and final labels', () => {
        const milestones = generateRecoveryMilestones(97, 85, 4)

        expect(milestones).toHaveLength(4)
        expect(milestones[0]).toEqual({
            week: 1,
            targetUtilization: 94,
            description: 'Initial workload reduction and recovery plan kickoff',
        })
        expect(milestones[1].description).toBe('Mid-point review and adjustment')
        expect(milestones[3]).toEqual({
            week: 4,
            targetUtilization: 85,
            description: 'Target utilization achieved - plan completion review',
        })
    })

    it('returns warning insight when no check-ins exist', () => {
        const insights = getWellnessInsights([], 'trainer-1')

        expect(insights).toEqual([
            {
                insight: 'No wellness check-ins recorded - schedule initial check-in',
                severity: 'warning',
            },
        ])
    })

    it('returns critical and warning insights for persistent negative indicators', () => {
        const insights = getWellnessInsights(
            [
                createCheckIn({
                    id: '1',
                    timestamp: '2026-02-20T10:00:00.000Z',
                    mood: 2,
                    stress: 'critical',
                    energy: 'exhausted',
                    concerns: ['Fatigue', 'Staffing'],
                }),
                createCheckIn({
                    id: '2',
                    timestamp: '2026-02-19T10:00:00.000Z',
                    mood: 2,
                    stress: 'high',
                    energy: 'tired',
                    concerns: ['Fatigue'],
                }),
                createCheckIn({
                    id: '3',
                    timestamp: '2026-02-18T10:00:00.000Z',
                    mood: 2,
                    stress: 'high',
                    energy: 'tired',
                    concerns: ['Fatigue'],
                }),
                createCheckIn({
                    id: '4',
                    timestamp: '2026-02-17T10:00:00.000Z',
                    mood: 3,
                    stress: 'moderate',
                    energy: 'neutral',
                    concerns: [],
                }),
                createCheckIn({
                    id: '5',
                    timestamp: '2026-02-16T10:00:00.000Z',
                    mood: 2,
                    stress: 'high',
                    energy: 'tired',
                    concerns: ['Staffing'],
                }),
            ],
            'trainer-1'
        )

        expect(insights).toEqual(
            expect.arrayContaining([
                {
                    insight: 'Consistently low mood scores - immediate intervention recommended',
                    severity: 'critical',
                },
                {
                    insight: 'High stress reported in 4 of last 5 check-ins',
                    severity: 'critical',
                },
                {
                    insight: 'Low energy levels persistent across 4 recent check-ins',
                    severity: 'warning',
                },
                {
                    insight: 'Recurring concern: "Fatigue" (3 times)',
                    severity: 'warning',
                },
                {
                    insight: 'Last check-in was 24 days ago - schedule new check-in',
                    severity: 'warning',
                },
            ])
        )
    })

    it('returns healthy info insight when recent check-ins are stable', () => {
        const insights = getWellnessInsights(
            [
                createCheckIn({
                    id: 'recent',
                    timestamp: '2026-03-15T08:00:00.000Z',
                    mood: 5,
                    stress: 'low',
                    energy: 'excellent',
                    concerns: [],
                }),
            ],
            'trainer-1'
        )

        expect(insights).toEqual([
            {
                insight: 'Wellness indicators within normal range',
                severity: 'info',
            },
        ])
    })
})
