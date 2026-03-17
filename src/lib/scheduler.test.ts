import { describe, expect, it } from 'vitest'

import { TrainerScheduler, type SchedulingConstraints } from './scheduler'

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

    it('excludes trainers without shift schedules from available matches', () => {
        const trainerWithoutProfile = {
            ...createTrainer('trainer-no-profile', 'No Profile', ['Forklift']),
            trainerProfile: undefined,
        } as unknown as User
        const scheduler = new TrainerScheduler([trainerWithoutProfile], [], [createCourse()])

        const matches = scheduler.findAvailableTrainers(createConstraints(), new Date('2026-03-16T00:00:00.000Z'))

        expect(matches).toEqual([])
    })

    it('excludes trainers when session day is outside their worked days', () => {
        const trainer = {
            ...createTrainer('trainer-weekday', 'Weekday Only', ['Forklift']),
            trainerProfile: {
                ...createTrainer('trainer-weekday', 'Weekday Only', ['Forklift']).trainerProfile,
                shiftSchedules: [
                    {
                        shiftCode: 'WEEKDAY',
                        daysWorked: ['monday'],
                        startTime: '08:00',
                        endTime: '17:00',
                        totalHoursPerWeek: 40,
                    },
                ],
            },
        }
        const scheduler = new TrainerScheduler([trainer], [], [createCourse()])

        // Target date is Sunday; schedule only works Monday.
        const matches = scheduler.findAvailableTrainers(
            createConstraints(),
            new Date('2026-03-15T00:00:00.000Z')
        )

        expect(matches).toEqual([])
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

    it('adds a partial-assignment recommendation when the best trainer has conflicts', () => {
        const trainer = createTrainer('trainer-partial', 'Avery', ['Forklift'])
        const existingSessions = [
            createSession('existing-1', trainer.id, '2026-03-16T09:00:00.000Z', '2026-03-16T11:00:00.000Z'),
            createSession('existing-2', trainer.id, '2026-03-16T09:15:00.000Z', '2026-03-16T10:45:00.000Z'),
            createSession('existing-3', trainer.id, '2026-03-16T08:45:00.000Z', '2026-03-16T11:15:00.000Z')
        ]
        const scheduler = new TrainerScheduler([trainer], existingSessions, [createCourse()])

        const result = scheduler.autoScheduleSessions(createConstraints())

        expect(result.success).toBe(true)
        expect(result.sessions).toHaveLength(1)
        expect(result.recommendations.some((entry) => entry.includes('assigned with partial match'))).toBe(true)
    })

    it('adds an unavailable-trainer conflict when best match score drops below availability threshold', () => {
        const trainer = createTrainer('trainer-overbooked', 'Avery', ['Forklift'])
        const overlappingSessions = [
            createSession('s-1', trainer.id, '2026-03-16T09:00:00.000Z', '2026-03-16T11:00:00.000Z'),
            createSession('s-2', trainer.id, '2026-03-16T09:05:00.000Z', '2026-03-16T11:05:00.000Z'),
            createSession('s-3', trainer.id, '2026-03-16T09:10:00.000Z', '2026-03-16T11:10:00.000Z'),
            createSession('s-4', trainer.id, '2026-03-16T09:15:00.000Z', '2026-03-16T11:15:00.000Z'),
            createSession('s-5', trainer.id, '2026-03-16T09:20:00.000Z', '2026-03-16T11:20:00.000Z'),
        ]
        const scheduler = new TrainerScheduler([trainer], overlappingSessions, [createCourse()])

        const result = scheduler.autoScheduleSessions(createConstraints())

        expect(result.success).toBe(false)
        expect(result.sessions).toEqual([])
        expect(result.conflicts.some((conflict) => conflict.message.includes('Best match trainer "Avery" is unavailable'))).toBe(true)
    })

    it.each([
        ['daily', '2026-03-19T00:00:00.000Z'],
        ['monthly', '2026-05-20T00:00:00.000Z']
    ] as const)('supports %s recurrence scheduling', (frequency, endDate) => {
        const trainer = createTrainer('trainer-available', 'Avery', ['Forklift'])
        const scheduler = new TrainerScheduler([trainer], [], [createCourse()])

        const result = scheduler.autoScheduleSessions(
            createConstraints({
                recurrence: {
                    frequency,
                    endDate
                }
            })
        )

        expect(result.success).toBe(true)
        expect(result.sessions).toHaveLength(3)
    })

    it('excludes requested trainers when suggesting alternatives', () => {
        const trainerA = createTrainer('trainer-a', 'Avery', ['Forklift'])
        const trainerB = createTrainer('trainer-b', 'Blake', ['Forklift'])
        const trainerMissing = createTrainer('trainer-c', 'Casey', ['Hazmat'])
        const scheduler = new TrainerScheduler([trainerA, trainerB, trainerMissing], [], [createCourse()])

        const alternatives = scheduler.findAlternativeTrainers(
            createConstraints(),
            new Date('2026-03-16T00:00:00.000Z'),
            [trainerA.id]
        )

        expect(alternatives).toHaveLength(1)
        expect(alternatives[0].trainer.id).toBe(trainerB.id)
    })

    it('reports feasibility issues for certification and shift mismatches', () => {
        const dayShiftTrainer = {
            ...createTrainer('trainer-a', 'Avery', ['Forklift']),
            shifts: ['day']
        } as unknown as User
        const scheduler = new TrainerScheduler([dayShiftTrainer], [], [createCourse()])

        const feasibility = scheduler.analyzeSchedulingFeasibility({
            ...createConstraints({
                requiredCertifications: ['Hazmat'],
                dates: [
                    '2026-03-16T00:00:00.000Z',
                    '2026-03-17T00:00:00.000Z',
                    '2026-03-18T00:00:00.000Z',
                    '2026-03-19T00:00:00.000Z'
                ]
            }),
            shifts: ['evening']
        } as unknown as SchedulingConstraints)

        expect(feasibility.feasible).toBe(false)
        expect(feasibility.issues).toContain('No trainers have the required certifications')
        expect(feasibility.issues).toContain('Too many sessions for available trainer capacity')
    })

    it('reports shift mismatch issues when certified trainers exist but do not match required shifts', () => {
        const dayShiftTrainer = {
            ...createTrainer('trainer-a', 'Avery', ['Forklift']),
            shifts: ['day']
        } as unknown as User
        const scheduler = new TrainerScheduler([dayShiftTrainer], [], [createCourse()])

        const feasibility = scheduler.analyzeSchedulingFeasibility({
            ...createConstraints({ requiredCertifications: ['Forklift'] }),
            shifts: ['night']
        } as unknown as SchedulingConstraints)

        expect(feasibility.feasible).toBe(false)
        expect(feasibility.availableTrainerCount).toBe(0)
        expect(feasibility.issues).toContain('Certified trainers do not work the required shifts')
        expect(feasibility.suggestions).toContain('Adjust shift requirements or trainer schedules')
    })

    it('returns feasible when certified trainers satisfy required shifts and capacity', () => {
        const dayShiftTrainer = {
            ...createTrainer('trainer-a', 'Avery', ['Forklift']),
            shifts: ['day']
        } as unknown as User
        const scheduler = new TrainerScheduler([dayShiftTrainer], [], [createCourse()])

        const feasibility = scheduler.analyzeSchedulingFeasibility({
            ...createConstraints({
                requiredCertifications: ['Forklift'],
                dates: ['2026-03-16T00:00:00.000Z']
            }),
            shifts: ['day']
        } as unknown as SchedulingConstraints)

        expect(feasibility.feasible).toBe(true)
        expect(feasibility.availableTrainerCount).toBe(1)
        expect(feasibility.issues).toEqual([])
    })

    it('calculates trainer workload by shift within a date interval', () => {
        const trainer = createTrainer('trainer-a', 'Avery', ['Forklift'])
        const sessions = [
            { ...createSession('session-1', trainer.id, '2026-03-16T09:00:00.000Z', '2026-03-16T11:00:00.000Z'), shift: 'day' },
            { ...createSession('session-2', trainer.id, '2026-03-17T18:00:00.000Z', '2026-03-17T20:00:00.000Z'), shift: 'evening' },
            { ...createSession('session-3', trainer.id, '2026-03-18T23:00:00.000Z', '2026-03-19T01:00:00.000Z'), shift: 'night' },
            { ...createSession('session-4', trainer.id, '2026-03-20T09:00:00.000Z', '2026-03-20T11:00:00.000Z'), status: 'cancelled', shift: 'day' },
            { ...createSession('session-5', trainer.id, '2026-04-01T09:00:00.000Z', '2026-04-01T11:00:00.000Z'), shift: 'day' }
        ] as unknown as Session[]
        const scheduler = new TrainerScheduler([trainer], sessions, [createCourse()])

        const workload = scheduler.getTrainerWorkload(
            trainer.id,
            new Date('2026-03-16T00:00:00.000Z'),
            new Date('2026-03-31T23:59:59.000Z')
        )

        expect(workload.totalSessions).toBe(3)
        expect(workload.scheduledHours).toBe(6)
        expect(workload.sessionsByShift).toEqual({
            day: 1,
            evening: 1,
            night: 1
        })
    })

    it('returns evening or night as the primary shift when day is not present', () => {
        const scheduler = new TrainerScheduler([], [], [createCourse()])

        expect((scheduler as any).getPrimaryShift(['evening'])).toBe('evening')
        expect((scheduler as any).getPrimaryShift(['night'])).toBe('night')
    })

    it('throws a clear error for invalid time strings', () => {
        const trainer = createTrainer('trainer-available', 'Avery', ['Forklift'])
        const scheduler = new TrainerScheduler([trainer], [], [createCourse()])

        expect(() => {
            scheduler.findAvailableTrainers(
                createConstraints({ startTime: '9am' as unknown as string }),
                new Date('2026-03-16T00:00:00.000Z')
            )
        }).toThrow('Invalid time format: "9am". Expected HH:MM in 24-hour format.')
    })

    it('returns no-valid-dates conflict when constraints contain no dates', () => {
        const trainer = createTrainer('trainer-available', 'Avery', ['Forklift'])
        const scheduler = new TrainerScheduler([trainer], [], [createCourse()])

        const result = scheduler.autoScheduleSessions(createConstraints({ dates: [] }))

        expect(result.success).toBe(false)
        expect(result.conflicts).toContainEqual(
            expect.objectContaining({
                type: 'no-trainers',
                message: 'No valid dates found for scheduling',
            })
        )
    })

    it('classifies missing-certification conflicts as unavailable in determineAvailability', () => {
        const scheduler = new TrainerScheduler([], [], [createCourse()])

        const availability = (scheduler as any).determineAvailability(100, ['Missing certifications: CPR'])

        expect(availability).toBe('unavailable')
    })

    it('handles overnight shift windows when checking detailed shift overlap', () => {
        const overnightTrainer = {
            ...createTrainer('trainer-overnight', 'Night Owl', ['Forklift']),
            trainerProfile: {
                ...createTrainer('trainer-overnight', 'Night Owl', ['Forklift']).trainerProfile,
                shiftSchedules: [{
                    shiftCode: 'NIGHT',
                    daysWorked: ['monday'],
                    startTime: '22:00',
                    endTime: '06:00',
                    totalHoursPerWeek: 40,
                }],
            },
        }
        const scheduler = new TrainerScheduler([overnightTrainer], [], [createCourse()])

        const detailed = (scheduler as any).checkDetailedShiftOverlap(
            overnightTrainer,
            new Date('2026-03-16T00:00:00.000Z'),
            '23:00',
            '23:30'
        )

        expect(detailed.hasOverlap).toBe(true)
    })
})
