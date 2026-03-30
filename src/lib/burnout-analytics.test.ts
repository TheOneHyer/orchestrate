import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    calculateBurnoutRisk,
    calculateTrainerUtilization,
    getBurnoutRiskLevel,
    getUtilizationTrend
} from './burnout-analytics'
import type { Course, Session, User, WellnessCheckIn } from './types'

const SYSTEM_TIME = new Date('2026-03-16T12:00:00.000Z')

function createTrainer(overrides: Partial<User> = {}): User {
    return {
        id: 'trainer-1',
        name: 'Taylor Trainer',
        email: 'taylor@example.com',
        role: 'trainer',
        department: 'Operations',
        certifications: ['Forklift', 'Safety'],
        hireDate: '2020-01-01T00:00:00.000Z',
        ...overrides
    }
}

function createCourse(id: string): Course {
    return {
        id,
        title: `Course ${id}`,
        description: 'Training course',
        modules: [],
        duration: 120,
        certifications: ['Forklift'],
        createdBy: 'admin-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        published: true,
        passScore: 80
    }
}

function createSession(id: string, courseId: string, startTime: string, endTime: string): Session {
    return {
        id,
        courseId,
        trainerId: 'trainer-1',
        title: `Session ${id}`,
        startTime,
        endTime,
        location: 'Room A',
        capacity: 10,
        enrolledStudents: [],
        status: 'scheduled'
    }
}

/**
 * Creates multiple sessions with a repeating time-slot pattern, useful for aggregate analytics testing.
 *
 * Session distribution:
 * - startHour cycles as "8 + (index % 8)" → start times 08:00–15:00 (8 distinct hourly start slots)
 * - startMinute alternates as "(index % 2) * 30" → starts on :00 or :30
 * - Combined start slots repeat every 16 sessions (8 hours × 2 minute variants)
 * - Sessions beyond 16 in the same generated day reuse earlier start slots (e.g., session 17 starts at 08:00 again, matching session 1)
 * - Actual end times and real overlaps depend on `durationHours`, since duration is added after the start slot is chosen
 *
 * Intended use: Sufficient for aggregate analytics (total sessions, utilization trends, enrollments)
 * where overlaps are acceptable. Not suitable for real-time scheduling or conflict detection.
 *
 * dayCount and gapDays behavior:
 * - Sessions are distributed evenly across `dayCount` days, with `gapDays` spacing between each day
 * - Default gapDays=1 places sessions on consecutive days
 * - Increase gapDays if non-overlapping sessions are needed (e.g., gapDays=2 spreads across 2× days)
 * - If more granular control is needed (e.g., time-based validation, non-overlapping constraints),
 *   update the algorithm to use disjoint time windows or extend the slot pool beyond 16
 */
function createRepeatedSessions(options: {
    count: number
    courseIds: string[]
    dayStart: number
    dayCount: number
    durationHours: number
    gapDays?: number
}): Session[] {
    const { count, courseIds, dayStart, dayCount, durationHours, gapDays = 1 } = options
    const durationMinutes = Math.round(durationHours * 60)

    return Array.from({ length: count }, (_, index) => {
        const dayOffset = Math.floor(index / Math.ceil(count / dayCount))
        const sessionDay = dayStart + (dayOffset * gapDays)
        const startHour = 8 + (index % 8)
        const startMinute = (index % 2) * 30
        const start = new Date(Date.UTC(2026, 2, sessionDay, startHour, startMinute, 0, 0))
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

        return createSession(
            `session-${index + 1}`,
            courseIds[index % courseIds.length],
            start.toISOString(),
            end.toISOString()
        )
    })
}

/**
 * Creates multiple non-overlapping sessions, ensuring each session has its own unique time slot.
 * Useful for tests requiring accurate hour-based calculations (utilization, burnout risk).
 *
 * Slot distribution:
 * - Sessions are spaced sequentially: each starts after the previous ends
 * - Sessions per day = count / dayCount
 * - Each day starts at 08:00; sessions pile sequentially with no gaps
 * - Example: 16 sessions across 2 days = 8 per day, same time slots on each day
 *
 * Intended use: Accurate workload calculation for tests that feed into `calculateTrainerUtilization`
 * and `calculateBurnoutRisk`, where overlapping time slots would skew hour totals.
 */
