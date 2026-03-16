import { describe, expect, it } from 'vitest'

import {
    analyzeWorkloadBalance,
    calculateTrainerWorkload,
    findRedistributionOpportunities
} from './workload-balancer'
import type { Course, Session, ShiftSchedule, User } from './types'

const WEEK_START = new Date('2026-03-09T00:00:00.000Z')
const WEEK_END = new Date('2026-03-15T23:59:59.999Z')

function createShiftSchedule(shiftCode: string): ShiftSchedule {
    return {
        shiftCode,
        daysWorked: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        startTime: '08:00',
        endTime: '16:00',
        totalHoursPerWeek: 40
    }
}

function createTrainer(id: string, name: string, certifications: string[], shiftCode = 'DAY'): User {
    return {
        id,
        name,
        email: `${id}@example.com`,
        role: 'trainer',
        department: 'Operations',
        certifications,
        hireDate: '2020-01-01T00:00:00.000Z',
        trainerProfile: {
            authorizedRoles: ['trainer'],
            shiftSchedules: [createShiftSchedule(shiftCode)],
            tenure: {
                hireDate: '2020-01-01T00:00:00.000Z',
                yearsOfService: 6,
                monthsOfService: 72
            },
            specializations: ['Safety']
        }
    }
}

function createCourse(id: string, certifications: string[]): Course {
    return {
        id,
        title: `Course ${id}`,
        description: 'Training course',
        modules: [],
        duration: 240,
        certifications,
        createdBy: 'admin-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        published: true,
        passScore: 80
    }
}

function createSession(id: string, trainerId: string, courseId: string, startTime: string, endTime: string): Session {
    return {
        id,
        courseId,
        trainerId,
        title: `Session ${id}`,
        startTime,
        endTime,
        location: 'Room A',
        capacity: 10,
        enrolledStudents: [],
        status: 'scheduled'
    }
}

function generateSessions(
    count: number,
    trainerId: string,
    courseId: string,
    baseDayOffset: number,
    idPrefix: string
): Session[] {
    return Array.from({ length: count }, (_, index) => {
        const day = baseDayOffset + Math.floor(index / 2)
        const startHour = index % 2 === 0 ? '08:00:00.000Z' : '13:00:00.000Z'
        const endHour = index % 2 === 0 ? '12:00:00.000Z' : '17:00:00.000Z'

        return createSession(
            `${idPrefix}${index + 1}`,
            trainerId,
            courseId,
            `2026-03-${String(day).padStart(2, '0')}T${startHour}`,
            `2026-03-${String(day).padStart(2, '0')}T${endHour}`
        )
    })
}

describe('workload-balancer', () => {
    it('calculates trainer workload totals and per-course counts', () => {
        const trainer = createTrainer('trainer-a', 'Avery', ['Forklift'])
        const sessions = [
            createSession('session-1', trainer.id, 'course-a', '2026-03-09T08:00:00.000Z', '2026-03-09T12:00:00.000Z'),
            createSession('session-2', trainer.id, 'course-a', '2026-03-10T08:00:00.000Z', '2026-03-10T12:00:00.000Z'),
            createSession('session-3', trainer.id, 'course-b', '2026-03-11T09:00:00.000Z', '2026-03-11T11:00:00.000Z')
        ]

        const result = calculateTrainerWorkload(trainer, sessions, WEEK_START, WEEK_END)

        expect(result.totalHours).toBe(10)
        expect(result.sessionCount).toBe(3)
        expect(result.utilizationRate).toBe(25)
        expect(result.availableHours).toBe(30)
        expect(result.sessionsByCourse.get('course-a')).toBe(2)
        expect(result.sessionsByCourse.get('course-b')).toBe(1)
    })

    it('recommends redistribution and optimization when workload is unbalanced', () => {
        const overloaded = createTrainer('trainer-overloaded', 'Olivia', ['Forklift'])
        const available = createTrainer('trainer-available', 'Parker', ['Forklift'])
        const idle = createTrainer('trainer-idle', 'Riley', ['Forklift'])
        const users = [overloaded, available, idle]
        const courses = [createCourse('course-a', ['Forklift'])]

        const overloadedSessions = generateSessions(10, overloaded.id, 'course-a', 9, 'overloaded-')

        const remainingSessions = [
            createSession('available-1', available.id, 'course-a', '2026-03-10T08:00:00.000Z', '2026-03-10T12:00:00.000Z'),
            createSession('available-2', available.id, 'course-a', '2026-03-12T08:00:00.000Z', '2026-03-12T12:00:00.000Z'),
            createSession('idle-1', idle.id, 'course-a', '2026-03-11T08:00:00.000Z', '2026-03-11T12:00:00.000Z')
        ]

        const analysis = analyzeWorkloadBalance(users, [...overloadedSessions, ...remainingSessions], courses, WEEK_START, WEEK_END)

        expect(analysis.overutilizedTrainers).toHaveLength(1)
        expect(analysis.underutilizedTrainers).toHaveLength(2)
        expect(analysis.totalCapacity).toBe(120)
        // totalUtilization here represents total scheduled hours, not a percentage.
        expect(analysis.totalUtilization).toBe(52)
        expect(analysis.balanceScore).toBeLessThan(100)
        expect(analysis.recommendations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'redistribute',
                    affectedTrainers: [overloaded.id, available.id],
                    actionable: true
                }),
                expect.objectContaining({
                    type: 'optimize',
                    affectedTrainers: [available.id, idle.id],
                    actionable: true
                })
            ])
        )
    })

    it('finds a bounded set of sessions to move to a compatible trainer', () => {
        const overloaded = createTrainer('trainer-overloaded', 'Olivia', ['Forklift'])
        const available = createTrainer('trainer-available', 'Parker', ['Forklift'])
        const sessions = generateSessions(10, overloaded.id, 'course-a', 9, 'session-')
        const courses = [createCourse('course-a', ['Forklift'])]

        const overloadedWorkload = calculateTrainerWorkload(overloaded, sessions, WEEK_START, WEEK_END)
        const availableWorkload = calculateTrainerWorkload(available, [], WEEK_START, WEEK_END)

        const opportunities = findRedistributionOpportunities(
            overloadedWorkload,
            availableWorkload,
            sessions,
            courses
        )

        // 40h overloaded vs 85% target (34h) means 6h must move; with 4h sessions,
        // the redistribution loop selects two compatible sessions to reach/exceed that gap.
        expect(opportunities).toHaveLength(2)
        for (const session of opportunities) {
            expect(session).toHaveProperty('courseId', 'course-a')
        }
    })
})
