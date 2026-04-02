import { addDays } from 'date-fns'

import {
    buildLearningDeadlineInsights,
    DEFAULT_TARGET_COMPLETION_DAYS,
    resolveEnrollmentTargetDate,
} from './learning-deadlines'
import type { Course, Enrollment } from './types'

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
    {
        id: 'course-2',
        title: 'Leadership Basics',
        description: 'Leadership skills',
        modules: ['Intro'],
        duration: 75,
        certifications: [],
        createdBy: 'admin-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        published: true,
        passScore: 80,
    },
]

describe('learning-deadlines', () => {
    describe('resolveEnrollmentTargetDate', () => {
        it('uses explicit targetCompletionDate when provided and valid', () => {
            const enrollment: Enrollment = {
                id: 'enrollment-1',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'in-progress',
                progress: 35,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                targetCompletionDate: '2026-03-20T00:00:00.000Z',
            }

            expect(resolveEnrollmentTargetDate(enrollment).toISOString()).toBe('2026-03-20T00:00:00.000Z')
        })

        it('derives target date from enrolledAt when explicit target is missing', () => {
            const enrollment: Enrollment = {
                id: 'enrollment-2',
                userId: 'user-2',
                courseId: 'course-1',
                status: 'enrolled',
                progress: 0,
                enrolledAt: '2026-03-01T00:00:00.000Z',
            }

            const expectedDate = addDays(new Date('2026-03-01T00:00:00.000Z'), 30).toISOString()
            expect(resolveEnrollmentTargetDate(enrollment).toISOString()).toBe(expectedDate)
        })

        it('falls back to default horizon when explicit target is invalid', () => {
            const enrollment: Enrollment = {
                id: 'enrollment-3',
                userId: 'user-3',
                courseId: 'course-1',
                status: 'enrolled',
                progress: 0,
                enrolledAt: '2026-03-01T00:00:00.000Z',
                targetCompletionDate: 'invalid-date',
            }

            const expectedDate = addDays(new Date('2026-03-01T00:00:00.000Z'), 30).toISOString()
            expect(resolveEnrollmentTargetDate(enrollment).toISOString()).toBe(expectedDate)
        })

        it('uses provided baseDate when both targetCompletionDate and enrolledAt are invalid', () => {
            const enrollment: Enrollment = {
                id: 'enrollment-invalid-dates',
                userId: 'user-9',
                courseId: 'course-1',
                status: 'enrolled',
                progress: 0,
                enrolledAt: 'invalid-enrolled-at',
                targetCompletionDate: 'invalid-target-date',
            }

            const now = new Date('2026-04-01T00:00:00.000Z')
            const expectedDate = addDays(now, 30).toISOString()
            expect(resolveEnrollmentTargetDate(enrollment, 30, now).toISOString()).toBe(expectedDate)
        })
    })

    describe('buildLearningDeadlineInsights', () => {
        it('classifies overdue and due-soon enrollments', () => {
            const now = new Date('2026-04-01T00:00:00.000Z')
            const enrollments: Enrollment[] = [
                {
                    id: 'overdue-enrollment',
                    userId: 'user-1',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 25,
                    enrolledAt: '2026-02-01T00:00:00.000Z',
                    targetCompletionDate: '2026-03-20T00:00:00.000Z',
                },
                {
                    id: 'due-soon-enrollment',
                    userId: 'user-2',
                    courseId: 'course-2',
                    status: 'enrolled',
                    progress: 5,
                    enrolledAt: '2026-03-01T00:00:00.000Z',
                    targetCompletionDate: '2026-04-06T00:00:00.000Z',
                },
            ]

            const insights = buildLearningDeadlineInsights(enrollments, courses, now)

            expect(insights).toHaveLength(2)
            expect(insights[0].enrollmentId).toBe('overdue-enrollment')
            expect(insights[0].urgency).toBe('overdue')
            expect(insights[0].daysUntilDue).toBeLessThan(0)
            expect(insights[1].enrollmentId).toBe('due-soon-enrollment')
            expect(insights[1].urgency).toBe('due-soon')
            expect(insights[1].daysUntilDue).toBe(5)
        })

        it('returns an empty list when enrollments are empty', () => {
            expect(buildLearningDeadlineInsights([], courses, new Date('2026-04-01T00:00:00.000Z'))).toEqual([])
        })

        it('returns an empty list when courses are empty', () => {
            const enrollments: Enrollment[] = [
                {
                    id: 'active-enrollment',
                    userId: 'user-1',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 25,
                    enrolledAt: '2026-03-01T00:00:00.000Z',
                    targetCompletionDate: '2026-04-10T00:00:00.000Z',
                },
            ]

            expect(buildLearningDeadlineInsights(enrollments, [], new Date('2026-04-01T00:00:00.000Z'))).toEqual([])
        })

        it('classifies enrollments as due-soon with zero days when due today', () => {
            const now = new Date('2026-04-01T00:00:00.000Z')
            const enrollments: Enrollment[] = [
                {
                    id: 'due-today-enrollment',
                    userId: 'user-1',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 55,
                    enrolledAt: '2026-03-15T00:00:00.000Z',
                    targetCompletionDate: '2026-04-01T00:00:00.000Z',
                },
            ]

            const insights = buildLearningDeadlineInsights(enrollments, courses, now)
            expect(insights).toHaveLength(1)
            expect(insights[0].daysUntilDue).toBe(0)
            expect(insights[0].urgency).toBe('due-soon')
        })

        it('treats same-day passed times as due-soon, not overdue', () => {
            const now = new Date('2026-04-02T08:00:00')
            const enrollments: Enrollment[] = [
                {
                    id: 'same-day-target',
                    userId: 'user-1',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 55,
                    enrolledAt: '2026-03-15T00:00:00.000Z',
                    targetCompletionDate: '2026-04-02T00:01:00',
                },
            ]

            const insights = buildLearningDeadlineInsights(enrollments, courses, now)
            expect(insights).toHaveLength(1)
            expect(insights[0].daysUntilDue).toBe(0)
            expect(insights[0].isOverdue).toBe(false)
            expect(insights[0].urgency).toBe('due-soon')
        })

        it('includes only active enrollment statuses with known courses', () => {
            const now = new Date('2026-04-01T00:00:00.000Z')
            const enrollments: Enrollment[] = [
                {
                    id: 'active-known-course',
                    userId: 'user-1',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 45,
                    enrolledAt: '2026-03-20T00:00:00.000Z',
                },
                {
                    id: 'completed-known-course',
                    userId: 'user-2',
                    courseId: 'course-1',
                    status: 'completed',
                    progress: 100,
                    enrolledAt: '2026-02-15T00:00:00.000Z',
                    completedAt: '2026-03-01T00:00:00.000Z',
                },
                {
                    id: 'active-missing-course',
                    userId: 'user-3',
                    courseId: 'missing-course',
                    status: 'in-progress',
                    progress: 10,
                    enrolledAt: '2026-03-25T00:00:00.000Z',
                },
            ]

            const insights = buildLearningDeadlineInsights(enrollments, courses, now)
            expect(insights.map((insight) => insight.enrollmentId)).toEqual(['active-known-course'])
            expect(insights[0].targetCompletionDate).toBe('2026-04-19T00:00:00.000Z')
        })

        it('uses the configured default target horizon', () => {
            expect(DEFAULT_TARGET_COMPLETION_DAYS).toBe(30)
        })
    })
})
