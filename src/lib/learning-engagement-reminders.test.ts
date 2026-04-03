import { buildLearningEngagementReminderCandidates } from './learning-engagement-reminders'
import type { Course, Enrollment, Notification } from './types'

const courses: Course[] = [
    {
        id: 'course-1',
        title: 'Safety Foundations',
        description: 'Safety course',
        modules: ['Intro'],
        duration: 90,
        certifications: [],
        createdBy: 'admin-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        published: true,
        passScore: 80,
    },
]

describe('learning-engagement-reminders', () => {
    it('creates stalled and critical stalled reminder candidates', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-critical',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 30,
                enrolledAt: '2026-02-01T00:00:00.000Z',
                lastProgressAt: '2026-03-01T00:00:00.000Z',
            },
            {
                id: 'enrollment-stalled',
                userId: 'user-2',
                courseId: 'course-1',
                status: 'enrolled',
                progress: 0,
                enrolledAt: '2026-03-10T00:00:00.000Z',
                lastProgressAt: '2026-03-24T00:00:00.000Z',
            },
        ]

        const candidates = buildLearningEngagementReminderCandidates(enrollments, courses, [], now)

        expect(candidates).toHaveLength(2)
        expect(candidates[0].reminderKey).toBe('enrollment-critical:critical-stall')
        expect(candidates[0].priority).toBe('high')
        expect(candidates[1].reminderKey).toBe('enrollment-stalled:stalled')
        expect(candidates[1].priority).toBe('medium')
    })

    it('suppresses reminders that already exist in notification metadata', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-critical',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 30,
                enrolledAt: '2026-02-01T00:00:00.000Z',
                lastProgressAt: '2026-03-01T00:00:00.000Z',
            },
        ]

        const notifications: Notification[] = [
            {
                id: 'notification-1',
                userId: 'user-1',
                type: 'reminder',
                title: 'Critical Learning Stall — Safety Foundations',
                message: 'Already sent',
                read: false,
                createdAt: '2026-03-31T00:00:00.000Z',
                metadata: {
                    engagementReminderKey: 'enrollment-critical:critical-stall',
                },
            },
        ]

        const candidates = buildLearningEngagementReminderCandidates(enrollments, courses, notifications, now)
        expect(candidates).toEqual([])
    })

    it('does not generate engagement reminders without explicit progress timestamps', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-without-progress-time',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 30,
                enrolledAt: '2026-02-01T00:00:00.000Z',
            },
        ]

        const candidates = buildLearningEngagementReminderCandidates(enrollments, courses, [], now)
        expect(candidates).toEqual([])
    })

    it('does not generate engagement reminders for malformed progress timestamps', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-with-bad-progress-time',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 30,
                enrolledAt: '2026-02-01T00:00:00.000Z',
                lastProgressAt: 'not-a-date',
            },
        ]

        expect(buildLearningEngagementReminderCandidates(enrollments, courses, [], now)).toEqual([])
    })

    it('returns an empty array when enrollments are empty', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        expect(buildLearningEngagementReminderCandidates([], courses, [], now)).toEqual([])
    })

    it('skips enrollments that reference missing courses', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-missing-course',
                userId: 'user-1',
                courseId: 'missing-course',
                status: 'in-progress',
                progress: 10,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                lastProgressAt: '2026-03-01T00:00:00.000Z',
            },
        ]

        expect(buildLearningEngagementReminderCandidates(enrollments, courses, [], now)).toEqual([])
    })

    it('skips completed enrollments', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-completed',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'completed',
                progress: 100,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                completedAt: '2026-03-20T00:00:00.000Z',
                lastProgressAt: '2026-03-10T00:00:00.000Z',
            },
        ]

        expect(buildLearningEngagementReminderCandidates(enrollments, courses, [], now)).toEqual([])
    })

    it('handles boundary inactivity values at 6, 7, 13, and 30 days', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-seven-days',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 20,
                enrolledAt: '2026-03-20T00:00:00.000Z',
                lastProgressAt: '2026-03-25T00:00:00.000Z',
            },
            {
                id: 'enrollment-thirty-days',
                userId: 'user-2',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 10,
                enrolledAt: '2026-02-01T00:00:00.000Z',
                lastProgressAt: '2026-03-02T00:00:00.000Z',
            },
        ]

        const enrollmentsSixDays: Enrollment[] = [
            {
                id: 'enrollment-six-days',
                userId: 'user-3',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 15,
                enrolledAt: '2026-03-20T00:00:00.000Z',
                lastProgressAt: '2026-03-26T00:00:00.000Z',
            },
        ]

        const enrollmentsThirteenDays: Enrollment[] = [
            {
                id: 'enrollment-thirteen-days',
                userId: 'user-4',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 10,
                enrolledAt: '2026-02-01T00:00:00.000Z',
                lastProgressAt: '2026-03-19T00:00:00.000Z',
            },
        ]

        const candidates = buildLearningEngagementReminderCandidates(enrollments, courses, [], now)
        expect(candidates.find((candidate) => candidate.reminderKey === 'enrollment-seven-days:stalled')).toBeDefined()
        expect(candidates.find((candidate) => candidate.reminderKey === 'enrollment-thirty-days:critical-stall')).toBeDefined()

        const sixDayCandidates = buildLearningEngagementReminderCandidates(enrollmentsSixDays, courses, [], now)
        expect(sixDayCandidates.find((candidate) => candidate.reminderKey === 'enrollment-six-days:stalled')).toBeUndefined()

        const thirteenDayCandidates = buildLearningEngagementReminderCandidates(enrollmentsThirteenDays, courses, [], now)
        expect(thirteenDayCandidates.find((candidate) => candidate.reminderKey === 'enrollment-thirteen-days:stalled')).toBeDefined()
        expect(thirteenDayCandidates.find((candidate) => candidate.reminderKey === 'enrollment-thirteen-days:critical-stall')).toBeUndefined()
    })

    it('returns reminders for multiple enrollments with different stall severities', () => {
        const now = new Date('2026-04-01T00:00:00.000Z')
        const enrollments: Enrollment[] = [
            {
                id: 'enrollment-a',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 12,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                lastProgressAt: '2026-03-24T00:00:00.000Z',
            },
            {
                id: 'enrollment-b',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 5,
                enrolledAt: '2026-02-01T00:00:00.000Z',
                lastProgressAt: '2026-03-01T00:00:00.000Z',
            },
        ]

        const candidates = buildLearningEngagementReminderCandidates(enrollments, courses, [], now)
        expect(candidates).toHaveLength(2)
        expect(candidates.map((candidate) => candidate.reminderKey)).toEqual([
            'enrollment-b:critical-stall',
            'enrollment-a:stalled',
        ])
    })
})
