import { buildLearningReminderCandidates } from './learning-reminders'
import type { Course, Enrollment, Notification } from './types'

const courses: Course[] = [
    {
        id: 'course-1',
        title: 'Safety Foundations',
        description: 'Core safety',
        modules: ['Intro'],
        duration: 90,
        certifications: [],
        createdBy: 'admin-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        published: true,
        passScore: 80,
    },
]

describe('learning-reminders', () => {
    it('creates due-soon and overdue reminder candidates with explicit targets', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-overdue',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 20,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                targetCompletionDate: '2026-03-20T00:00:00.000Z',
            },
            {
                id: 'enrollment-due-soon',
                userId: 'user-2',
                courseId: 'course-1',
                status: 'enrolled',
                progress: 0,
                enrolledAt: '2026-03-10T00:00:00.000Z',
                targetCompletionDate: '2026-04-06T00:00:00.000Z',
            },
        ]

        const candidates = buildLearningReminderCandidates(enrollments, courses, [], now)

        expect(candidates).toHaveLength(2)
        const overdueCandidate = candidates.find((candidate) => candidate.reminderKey === 'enrollment-overdue:overdue')
        const dueSoonCandidate = candidates.find((candidate) => candidate.reminderKey === 'enrollment-due-soon:due-soon')

        expect(overdueCandidate).toBeDefined()
        expect(overdueCandidate?.priority).toBe('high')
        expect(dueSoonCandidate).toBeDefined()
        expect(dueSoonCandidate?.priority).toBe('medium')
    })

    it('suppresses reminders that already exist in notification metadata', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-overdue',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 20,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                targetCompletionDate: '2026-03-20T00:00:00.000Z',
            },
        ]

        const existingNotifications: Notification[] = [
            {
                id: 'notification-1',
                userId: 'user-1',
                type: 'reminder',
                title: 'Overdue Training — Safety Foundations',
                message: 'Already sent',
                read: false,
                createdAt: '2026-03-21T00:00:00.000Z',
                metadata: { learningReminderKey: 'enrollment-overdue:overdue' },
            },
        ]

        const candidates = buildLearningReminderCandidates(enrollments, courses, existingNotifications, now)
        expect(candidates).toEqual([])
    })

    it('does not generate reminders for enrollments without explicit target dates', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-derived-target',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 5,
                enrolledAt: '2026-02-15T00:00:00.000Z',
            },
        ]

        const candidates = buildLearningReminderCandidates(enrollments, courses, [], now)
        expect(candidates).toEqual([])
    })

    it('generates due-soon reminder at the exact threshold boundary', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-threshold',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 15,
                score: 0,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                targetCompletionDate: '2026-04-08T00:00:00.000Z',
            },
        ]

        const candidates = buildLearningReminderCandidates(enrollments, courses, [], now)
        expect(candidates).toHaveLength(1)
        expect(candidates[0]).toMatchObject({
            reminderKey: 'enrollment-threshold:due-soon',
            priority: 'medium',
        })
    })

    it('skips enrollments with missing courses', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'missing-course-enrollment',
                userId: 'user-1',
                courseId: 'missing-course',
                status: 'in-progress',
                progress: 15,
                score: 0,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                targetCompletionDate: '2026-04-04T00:00:00.000Z',
            },
        ]

        expect(buildLearningReminderCandidates(enrollments, courses, [], now)).toEqual([])
    })

    it('skips completed and failed enrollments', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'completed-enrollment',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'completed',
                progress: 100,
                score: 90,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                completedAt: '2026-03-20T00:00:00.000Z',
                targetCompletionDate: '2026-04-01T00:00:00.000Z',
            },
            {
                id: 'failed-enrollment',
                userId: 'user-2',
                courseId: 'course-1',
                status: 'failed',
                progress: 100,
                score: 50,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                targetCompletionDate: '2026-04-01T00:00:00.000Z',
            },
        ]

        expect(buildLearningReminderCandidates(enrollments, courses, [], now)).toEqual([])
    })

    it('generates separate candidates for multiple valid enrollments and respects suppression keys', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-a',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 15,
                score: 0,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                targetCompletionDate: '2026-03-25T00:00:00.000Z',
            },
            {
                id: 'enrollment-b',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'enrolled',
                progress: 2,
                score: 0,
                enrolledAt: '2026-03-15T00:00:00.000Z',
                targetCompletionDate: '2026-04-05T00:00:00.000Z',
            },
        ]

        const existingNotifications: Notification[] = [
            {
                id: 'suppressed-a',
                userId: 'user-1',
                type: 'reminder',
                title: 'Already sent',
                message: 'Already sent',
                read: false,
                createdAt: '2026-03-30T00:00:00.000Z',
                metadata: { learningReminderKey: 'enrollment-a:overdue' },
            },
        ]

        const candidates = buildLearningReminderCandidates(enrollments, courses, existingNotifications, now)
        expect(candidates).toHaveLength(1)
        expect(candidates[0].reminderKey).toBe('enrollment-b:due-soon')
    })

    it('uses due-today message when target date is today', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-due-today',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 55,
                score: 0,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                targetCompletionDate: '2026-04-01T00:00:00.000Z',
            },
        ]

        const candidates = buildLearningReminderCandidates(enrollments, courses, [], now)
        expect(candidates).toHaveLength(1)
        expect(candidates[0].message).toMatch(/due today/i)
    })

    it('uses singular day wording for one-day overdue reminders', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-overdue-one-day',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 55,
                score: 0,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                targetCompletionDate: '2026-03-31T00:00:00.000Z',
            },
        ]

        const candidates = buildLearningReminderCandidates(enrollments, courses, [], now)
        expect(candidates).toHaveLength(1)
        expect(candidates[0].message).toContain('1 day overdue')
        expect(candidates[0].message).not.toContain('1 days overdue')
    })

    it('uses singular day wording for due-soon reminders in one day', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-due-in-one-day',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 55,
                score: 0,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                targetCompletionDate: '2026-04-02T00:00:00.000Z',
            },
        ]

        const candidates = buildLearningReminderCandidates(enrollments, courses, [], now)
        expect(candidates).toHaveLength(1)
        expect(candidates[0].message).toContain('due in 1 day')
        expect(candidates[0].message).not.toContain('due in 1 days')
    })
})
