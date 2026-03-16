import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    ensureAllTrainersHaveProfiles,
    generateTrainerProfile,
} from './trainer-profile-generator'
import type { User } from './types'

const SYSTEM_TIME = new Date('2026-03-16T12:00:00.000Z')

type ShiftKind = 'day' | 'evening' | 'night'
type TrainerWithShifts = Omit<User, 'role' | 'trainerProfile' | 'shifts'> & {
    role: 'trainer'
    shifts: ShiftKind[]
    trainerProfile?: User['trainerProfile']
}

function createTrainer(overrides: Partial<TrainerWithShifts> = {}): TrainerWithShifts {
    return {
        id: 'trainer-1',
        name: 'Taylor Trainer',
        email: 'taylor@example.com',
        role: 'trainer',
        department: 'Operations',
        certifications: ['Forklift Operator', 'First Aid'],
        hireDate: '2020-03-16T12:00:00.000Z',
        shifts: ['day'],
        ...overrides,
    }
}

function createEmployee(overrides: Partial<User> = {}): User {
    return {
        id: 'employee-1',
        name: 'Erin Employee',
        email: 'erin@example.com',
        role: 'employee',
        department: 'Operations',
        certifications: [],
        hireDate: '2024-01-01T00:00:00.000Z',
        ...overrides,
    }
}

describe('trainer-profile-generator', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(SYSTEM_TIME)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns non-trainer users unchanged', () => {
        const employee = createEmployee()

        const result = generateTrainerProfile(employee)

        expect(result).toBe(employee)
    })

    it('returns trainer unchanged when profile already exists', () => {
        const trainer = createTrainer({
            trainerProfile: {
                authorizedRoles: ['Team Lead'],
                shiftSchedules: [],
                tenure: {
                    hireDate: '2018-01-01T00:00:00.000Z',
                    yearsOfService: 8,
                    monthsOfService: 96,
                },
                specializations: ['CPR Certification'],
                maxWeeklyHours: 32,
            },
        })

        const result = generateTrainerProfile(trainer as unknown as User)

        expect(result).toBe(trainer)
    })

    it('generates a profile with tenure, shift schedules, and mapped specializations', () => {
        const trainer = createTrainer({ shifts: ['day', 'night'] })

        const result = generateTrainerProfile(trainer as unknown as User)

        expect(result.trainerProfile).toBeDefined()
        expect(result.trainerProfile?.tenure).toEqual({
            hireDate: '2020-03-16T12:00:00.000Z',
            yearsOfService: 6,
            monthsOfService: 72,
        })
        expect(result.trainerProfile?.shiftSchedules).toHaveLength(2)
        expect(result.trainerProfile?.shiftSchedules[0]).toMatchObject({
            shiftCode: 'DAY-A-1',
            shiftType: 'day',
            startTime: '08:00',
            endTime: '16:00',
            totalHoursPerWeek: 40,
        })
        expect(result.trainerProfile?.shiftSchedules[1]).toMatchObject({
            shiftCode: 'NIGHT-C-2',
            shiftType: 'night',
            startTime: '00:00',
            endTime: '08:00',
            totalHoursPerWeek: 40,
        })
        expect(result.trainerProfile?.authorizedRoles).toEqual(
            expect.arrayContaining([
                'Warehouse Associate',
                'Material Handler',
                'Forklift Operator',
                'Safety Officer',
                'Floor Supervisor',
                'Team Lead',
            ])
        )
        expect(result.trainerProfile?.specializations).toEqual(
            expect.arrayContaining([
                'Heavy Equipment Operation',
                'Warehouse Safety',
                'Emergency Medical Response',
                'CPR Certification',
            ])
        )
    })

    it('creates evening shift schedule with overnight time math', () => {
        const trainer = createTrainer({ shifts: ['evening'] })

        const result = generateTrainerProfile(trainer as unknown as User)

        expect(result.trainerProfile?.shiftSchedules[0]).toMatchObject({
            shiftCode: 'EVE-B-1',
            shiftType: 'evening',
            startTime: '16:00',
            endTime: '00:00',
            totalHoursPerWeek: 40,
        })
    })

    it('ensures all trainers in a user list get generated profiles', () => {
        const users: User[] = [
            createEmployee({ id: 'employee-1' }),
            createTrainer({ id: 'trainer-a', shifts: ['day'] }) as unknown as User,
            createTrainer({ id: 'trainer-b', shifts: ['night'] }) as unknown as User,
        ]

        const result = ensureAllTrainersHaveProfiles(users)

        expect(result).toHaveLength(3)
        expect(result[0].role).toBe('employee')
        expect(result[0].trainerProfile).toBeUndefined()
        expect(result[1].trainerProfile?.shiftSchedules[0].shiftCode).toContain('DAY-A')
        expect(result[2].trainerProfile?.shiftSchedules[0].shiftCode).toContain('NIGHT-C')
    })
})