function createNonOverlappingSessions(options: {
    count: number
    courseIds: string[]
    dayStart: number
    dayCount: number
    durationHours: number
    gapDays?: number
}): Session[] {
    const { count, courseIds, dayStart, dayCount, durationHours, gapDays = 1 } = options
    const durationMinutes = Math.round(durationHours * 60)
    const sessionsPerDay = Math.ceil(count / dayCount)

    return Array.from({ length: count }, (_, index) => {
        const dayOffset = Math.floor(index / sessionsPerDay)
        const sessionDay = dayStart + (dayOffset * gapDays)
        const sessionIndexOnDay = index % sessionsPerDay
        const startMinutes = 8 * 60 + sessionIndexOnDay * durationMinutes
        const startHour = Math.floor(startMinutes / 60)
        const startMinute = startMinutes % 60
        const start = new Date(Date.UTC(2026, 2, sessionDay, startHour, startMinute, 0, 0))
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

        return createSession(
            `session-${index + 1}`,
            courseIds[index % courseIds.length],
            start.toISOString(),
            end.toISOString()
        )
    })
}

function createCheckIn(id: string, overrides: Partial<WellnessCheckIn> = {}): WellnessCheckIn {
    return {
        id,
        trainerId: 'trainer-1',
        timestamp: '2026-03-15T09:00:00.000Z',
        mood: 3,
        stress: 'moderate',
        energy: 'neutral',
        workloadSatisfaction: 3,
        sleepQuality: 3,
        physicalWellbeing: 3,
        mentalClarity: 3,
        concerns: [],
        followUpRequired: false,
        followUpCompleted: false,
        ...overrides
    }
}

