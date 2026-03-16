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
            enrolledStudents: ['student-1', 'student-2', 'student-3', 'student-4']
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
})
