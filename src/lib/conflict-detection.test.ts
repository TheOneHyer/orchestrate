import { describe, expect, it } from 'vitest'

import {
    checkSessionConflicts,
    checkStudentEnrollmentConflicts,
    formatConflictMessage
} from './conflict-detection'
import type { Session, User } from './types'

function createUser(id: string, name: string): User {
    return {
        id,
        name,
        email: `${id}@example.com`,
        role: 'employee',
        department: 'Operations',
        certifications: [],
        hireDate: '2025-01-01T00:00:00.000Z'
    }
}

function createSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 'session-dragged',
        courseId: 'course-1',
        trainerId: 'trainer-1',
        title: 'Dragged Session',
        startTime: '2026-03-16T09:00:00.000Z',
        endTime: '2026-03-16T11:00:00.000Z',
        location: 'Room A',
        capacity: 12,
        enrolledStudents: ['student-1', 'student-2', 'student-3', 'student-4'],
        status: 'scheduled',
        ...overrides
    }
}

describe('conflict-detection', () => {
    describe('checkSessionConflicts', () => {
        it('detects trainer, room, and student conflicts for overlapping sessions', () => {
            const users = [
                createUser('student-1', 'Alex'),
                createUser('student-2', 'Bailey'),
                createUser('student-3', 'Casey'),
                createUser('student-4', 'Devon')
            ]
            const draggedSession = createSession()
            const conflictingSession = createSession({
                id: 'session-existing',
                title: 'Existing Session',
            })

            const result = checkSessionConflicts(
                draggedSession,
                new Date('2026-03-16T09:30:00.000Z'),
                new Date('2026-03-16T11:30:00.000Z'),
                [draggedSession, conflictingSession],
                users
            )

            expect(result.hasConflicts).toBe(true)
            expect(result.conflicts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'trainer' }),
                    expect.objectContaining({ type: 'room' }),
                    expect.objectContaining({ type: 'student' })
                ])
            )
            const studentConflict = result.conflicts.find(conflict => conflict.type === 'student')
            expect(studentConflict).toBeDefined()
            expect(studentConflict!.message).toContain('Alex, Bailey, Casey, and 1 more')
        })

        it('returns no conflicts when target time does not overlap existing sessions', () => {
            const users = [createUser('student-1', 'Alex')]
            const draggedSession = createSession()
            const nonOverlappingSession = createSession({
                id: 'session-existing',
                title: 'Existing Session',
                startTime: '2026-03-16T12:00:00.000Z',
                endTime: '2026-03-16T14:00:00.000Z'
            })

            const result = checkSessionConflicts(
                draggedSession,
                new Date('2026-03-16T09:00:00.000Z'),
                new Date('2026-03-16T11:00:00.000Z'),
                [draggedSession, nonOverlappingSession],
                users
            )

            expect(result.hasConflicts).toBe(false)
            expect(result.conflicts).toEqual([])
        })

        it('uses singular wording and unknown fallback for a single conflicting student', () => {
            const draggedSession = createSession({
                trainerId: 'trainer-1',
                location: 'Room A',
                enrolledStudents: ['student-missing']
            })
            const conflictingSession = createSession({
                id: 'session-existing',
                trainerId: 'trainer-2',
                location: 'Room B',
                enrolledStudents: ['student-missing']
            })

            const result = checkSessionConflicts(
                draggedSession,
                new Date('2026-03-16T09:00:00.000Z'),
                new Date('2026-03-16T10:00:00.000Z'),
                [draggedSession, conflictingSession],
                []
            )

            const studentConflict = result.conflicts.find(conflict => conflict.type === 'student')
            expect(studentConflict).toBeDefined()
            expect(studentConflict!.message).toContain('1 student is already enrolled')
            expect(studentConflict!.message).toContain('Unknown')
        })

        it('skips room conflicts when dragged session location is empty', () => {
            const draggedSession = createSession({
                location: '',
                enrolledStudents: [],
                trainerId: 'trainer-1'
            })
            const conflictingSession = createSession({
                id: 'session-existing',
                location: 'Room A',
                trainerId: 'trainer-2',
                enrolledStudents: []
            })

            const result = checkSessionConflicts(
                draggedSession,
                new Date('2026-03-16T09:30:00.000Z'),
                new Date('2026-03-16T10:30:00.000Z'),
                [draggedSession, conflictingSession],
                []
            )

            expect(result.conflicts.find(conflict => conflict.type === 'room')).toBeUndefined()
        })

        it('detects overlap when the dragged session ends during an existing session', () => {
            const draggedSession = createSession({
                trainerId: 'trainer-1',
                location: 'Room A',
                enrolledStudents: []
            })
            const conflictingSession = createSession({
                id: 'session-existing',
                title: 'Existing Session',
                trainerId: 'trainer-1',
                location: 'Room B',
                startTime: '2026-03-16T10:00:00.000Z',
                endTime: '2026-03-16T12:00:00.000Z',
                enrolledStudents: []
            })

            const result = checkSessionConflicts(
                draggedSession,
                new Date('2026-03-16T09:00:00.000Z'),
                new Date('2026-03-16T10:30:00.000Z'),
                [draggedSession, conflictingSession],
                []
            )

            expect(result.conflicts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'trainer', conflictingSessionId: 'session-existing' })
                ])
            )
        })
    })

    describe('formatConflictMessage', () => {
        it('formats mixed conflict severities into grouped text', () => {
            const message = formatConflictMessage([
                {
                    type: 'trainer',
                    severity: 'error',
                    message: 'Trainer is already scheduled',
                    conflictingSessionId: 'session-1',
                    conflictingSessionTitle: 'Morning Session'
                },
                {
                    type: 'room',
                    severity: 'warning',
                    message: 'Room is near capacity',
                    conflictingSessionId: 'session-2',
                    conflictingSessionTitle: 'Afternoon Session'
                }
            ])

            expect(message).toContain('Cannot move session:')
            expect(message).toContain('Trainer is already scheduled')
            expect(message).toContain('Warnings:')
            expect(message).toContain('Room is near capacity')
        })

        it('formats warning-only conflict sets without an error header', () => {
            const message = formatConflictMessage([
                {
                    type: 'room',
                    severity: 'warning',
                    message: 'Room is near capacity',
                    conflictingSessionId: 'session-2',
                    conflictingSessionTitle: 'Afternoon Session'
                }
            ])

            expect(message).not.toContain('Cannot move session:')
            expect(message).toContain('Warnings:')
            expect(message).toContain('Room is near capacity')
        })

        it('returns an empty message when there are no conflicts to format', () => {
            expect(formatConflictMessage([])).toBe('')
        })
    })

    describe('checkStudentEnrollmentConflicts', () => {
        it('returns allowed students separately from enrollment conflicts', () => {
            const users = [createUser('student-1', 'Alex'), createUser('student-2', 'Bailey')]
            const targetSession = createSession({
                enrolledStudents: []
            })
            const existingSession = createSession({
                id: 'session-existing',
                title: 'Existing Session',
                trainerId: 'trainer-2',
                enrolledStudents: ['student-1']
            })

            const result = checkStudentEnrollmentConflicts(
                targetSession,
                ['student-1', 'student-2'],
                [targetSession, existingSession],
                users
            )

            expect(result.hasConflicts).toBe(true)
            expect(result.allowedStudents).toEqual(['student-2'])
            expect(result.conflicts).toHaveLength(1)
            expect(result.conflicts[0].message).toContain('Alex is already enrolled in "Existing Session"')
        })

        it('returns all requested students as allowed when there are no enrollment conflicts', () => {
            const users = [createUser('student-1', 'Alex'), createUser('student-2', 'Bailey')]
            const targetSession = createSession({ enrolledStudents: [] })
            const nonOverlappingSession = createSession({
                id: 'session-existing',
                title: 'Existing Session',
                trainerId: 'trainer-2',
                startTime: '2026-03-16T12:00:00.000Z',
                endTime: '2026-03-16T14:00:00.000Z',
                enrolledStudents: ['student-1']
            })

            const result = checkStudentEnrollmentConflicts(
                targetSession,
                ['student-1', 'student-2'],
                [targetSession, nonOverlappingSession],
                users
            )

            expect(result.hasConflicts).toBe(false)
            expect(result.conflicts).toEqual([])
            expect(result.allowedStudents).toEqual(['student-1', 'student-2'])
        })

        it('uses the unknown-student fallback when a user record cannot be found', () => {
            const targetSession = createSession({ enrolledStudents: [] })
            const overlappingSession = createSession({
                id: 'session-existing',
                title: 'Existing Session',
                trainerId: 'trainer-2',
                enrolledStudents: ['student-missing']
            })

            const result = checkStudentEnrollmentConflicts(
                targetSession,
                ['student-missing'],
                [targetSession, overlappingSession],
                []
            )

            expect(result.conflicts[0]?.studentName).toBe('Unknown Student')
            expect(result.conflicts[0]?.message).toContain('Unknown Student is already enrolled')
        })

        it('detects overlap when the target session ends during another enrolled session', () => {
            const users = [createUser('student-1', 'Alex')]
            const targetSession = createSession({
                enrolledStudents: [],
                startTime: '2026-03-16T09:00:00.000Z',
                endTime: '2026-03-16T10:30:00.000Z'
            })
            const otherSession = createSession({
                id: 'session-existing',
                title: 'Existing Session',
                trainerId: 'trainer-2',
                startTime: '2026-03-16T10:00:00.000Z',
                endTime: '2026-03-16T12:00:00.000Z',
                enrolledStudents: ['student-1']
            })

            const result = checkStudentEnrollmentConflicts(
                targetSession,
                ['student-1'],
                [targetSession, otherSession],
                users
            )

            expect(result.hasConflicts).toBe(true)
            expect(result.allowedStudents).toEqual([])
            expect(result.conflicts[0]?.conflictingSession.id).toBe('session-existing')
        })

        it('detects overlap when the target session starts during another enrolled session', () => {
            const users = [createUser('student-1', 'Alex')]
            const targetSession = createSession({
                enrolledStudents: [],
                startTime: '2026-03-16T10:00:00.000Z',
                endTime: '2026-03-16T13:00:00.000Z'
            })
            const otherSession = createSession({
                id: 'session-existing',
                title: 'Existing Session',
                trainerId: 'trainer-2',
                startTime: '2026-03-16T09:00:00.000Z',
                endTime: '2026-03-16T12:00:00.000Z',
                enrolledStudents: ['student-1']
            })

            const result = checkStudentEnrollmentConflicts(
                targetSession,
                ['student-1'],
                [targetSession, otherSession],
                users
            )

            expect(result.hasConflicts).toBe(true)
            expect(result.allowedStudents).toEqual([])
            expect(result.conflicts[0]?.conflictingSession.id).toBe('session-existing')
        })

        it('does not treat exactly adjacent sessions as a conflict', () => {
            const users = [createUser('student-1', 'Alex')]
            const targetSession = createSession({ enrolledStudents: [] })
            const adjacentSession = createSession({
                id: 'session-existing',
                title: 'Existing Session',
                trainerId: 'trainer-2',
                startTime: '2026-03-16T11:00:00.000Z',
                endTime: '2026-03-16T12:00:00.000Z',
                enrolledStudents: ['student-1']
            })

            const result = checkStudentEnrollmentConflicts(
                targetSession,
                ['student-1'],
                [targetSession, adjacentSession],
                users
            )

            expect(result.hasConflicts).toBe(false)
            expect(result.allowedStudents).toEqual(['student-1'])
        })

        it('returns no conflicts when the requested student list is empty', () => {
            const targetSession = createSession({ enrolledStudents: [] })

            const result = checkStudentEnrollmentConflicts(targetSession, [], [targetSession], [])

            expect(result.hasConflicts).toBe(false)
            expect(result.conflicts).toEqual([])
            expect(result.allowedStudents).toEqual([])
        })

        it('does not enforce capacity limits (handled elsewhere)', () => {
            const users = [createUser('student-1', 'Alex')]
            const fullSession = createSession({ enrolledStudents: ['student-2'], capacity: 1 })

            const result = checkStudentEnrollmentConflicts(fullSession, ['student-1'], [fullSession], users)

            expect(result.hasConflicts).toBe(false)
            expect(result.allowedStudents).toEqual(['student-1'])
        })
    })
})
