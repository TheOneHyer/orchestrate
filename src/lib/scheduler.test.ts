import { describe, expect, it } from 'vitest'

import { TrainerScheduler } from './scheduler'
import type { SchedulingConstraints } from './scheduler'
import type { Course, Session, ShiftSchedule, User } from './types'

function createShiftSchedule(shiftCode: string): ShiftSchedule {
    return {
        shiftCode,
        daysWorked: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        startTime: '08:00',
        endTime: '17:00',
        totalHoursPerWeek: 40
    }
}

function createTrainer(id: string, name: string, certifications: string[]): User {
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
            shiftSchedules: [createShiftSchedule('DAY')],
            tenure: {
                hireDate: '2020-01-01T00:00:00.000Z',
                yearsOfService: 6,
                monthsOfService: 72
            },
            specializations: ['Safety']
        }
    }
}

function createCourse(): Course {
    return {
        id: 'course-1',
        title: 'Forklift Safety',
        description: 'Certification course',
        modules: [],
        duration: 120,
        certifications: ['Forklift'],
        createdBy: 'admin-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        published: true,
        passScore: 80
    }
}

function createSession(id: string, trainerId: string, startTime: string, endTime: string): Session {
    return {
        id,
        courseId: 'course-1',
        trainerId,
        title: 'Existing Session',
        startTime,
        endTime,
        location: 'Room A',
        capacity: 12,
        enrolledStudents: [],
        status: 'scheduled'
    }
}

function createConstraints(overrides: Partial<SchedulingConstraints> = {}): SchedulingConstraints {
    return {
        courseId: 'course-1',
        requiredCertifications: ['Forklift'],
        dates: ['2026-03-16T00:00:00.000Z'],
        startTime: '09:30',
        endTime: '11:30',
        location: 'Room B',
        capacity: 10,
        ...overrides
    }
}

describe('scheduler', () => {
    it('ranks qualified trainers ahead of those with time conflicts', () => {
        const availableTrainer = createTrainer('trainer-available', 'Avery', ['Forklift'])
        const conflictingTrainer = createTrainer('trainer-conflict', 'Blake', ['Forklift'])
        const missingCertificationTrainer = createTrainer('trainer-missing', 'Casey', ['Hazmat'])
        const course = createCourse()
        const existingSessions = [
            createSession('session-1', conflictingTrainer.id, '2026-03-16T09:00:00.000Z', '2026-03-16T11:00:00.000Z')
        ]

        const scheduler = new TrainerScheduler(
            [availableTrainer, conflictingTrainer, missingCertificationTrainer],
            existingSessions,
            [course]
        )

        const matches = scheduler.findAvailableTrainers(createConstraints(), new Date('2026-03-16T00:00:00.000Z'))

        expect(matches).toHaveLength(2)
        expect(matches[0].trainer.id).toBe(availableTrainer.id)
        expect(matches[0].availability).toBe('available')
        expect(matches[1].trainer.id).toBe(conflictingTrainer.id)
        expect(matches[1].conflicts[0]).toContain('Conflict with session "Existing Session"')
    })

    it('creates recurring scheduled sessions when a qualified trainer exists', () => {
        const trainer = createTrainer('trainer-available', 'Avery', ['Forklift'])
        const scheduler = new TrainerScheduler([trainer], [], [createCourse()])

        const result = scheduler.autoScheduleSessions(
            createConstraints({
                recurrence: {
                    frequency: 'weekly',
                    endDate: '2026-03-31T00:00:00.000Z'
                }
            })
        )

        expect(result.success).toBe(true)
        expect(result.sessions).toHaveLength(3)
        result.sessions.forEach(session => {
            expect(session.trainerId).toBe(trainer.id)
        })
        expect(result.recommendations).toContain('Scheduled 3 session(s) for "Forklift Safety"')
    })

    it('returns actionable guidance when no qualified trainer can be assigned', () => {
        const trainer = createTrainer('trainer-available', 'Avery', ['Hazmat'])
        const scheduler = new TrainerScheduler([trainer], [], [createCourse()])

        const result = scheduler.autoScheduleSessions(createConstraints())

        expect(result.success).toBe(false)
        expect(result.sessions).toHaveLength(0)
        expect(result.conflicts.length).toBeGreaterThan(0)
        expect(result.conflicts[0]).toEqual(
            expect.objectContaining({
                type: 'no-trainers'
            })
        )
        expect(result.recommendations).toContain('Consider adjusting shift requirements or required certifications to find more trainers')
    })

    it('handles an empty trainer list gracefully for matching and auto-scheduling', () => {
        const scheduler = new TrainerScheduler([], [], [createCourse()])
        const constraints = createConstraints()

        expect(scheduler.findAvailableTrainers(constraints, new Date('2026-03-16T00:00:00.000Z'))).toEqual([])

        const result = scheduler.autoScheduleSessions(constraints)
        expect(result.success).toBe(false)
        expect(result.sessions).toHaveLength(0)
        expect(result.conflicts.length).toBeGreaterThan(0)
    })

    it('treats adjacent sessions as non-overlapping', () => {
        const trainer = createTrainer('trainer-available', 'Avery', ['Forklift'])
        const adjacentExisting = createSession(
            'existing-1',
            trainer.id,
            '2026-03-16T09:30:00.000Z',
            '2026-03-16T11:30:00.000Z'
        )
        const scheduler = new TrainerScheduler([trainer], [adjacentExisting], [createCourse()])

        const matches = scheduler.findAvailableTrainers(
            createConstraints({ startTime: '11:30', endTime: '13:00' }),
            new Date('2026-03-16T00:00:00.000Z')
        )

        expect(matches).toHaveLength(1)
        expect(matches[0].availability).toBe('available')
        expect(matches[0].conflicts).toEqual([])
    })

    it('keeps deterministic trainer ordering when availability is identical', () => {
        const trainerA = createTrainer('trainer-a', 'Avery', ['Forklift'])
        const trainerB = createTrainer('trainer-b', 'Blake', ['Forklift'])
        const scheduler = new TrainerScheduler([trainerA, trainerB], [], [createCourse()])

        const matches = scheduler.findAvailableTrainers(createConstraints(), new Date('2026-03-16T00:00:00.000Z'))

        expect(matches).toHaveLength(2)
        expect(matches.map(match => match.trainer.id)).toEqual(['trainer-a', 'trainer-b'])
    })

    it('returns a failure conflict when courseId is missing or invalid', () => {
        const trainer = createTrainer('trainer-available', 'Avery', ['Forklift'])
        const scheduler = new TrainerScheduler([trainer], [], [createCourse()])

        const result = scheduler.autoScheduleSessions(createConstraints({ courseId: 'missing-course' }))

        expect(result.success).toBe(false)
        expect(result.sessions).toEqual([])
        expect(result.conflicts).toContainEqual(
            expect.objectContaining({
                type: 'invalid-course',
            })
        )
        expect(result.recommendations).toContain('Select a valid course before scheduling sessions')
    })
})
