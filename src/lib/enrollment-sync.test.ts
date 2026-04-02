import type { Enrollment, Session } from './types'

import { reconcileSessionEnrollments } from './enrollment-sync'

describe('reconcileSessionEnrollments', () => {
    const nowIso = '2026-04-01T00:00:00.000Z'

    const buildSession = (overrides: Partial<Session>): Session => ({
        id: 'session-1',
        courseId: 'course-1',
        trainerId: 'trainer-1',
        title: 'Session',
        startTime: '2026-04-02T09:00:00.000Z',
        endTime: '2026-04-02T10:00:00.000Z',
        location: 'HQ',
        capacity: 20,
        enrolledStudents: [],
        status: 'scheduled',
        ...overrides,
    })

    it('creates session-linked enrollments with default target dates', () => {
        const sessions: Session[] = [
            buildSession({
                id: 'session-a',
                courseId: 'course-a',
                enrolledStudents: ['user-a'],
            }),
        ]

        const reconciled = reconcileSessionEnrollments({
            enrollments: [],
            sessions,
            nowIso,
            createEnrollmentId: () => 'enrollment-created',
        })

        expect(reconciled).toHaveLength(1)
        expect(reconciled[0]).toMatchObject({
            id: 'enrollment-created',
            userId: 'user-a',
            courseId: 'course-a',
            sessionId: 'session-a',
            status: 'enrolled',
            progress: 0,
            enrolledAt: nowIso,
            lastProgressAt: nowIso,
        })
        expect(reconciled[0].targetCompletionDate).toBe('2026-05-01T00:00:00.000Z')
    })

    it('backfills missing target dates on existing session enrollments', () => {
        const enrollments: Enrollment[] = [
            {
                id: 'existing-enrollment',
                userId: 'user-a',
                courseId: 'course-a',
                sessionId: 'session-a',
                status: 'in-progress',
                progress: 30,
                enrolledAt: '2026-03-15T00:00:00.000Z',
            },
        ]

        const sessions: Session[] = [
            buildSession({
                id: 'session-a',
                courseId: 'course-a',
                enrolledStudents: ['user-a'],
            }),
        ]

        const reconciled = reconcileSessionEnrollments({
            enrollments,
            sessions,
            nowIso,
            createEnrollmentId: () => 'unused-id',
        })

        expect(reconciled).toHaveLength(1)
        expect(reconciled[0].id).toBe('existing-enrollment')
        expect(reconciled[0].targetCompletionDate).toBe('2026-04-14T00:00:00.000Z')
    })

    it('removes stale active session enrollments not present in session rosters', () => {
        const enrollments: Enrollment[] = [
            {
                id: 'stale-enrollment',
                userId: 'user-stale',
                courseId: 'course-a',
                sessionId: 'session-a',
                status: 'in-progress',
                progress: 45,
                enrolledAt: '2026-03-15T00:00:00.000Z',
            },
        ]

        const sessions: Session[] = [
            buildSession({
                id: 'session-a',
                courseId: 'course-a',
                enrolledStudents: [],
            }),
        ]

        const reconciled = reconcileSessionEnrollments({
            enrollments,
            sessions,
            nowIso,
            createEnrollmentId: () => 'unused-id',
        })

        expect(reconciled).toEqual([])
    })

    it('preserves stale terminal session enrollments for history', () => {
        const enrollments: Enrollment[] = [
            {
                id: 'completed-enrollment',
                userId: 'user-finished',
                courseId: 'course-a',
                sessionId: 'session-a',
                status: 'completed',
                progress: 100,
                score: 95,
                enrolledAt: '2026-02-01T00:00:00.000Z',
                completedAt: '2026-03-01T00:00:00.000Z',
            },
        ]

        const sessions: Session[] = [
            buildSession({
                id: 'session-a',
                courseId: 'course-a',
                enrolledStudents: [],
            }),
        ]

        const reconciled = reconcileSessionEnrollments({
            enrollments,
            sessions,
            nowIso,
            createEnrollmentId: () => 'unused-id',
        })

        expect(reconciled).toHaveLength(1)
        expect(reconciled[0].id).toBe('completed-enrollment')
    })

    it('preserves non-session enrollments unchanged', () => {
        const enrollments: Enrollment[] = [
            {
                id: 'course-only-enrollment',
                userId: 'user-a',
                courseId: 'course-a',
                status: 'in-progress',
                progress: 60,
                enrolledAt: '2026-03-01T00:00:00.000Z',
            },
        ]

        const reconciled = reconcileSessionEnrollments({
            enrollments,
            sessions: [],
            nowIso,
            createEnrollmentId: () => 'unused-id',
        })

        expect(reconciled).toEqual(enrollments)
    })

    it('preserves all enrollments when sessions list is empty (guard against destructive reconciliation)', () => {
        const enrollments: Enrollment[] = [
            {
                id: 'session-backed-enrollment',
                userId: 'user-a',
                courseId: 'course-a',
                sessionId: 'session-a',
                status: 'in-progress',
                progress: 40,
                enrolledAt: '2026-03-01T00:00:00.000Z',
            },
            {
                id: 'non-session-enrollment',
                userId: 'user-b',
                courseId: 'course-b',
                status: 'enrolled',
                progress: 0,
                enrolledAt: '2026-03-15T00:00:00.000Z',
            },
        ]

        const reconciled = reconcileSessionEnrollments({
            enrollments,
            sessions: [],
            nowIso,
            createEnrollmentId: () => 'unused-id',
        })

        expect(reconciled).toEqual(enrollments)
    })

    it('backfills lastProgressAt for existing session enrollments that lack it', () => {
        const enrollments: Enrollment[] = [
            {
                id: 'existing-no-progress',
                userId: 'user-a',
                courseId: 'course-a',
                sessionId: 'session-a',
                status: 'in-progress',
                progress: 25,
                enrolledAt: '2026-03-10T00:00:00.000Z',
                targetCompletionDate: '2026-04-10T00:00:00.000Z',
            },
        ]

        const sessions: Session[] = [
            buildSession({
                id: 'session-a',
                courseId: 'course-a',
                enrolledStudents: ['user-a'],
            }),
        ]

        const reconciled = reconcileSessionEnrollments({
            enrollments,
            sessions,
            nowIso,
            createEnrollmentId: () => 'unused-id',
        })

        expect(reconciled).toHaveLength(1)
        expect(reconciled[0].lastProgressAt).toBe(nowIso)
    })

    it('preserves existing lastProgressAt when already set', () => {
        const enrollments: Enrollment[] = [
            {
                id: 'existing-with-progress',
                userId: 'user-a',
                courseId: 'course-a',
                sessionId: 'session-a',
                status: 'in-progress',
                progress: 50,
                enrolledAt: '2026-03-10T00:00:00.000Z',
                targetCompletionDate: '2026-04-10T00:00:00.000Z',
                lastProgressAt: '2026-03-25T00:00:00.000Z',
            },
        ]

        const sessions: Session[] = [
            buildSession({
                id: 'session-a',
                courseId: 'course-a',
                enrolledStudents: ['user-a'],
            }),
        ]

        const reconciled = reconcileSessionEnrollments({
            enrollments,
            sessions,
            nowIso,
            createEnrollmentId: () => 'unused-id',
        })

        expect(reconciled).toHaveLength(1)
        expect(reconciled[0].lastProgressAt).toBe('2026-03-25T00:00:00.000Z')
    })

    it('regenerates targetCompletionDate when existing value is invalid', () => {
        const enrollments: Enrollment[] = [
            {
                id: 'bad-target-enrollment',
                userId: 'user-a',
                courseId: 'course-a',
                sessionId: 'session-a',
                status: 'in-progress',
                progress: 10,
                enrolledAt: '2026-03-15T00:00:00.000Z',
                targetCompletionDate: 'not-a-date',
            },
        ]

        const sessions: Session[] = [
            buildSession({
                id: 'session-a',
                courseId: 'course-a',
                enrolledStudents: ['user-a'],
            }),
        ]

        const reconciled = reconcileSessionEnrollments({
            enrollments,
            sessions,
            nowIso,
            createEnrollmentId: () => 'unused-id',
        })

        expect(reconciled).toHaveLength(1)
        expect(reconciled[0].targetCompletionDate).toBe('2026-04-14T00:00:00.000Z')
    })
})
