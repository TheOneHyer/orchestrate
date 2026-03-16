import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    calculateBurnoutRisk,
    calculateTrainerUtilization,
    getBurnoutRiskLevel
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

function createCheckIn(id: string, overrides: Partial<WellnessCheckIn> = {}): WellnessCheckIn {
    return {
        id,
        trainerId: 'trainer-1',
        timestamp: '2026-03-15T09:00:00.000Z',
        mood: 2,
        stress: 'high',
        energy: 'tired',
        workloadSatisfaction: 1,
        sleepQuality: 2,
        physicalWellbeing: 2,
        mentalClarity: 2,
        concerns: ['Fatigue'],
        followUpRequired: true,
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
            createCheckIn('check-in-1', { timestamp: '2026-03-15T09:00:00.000Z', energy: 'exhausted' }),
            createCheckIn('check-in-2', { timestamp: '2026-03-14T09:00:00.000Z', energy: 'exhausted', concerns: ['Fatigue', 'Stress'] }),
            createCheckIn('check-in-3', { timestamp: '2026-03-13T09:00:00.000Z', energy: 'exhausted', stress: 'critical' }),
            createCheckIn('check-in-4', { timestamp: '2026-03-12T09:00:00.000Z', mood: 1, stress: 'critical' }),
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
})