describe('burnout-analytics', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(SYSTEM_TIME)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns a healthy baseline when no recent workload exists', () => {
        const trainer = createTrainer()

        const result = calculateTrainerUtilization(trainer, [], [], 'month')

        expect(result.hoursScheduled).toBe(0)
        expect(result.utilizationRate).toBe(0)
        expect(result.sessionCount).toBe(0)
        expect(result.riskScore).toBe(0)
        expect(result.riskLevel).toBe('low')
        expect(result.recommendations).toContain('Current workload is within healthy ranges')
    })

    it('marks sustained overwork and poor wellness as critical risk', () => {
        const trainer = createTrainer()
        const courses = ['course-1', 'course-2', 'course-3', 'course-4', 'course-5', 'course-6'].map(createCourse)
        const sessions = Array.from({ length: 15 }, (_, index) => {
            const day = String(index + 1).padStart(2, '0')
            return createSession(
                `session-${index + 1}`,
                courses[index % courses.length].id,
                `2026-03-${day}T08:00:00.000Z`,
                `2026-03-${day}T20:00:00.000Z`
            )
        })

        const checkIns = [
            createCheckIn('check-in-1', { timestamp: '2026-03-15T09:00:00.000Z', mood: 2, stress: 'high', energy: 'exhausted', workloadSatisfaction: 1, concerns: ['Fatigue'], followUpRequired: true }),
            createCheckIn('check-in-2', { timestamp: '2026-03-14T09:00:00.000Z', mood: 2, stress: 'high', energy: 'exhausted', workloadSatisfaction: 1, concerns: ['Fatigue', 'Stress'], followUpRequired: true }),
            createCheckIn('check-in-3', { timestamp: '2026-03-13T09:00:00.000Z', mood: 2, stress: 'critical', energy: 'exhausted', workloadSatisfaction: 1, concerns: ['Fatigue'], followUpRequired: true }),
            createCheckIn('check-in-4', { timestamp: '2026-03-12T09:00:00.000Z', mood: 1, stress: 'critical', workloadSatisfaction: 1, followUpRequired: true }),
            createCheckIn('check-in-5', { timestamp: '2026-03-11T09:00:00.000Z', mood: 2 })
        ]

        const result = calculateTrainerUtilization(trainer, sessions, courses, 'month', checkIns)

        expect(result.hoursScheduled).toBe(180)
        expect(result.sessionCount).toBe(15)
        expect(result.consecutiveDays).toBe(15)
        expect(result.utilizationRate).toBeGreaterThan(100)
        expect(result.riskLevel).toBe('critical')
        expect(result.factors.map(factor => factor.factor)).toEqual(
            expect.arrayContaining([
                'Critical Overutilization',
                'Extended Work Streak',
                'Course Variety Overload',
                'Poor Wellbeing - Low Mood',
                'Chronic High Stress',
                'Persistent Fatigue',
                'Workload Dissatisfaction',
                'Multiple Concerns Raised',
                'Pending Follow-ups'
            ])
        )
        expect(result.recommendations).toEqual(
            expect.arrayContaining([
                'Immediate workload reduction required - redistribute at least 20% of sessions to other trainers',
                'Schedule immediate stress management intervention or counseling',
                'Complete pending wellness follow-ups as high priority'
            ])
        )
    })

    it('caps aggregated burnout risk at 100 for severe cases', () => {
        const trainer = createTrainer()
        const courses = [createCourse('course-1')]
        const sessions = Array.from({ length: 12 }, (_, index) => {
            const day = String(index + 1).padStart(2, '0')
            return createSession(
                `session-${index + 1}`,
                'course-1',
                `2026-03-${day}T08:00:00.000Z`,
                `2026-03-${day}T22:00:00.000Z`
            )
        })
        const checkIns = Array.from({ length: 5 }, (_, index) =>
            createCheckIn(`check-in-${index + 1}`, {
                timestamp: `2026-03-${String(15 - index).padStart(2, '0')}T09:00:00.000Z`,
                mood: 1,
                stress: 'critical',
                concerns: ['Concern A', 'Concern B']
            })
        )

        const result = calculateBurnoutRisk(
            trainer.id,
            sessions,
            checkIns,
            [trainer],
            courses
        )

        expect(result.risk).toBe('critical')
        expect(result.riskScore).toBe(100)
        expect(result.factors).toEqual(expect.arrayContaining(['Low mood reported in recent check-ins', 'Consistent high stress levels']))
        expect(result.recommendations).toContain('Schedule immediate wellness intervention')
    })

    it.each([
        [69.9, 'low'],
        [70, 'medium'],
        [84.9, 'medium'],
        [85, 'high'],
        [94.9, 'high'],
        [95, 'critical'],
        [-1, 'low'],
        [101, 'critical'],
        [NaN, 'low'],
    ])('maps utilization %s to burnout risk %s', (input, expected) => {
        expect(getBurnoutRiskLevel(input)).toBe(expected)
    })

    it('flags high utilization and long streaks before critical thresholds', () => {
        const trainer = createTrainer()
        const courses = [createCourse('course-1')]
        const sessions = Array.from({ length: 8 }, (_, index) => {
            const day = String(index + 8).padStart(2, '0')
            return createSession(
                `session-${index + 1}`,
                'course-1',
                `2026-03-${day}T00:00:00.000Z`,
                `2026-03-${day}T20:00:00.000Z`
            )
        })

        const result = calculateTrainerUtilization(trainer, sessions, courses, 'month')

        expect(result.utilizationRate).toBeGreaterThan(85)
        expect(result.utilizationRate).toBeLessThan(95)
        expect(result.riskLevel).toBe('medium')
        expect(result.factors.map((factor) => factor.factor)).toEqual(
            expect.arrayContaining(['High Utilization', 'Long Work Streak'])
        )
        expect(result.recommendations).toEqual(
            expect.arrayContaining([
                'Reduce session load by 10-15% over the next two weeks',
                'Schedule a rest day within the next 3 days'
            ])
        )
    })

    it('captures medium wellness warning signals and follow-up recommendations', () => {
        const trainer = createTrainer()
        const checkIns = [
            createCheckIn('check-in-1', { timestamp: '2026-03-15T09:00:00.000Z', mood: 3, stress: 'high', energy: 'tired', workloadSatisfaction: 2, concerns: ['Fatigue'], followUpRequired: true }),
            createCheckIn('check-in-2', { timestamp: '2026-03-14T09:00:00.000Z', mood: 3, stress: 'high', energy: 'tired', workloadSatisfaction: 2, concerns: ['Workload'], followUpRequired: true }),
            createCheckIn('check-in-3', { timestamp: '2026-03-13T09:00:00.000Z', mood: 3, stress: 'moderate', energy: 'neutral', workloadSatisfaction: 3, concerns: ['Schedule'] }),
            createCheckIn('check-in-4', { timestamp: '2026-03-12T09:00:00.000Z', mood: 4, stress: 'moderate', energy: 'neutral', workloadSatisfaction: 3 }),
            createCheckIn('check-in-5', { timestamp: '2026-03-11T09:00:00.000Z', mood: 3, stress: 'moderate', energy: 'neutral', workloadSatisfaction: 3 })
        ]

        const result = calculateTrainerUtilization(trainer, [], [], 'month', checkIns)

        expect(result.factors.map((factor) => factor.factor)).toEqual(
            expect.arrayContaining([
                'Below Average Mood',
                'Elevated Stress Levels',
                'Energy Depletion',
                'Workload Dissatisfaction',
                'Multiple Concerns Raised',
                'Pending Follow-ups'
            ])
        )
        expect(result.recommendations).toEqual(
            expect.arrayContaining([
                'Schedule immediate stress management intervention or counseling',
                'Complete pending wellness follow-ups as high priority'
            ])
        )
    })

    it('reports utilization trends as increasing when recent weekly load climbs sharply', () => {
        const trainer = createTrainer()
        const sessions = [
            createSession('w1', 'course-1', '2026-02-16T08:00:00.000Z', '2026-02-16T12:00:00.000Z'),
            createSession('w2', 'course-1', '2026-02-23T08:00:00.000Z', '2026-02-23T20:00:00.000Z'),
            createSession('w3', 'course-1', '2026-03-02T08:00:00.000Z', '2026-03-03T04:00:00.000Z'),
            createSession('w4', 'course-1', '2026-03-09T08:00:00.000Z', '2026-03-10T12:00:00.000Z')
        ]

        const trend = getUtilizationTrend(trainer, sessions, 'month')

        expect(trend.trend).toBe('increasing')
        expect(Number.isFinite(trend.changeRate)).toBe(true)
        expect(trend.dataPoints.length).toBeGreaterThan(1)
    })

    it('supports week and quarter utilization windows', () => {
        const trainer = createTrainer()
        const courses = [createCourse('course-1')]
        const sessions = [
            createSession('recent', 'course-1', '2026-03-14T08:00:00.000Z', '2026-03-14T12:00:00.000Z'),
            createSession('within-quarter', 'course-1', '2026-01-20T08:00:00.000Z', '2026-01-20T12:00:00.000Z'),
        ]

        const weekUtilization = calculateTrainerUtilization(trainer, sessions, courses, 'week')
        const quarterUtilization = calculateTrainerUtilization(trainer, sessions, courses, 'quarter')

        expect(weekUtilization.sessionCount).toBe(1)
        expect(quarterUtilization.sessionCount).toBe(2)
        expect(quarterUtilization.hoursScheduled).toBeGreaterThan(weekUtilization.hoursScheduled)
    })

    it('computes stable weekly trend and zero change rate with no sessions', () => {
        const trainer = createTrainer()

        const weekTrend = getUtilizationTrend(trainer, [], 'week')
        const quarterTrend = getUtilizationTrend(trainer, [], 'quarter')

        expect(weekTrend.trend).toBe('stable')
        expect(weekTrend.changeRate).toBe(0)
        expect(quarterTrend.trend).toBe('stable')
        expect(quarterTrend.changeRate).toBe(0)
    })

    it('adds session frequency and course variety recommendations without escalating to critical risk', () => {
        const trainer = createTrainer()
        const courses = ['course-1', 'course-2', 'course-3', 'course-4', 'course-5', 'course-6'].map(createCourse)
        const sessions = createNonOverlappingSessions({
            count: 65,
            courseIds: courses.map((course) => course.id),
            dayStart: 1,
            dayCount: 4,
            durationHours: 2.4,
            gapDays: 4,
        })

        const result = calculateTrainerUtilization(trainer, sessions, courses, 'month')

        expect(result.riskLevel).toBe('high')
        expect(result.factors.map((factor) => factor.factor)).toEqual(
            expect.arrayContaining([
                'High Utilization',
                'High Session Frequency',
                'Course Variety Overload',
            ])
        )
        expect(result.recommendations).toEqual(
            expect.arrayContaining([
                'Space out sessions more evenly across the week',
                'Consider longer session blocks instead of many short sessions',
                'Focus trainer on 3-4 core courses to reduce context switching',
            ])
        )
    })

    it('reports utilization trends as decreasing when recent weekly load drops sharply', () => {
        const trainer = createTrainer()
        const sessions = [
            createSession('dec-1', 'course-1', '2026-02-18T08:00:00.000Z', '2026-02-19T04:00:00.000Z'),
            createSession('dec-2', 'course-1', '2026-02-26T08:00:00.000Z', '2026-02-26T20:00:00.000Z'),
            createSession('dec-3', 'course-1', '2026-03-05T08:00:00.000Z', '2026-03-05T16:00:00.000Z'),
            createSession('dec-4', 'course-1', '2026-03-13T08:00:00.000Z', '2026-03-13T12:00:00.000Z'),
        ]

        const trend = getUtilizationTrend(trainer, sessions, 'month')

        expect(trend.trend).toBe('decreasing')
        expect(trend.changeRate).toBeLessThan(0)
        expect(trend.dataPoints.length).toBeGreaterThan(1)
    })

    it('classifies burnout risk as moderate when workload pressure combines with repeated concerns', () => {
        const trainer = createTrainer()
        const courses = [createCourse('course-1')]
        const sessions = createRepeatedSessions({
            count: 54,
            courseIds: ['course-1'],
            dayStart: 1,
            dayCount: 4,
            durationHours: 2.8,
            gapDays: 3,
        })
        const checkIns = [
            createCheckIn('moderate-1', { concerns: ['Workload'], mood: 4, stress: 'low', energy: 'neutral' }),
            createCheckIn('moderate-2', { timestamp: '2026-03-14T09:00:00.000Z', concerns: ['Coverage'], mood: 4, stress: 'low', energy: 'neutral' }),
            createCheckIn('moderate-3', { timestamp: '2026-03-13T09:00:00.000Z', concerns: ['Context switching'], mood: 4, stress: 'moderate', energy: 'neutral' }),
        ]

        const result = calculateBurnoutRisk(trainer.id, sessions, checkIns, [trainer], courses)

        expect(result.risk).toBe('moderate')
        expect(result.riskScore).toBe(40)
        expect(result.factors).toEqual(expect.arrayContaining(['Multiple concerns raised']))
    })

    it('classifies burnout risk as high before reaching the critical threshold', () => {
        const trainer = createTrainer()
        const courses = [createCourse('course-1')]
        const sessions = createRepeatedSessions({
            count: 54,
            courseIds: ['course-1'],
            dayStart: 1,
            dayCount: 4,
            durationHours: 2.8,
            gapDays: 3,
        })
        const checkIns = [
            createCheckIn('high-1', { mood: 2, concerns: ['Workload'], stress: 'moderate', energy: 'tired' }),
            createCheckIn('high-2', { timestamp: '2026-03-14T09:00:00.000Z', mood: 2, concerns: ['Coverage'], stress: 'moderate', energy: 'neutral' }),
            createCheckIn('high-3', { timestamp: '2026-03-13T09:00:00.000Z', mood: 2, concerns: ['Fatigue'], stress: 'low', energy: 'neutral' }),
        ]

        const result = calculateBurnoutRisk(trainer.id, sessions, checkIns, [trainer], courses)

        expect(result.risk).toBe('high')
        expect(result.riskScore).toBe(60)
        expect(result.factors).toEqual(
            expect.arrayContaining([
                'Low mood reported in recent check-ins',
                'Multiple concerns raised',
            ])
        )
    })

    it('returns a low risk assessment when trainer id is unknown', () => {
        const assessment = calculateBurnoutRisk('missing-trainer', [], [], [], [])

        expect(assessment).toEqual({
            trainerId: 'missing-trainer',
            riskScore: 0,
            risk: 'low',
            factors: [],
            recommendations: []
        })
    })

    it('returns low risk when trainer is found but has no matching wellness check-ins', () => {
        // Exercises the false branch of `if (recentCheckIns.length > 0)` (line 574)
        // and the false branch of `else if (riskScore >= 40)` when riskScore is low (line 602).
        const trainer = createTrainer()
        const courses = [createCourse('course-1')]

        const result = calculateBurnoutRisk(trainer.id, [], [], [trainer], courses)

        expect(result.trainerId).toBe(trainer.id)
        expect(result.risk).toBe('low')
        expect(result.factors).toEqual([])
    })

    it('does not add Multiple concerns factor when fewer than 3 check-ins raise a concern', () => {
        // Exercises the false branch of `if (concernsRaised >= 3)` (line 590).
        const trainer = createTrainer()
        const courses = [createCourse('course-1')]
        const checkIns = [
            createCheckIn('c-1', { concerns: ['Workload'], stress: 'low', mood: 4 }),
            createCheckIn('c-2', { concerns: [], stress: 'low', mood: 4 }),
            createCheckIn('c-3', { concerns: [], stress: 'low', mood: 4 }),
        ]

        const result = calculateBurnoutRisk(trainer.id, [], checkIns, [trainer], courses)

        expect(result.factors).not.toContain('Multiple concerns raised')
    })

    it('flags consistent high stress when 3 or more recent check-ins report high/critical stress', () => {
        // Exercises the true branch of `if (highStressCount >= 3)` (line 583).
        const trainer = createTrainer()
        const checkIns = [
            createCheckIn('s-1', { stress: 'high', mood: 3 }),
            createCheckIn('s-2', { timestamp: '2026-03-14T09:00:00.000Z', stress: 'high', mood: 3 }),
            createCheckIn('s-3', { timestamp: '2026-03-13T09:00:00.000Z', stress: 'critical', mood: 3 }),
        ]

        const result = calculateBurnoutRisk(trainer.id, [], checkIns, [trainer], [])

        expect(result.factors).toContain('Consistent high stress levels')
        expect(result.recommendations).toContain('Schedule immediate wellness intervention')
    })
})
