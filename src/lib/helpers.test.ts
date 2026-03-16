import { describe, expect, it } from 'vitest'

import {
    calculateProgress,
    canAccessCourse,
    canAccessSession,
    checkScheduleConflict,
    findAvailableTrainers,
    formatDuration,
    hasPermission,
    hasConfiguredSchedule,
    getTrainersWithoutSchedules,
    calculateSessionDuration
} from './helpers'
import type { Session, User } from './types'

function createUser(overrides: Partial<User> = {}): User {
    return {
        id: 'user-1',
        name: 'Alex Admin',
        email: 'alex@example.com',
        role: 'admin',
        department: 'Operations',
        certifications: [],
        hireDate: '2020-01-01T00:00:00.000Z',
        ...overrides
    }
}

function createSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 'session-1',
        courseId: 'course-1',
        trainerId: 'trainer-1',
        title: 'Safety Training',
        startTime: '2026-03-16T09:00:00.000Z',
        endTime: '2026-03-16T11:00:00.000Z',
        location: 'Room A',
        capacity: 10,
        enrolledStudents: ['student-1', 'student-2'],
        status: 'scheduled',
        ...overrides
    }
}

describe('helpers', () => {
    describe('hasPermission', () => {
        it('grants admin all listed permissions', () => {
            expect(hasPermission('admin', 'view_all')).toBe(true)
            expect(hasPermission('admin', 'manage_users')).toBe(true)
            expect(hasPermission('admin', 'view_analytics')).toBe(true)
        })

        it('grants trainer only trainer-level permissions', () => {
            expect(hasPermission('trainer', 'create_session')).toBe(true)
            expect(hasPermission('trainer', 'manage_users')).toBe(false)
        })

        it('denies unknown permissions for all roles', () => {
            expect(hasPermission('admin', 'nonexistent_permission')).toBe(false)
            expect(hasPermission('employee', 'nonexistent_permission')).toBe(false)
        })

        it('denies known-but-unauthorized permissions for restricted roles', () => {
            expect(hasPermission('employee', 'view_all')).toBe(false)
        })
    })

    describe('canAccessCourse', () => {
        it('allows admin to access any course', () => {
            const admin = createUser({ role: 'admin' })
            expect(canAccessCourse(admin, 'someone-else')).toBe(true)
        })

        it('allows trainer to access only their own course', () => {
            const trainer = createUser({ id: 'trainer-1', role: 'trainer' })
            expect(canAccessCourse(trainer, 'trainer-1')).toBe(true)
            expect(canAccessCourse(trainer, 'trainer-2')).toBe(false)
        })

        it('denies employee access regardless (matching and non-matching IDs)', () => {
            const employee = createUser({ role: 'employee' })
            expect(canAccessCourse(employee, 'employee-id')).toBe(false)
            expect(canAccessCourse(employee, employee.id)).toBe(false)
        })
    })

    describe('canAccessSession', () => {
        it('allows admin to access any session', () => {
            const admin = createUser({ role: 'admin' })
            const session = createSession({ trainerId: 'someone-else' })
            expect(canAccessSession(admin, session)).toBe(true)
        })

        it('allows trainer to access their own session', () => {
            const trainer = createUser({ id: 'trainer-1', role: 'trainer' })
            const session = createSession({ trainerId: 'trainer-1' })
            expect(canAccessSession(trainer, session)).toBe(true)
        })

        it('allows enrolled employee to access a session', () => {
            const student = createUser({ id: 'student-1', role: 'employee' })
            const session = createSession({ enrolledStudents: ['student-1'] })
            expect(canAccessSession(student, session)).toBe(true)
        })

        it('denies non-enrolled employee access to a session', () => {
            const stranger = createUser({ id: 'stranger', role: 'employee' })
            expect(canAccessSession(stranger, createSession())).toBe(false)
        })
    })

    describe('findAvailableTrainers', () => {
        const users = [
            createUser({ id: 't-1', role: 'trainer', certifications: ['Forklift', 'Safety'] }),
            createUser({ id: 't-2', role: 'trainer', certifications: ['Hazmat'] }),
            createUser({ id: 't-3', role: 'employee', certifications: ['Forklift'] }),
        ]

        it('returns trainers who hold all required certifications', () => {
            const result = findAvailableTrainers(users, ['Forklift'])
            expect(result.map(u => u.id)).toEqual(['t-1'])
        })

        it('returns empty when no trainer satisfies multi-cert requirement', () => {
            expect(findAvailableTrainers(users, ['Forklift', 'Hazmat'])).toHaveLength(0)
        })

        it('excludes explicitly listed trainer IDs', () => {
            expect(findAvailableTrainers(users, ['Forklift'], ['t-1'])).toHaveLength(0)
        })

        it('returns all trainers when requiredCertifications is empty', () => {
            const result = findAvailableTrainers(users, [])
            expect(result.map(u => u.id)).toEqual(['t-1', 't-2'])
        })

        it('respects exclusions when requiredCertifications is empty', () => {
            const result = findAvailableTrainers(users, [], ['t-1'])
            expect(result.map(u => u.id)).toEqual(['t-2'])
        })
    })

    describe('checkScheduleConflict', () => {
        const user = createUser({ id: 'trainer-1', role: 'trainer' })
        const existing = createSession({
            trainerId: 'trainer-1',
            startTime: '2026-03-16T09:00:00.000Z',
            endTime: '2026-03-16T11:00:00.000Z'
        })

        it('detects overlap when new session starts inside an existing session', () => {
            expect(checkScheduleConflict(user, [existing], {
                startTime: '2026-03-16T10:00:00.000Z',
                endTime: '2026-03-16T12:00:00.000Z'
            })).toBe(true)
        })

        it('detects overlap when new session completely wraps an existing session', () => {
            expect(checkScheduleConflict(user, [existing], {
                startTime: '2026-03-16T08:00:00.000Z',
                endTime: '2026-03-16T12:00:00.000Z'
            })).toBe(true)
        })

        it('detects overlap when new session ends inside an existing session', () => {
            expect(checkScheduleConflict(user, [existing], {
                startTime: '2026-03-16T08:00:00.000Z',
                endTime: '2026-03-16T10:00:00.000Z'
            })).toBe(true)
        })

        it('detects overlap when new session is fully contained inside an existing session', () => {
            expect(checkScheduleConflict(user, [existing], {
                startTime: '2026-03-16T09:30:00.000Z',
                endTime: '2026-03-16T10:30:00.000Z'
            })).toBe(true)
        })

        it('returns false when sessions are contiguous but non-overlapping', () => {
            expect(checkScheduleConflict(user, [existing], {
                startTime: '2026-03-16T11:00:00.000Z',
                endTime: '2026-03-16T13:00:00.000Z'
            })).toBe(false)
        })

        it('returns false when a new session ends exactly as an existing session starts', () => {
            expect(checkScheduleConflict(user, [existing], {
                startTime: '2026-03-16T07:00:00.000Z',
                endTime: '2026-03-16T09:00:00.000Z'
            })).toBe(false)
        })

        it('returns false when there are no existing sessions', () => {
            expect(checkScheduleConflict(user, [], {
                startTime: '2026-03-16T09:00:00.000Z',
                endTime: '2026-03-16T11:00:00.000Z'
            })).toBe(false)
        })

        it('ignores sessions belonging to other trainers', () => {
            const otherTrainerSession = createSession({
                trainerId: 'trainer-2',
                startTime: '2026-03-16T09:00:00.000Z',
                endTime: '2026-03-16T11:00:00.000Z'
            })
            expect(checkScheduleConflict(user, [otherTrainerSession], {
                startTime: '2026-03-16T09:30:00.000Z',
                endTime: '2026-03-16T10:30:00.000Z'
            })).toBe(false)
        })
    })

    describe('calculateProgress', () => {
        it('returns 0 when total modules is 0', () => {
            expect(calculateProgress(5, 0)).toBe(0)
        })

        it('returns 100 for full completion', () => {
            expect(calculateProgress(10, 10)).toBe(100)
        })

        it('rounds to nearest integer', () => {
            expect(calculateProgress(1, 3)).toBe(33)
        })

        it('rounds up when fractional progress is above .5', () => {
            expect(calculateProgress(2, 3)).toBe(67)
        })
    })

    describe('formatDuration', () => {
        it('formats zero duration', () => {
            expect(formatDuration(0)).toBe('0m')
        })

        it('formats minutes-only durations', () => {
            expect(formatDuration(45)).toBe('45m')
        })

        it('formats hours-only durations', () => {
            expect(formatDuration(120)).toBe('2h')
        })

        it('formats mixed hours and minutes', () => {
            expect(formatDuration(90)).toBe('1h 30m')
        })
    })

    describe('calculateSessionDuration', () => {
        it('returns positive duration in hours for normal sessions', () => {
            const start = new Date('2026-03-16T09:00:00.000Z')
            const end = new Date('2026-03-16T11:00:00.000Z')
            expect(calculateSessionDuration(start, end)).toBe(2)
        })

        it('handles sessions spanning midnight', () => {
            const start = new Date('2026-03-16T23:00:00.000Z')
            const end = new Date('2026-03-17T01:00:00.000Z')
            expect(calculateSessionDuration(start, end)).toBe(2)
        })

        it('returns 0 when start and end are identical', () => {
            const start = new Date('2026-03-16T09:00:00.000Z')
            expect(calculateSessionDuration(start, start)).toBe(0)
        })

        it('handles end before start by treating the gap as a next-day wraparound', () => {
            const start = new Date('2026-03-16T11:00:00.000Z')
            const end = new Date('2026-03-16T09:00:00.000Z')
            expect(calculateSessionDuration(start, end)).toBe(22)
        })
    })

    describe('hasConfiguredSchedule / getTrainersWithoutSchedules', () => {
        it('returns true when trainer has at least one shift schedule', () => {
            const trainer = createUser({
                role: 'trainer',
                trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [{ shiftCode: 'DAY', daysWorked: [], startTime: '08:00', endTime: '17:00', totalHoursPerWeek: 40 }],
                    tenure: { hireDate: '2020-01-01T00:00:00.000Z', yearsOfService: 6, monthsOfService: 72 },
                    specializations: []
                }
            })
            expect(hasConfiguredSchedule(trainer)).toBe(true)
        })

        it('returns false when trainer has no shift schedules', () => {
            const trainer = createUser({ role: 'trainer' })
            expect(hasConfiguredSchedule(trainer)).toBe(false)
        })

        it('getTrainersWithoutSchedules only returns trainers missing shifts', () => {
            const configured = createUser({
                id: 't-configured', role: 'trainer', trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [{ shiftCode: 'DAY', daysWorked: [], startTime: '08:00', endTime: '17:00', totalHoursPerWeek: 40 }],
                    tenure: { hireDate: '2020-01-01T00:00:00.000Z', yearsOfService: 6, monthsOfService: 72 },
                    specializations: []
                }
            })
            const unconfigured = createUser({ id: 't-unconfigured', role: 'trainer' })
            const admin = createUser({ role: 'admin' })

            const result = getTrainersWithoutSchedules([configured, unconfigured, admin])
            expect(result.map(u => u.id)).toEqual(['t-unconfigured'])
        })

        it('treats an empty shift schedule array as unconfigured', () => {
            const trainer = createUser({
                id: 't-empty',
                role: 'trainer',
                trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [],
                    tenure: { hireDate: '2020-01-01T00:00:00.000Z', yearsOfService: 6, monthsOfService: 72 },
                    specializations: []
                }
            })

            expect(hasConfiguredSchedule(trainer)).toBe(false)
            expect(getTrainersWithoutSchedules([trainer]).map(u => u.id)).toEqual(['t-empty'])
        })
    })
})
