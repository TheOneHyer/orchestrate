import { describe, expect, it } from 'vitest'

import { buildLearningFocusItems, classifyLearningRisk } from './learning-insights'
import type { Course, Enrollment } from './types'

const courses: Course[] = [
    {
        id: 'course-1',
        title: 'Safety Basics',
        description: 'Intro safety training',
        modules: ['Module 1'],
        duration: 90,
        certifications: [],
        createdBy: 'admin-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        published: true,
        passScore: 80,
    },
    {
        id: 'course-2',
        title: 'Quality Audits',
        description: 'Audit process essentials',
        modules: ['Module 1'],
        duration: 75,
        certifications: [],
        createdBy: 'admin-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        published: true,
        passScore: 80,
    },
]

describe('learning-insights', () => {
    describe('classifyLearningRisk', () => {
        it('returns at-risk for deeply stalled progress', () => {
            expect(classifyLearningRisk(20, 30)).toBe('at-risk')
        })

        it('returns watch when momentum is declining but recoverable', () => {
            expect(classifyLearningRisk(45, 20)).toBe('watch')
        })

        it('returns on-track when learner momentum is healthy', () => {
            expect(classifyLearningRisk(65, 10)).toBe('on-track')
        })

        it('handles boundary transitions around watch and at-risk thresholds', () => {
            expect(classifyLearningRisk(49, 14)).toBe('watch')
            expect(classifyLearningRisk(50, 14)).toBe('on-track')
            expect(classifyLearningRisk(24, 21)).toBe('at-risk')
            expect(classifyLearningRisk(25, 21)).toBe('watch')
            expect(classifyLearningRisk(49, 45)).toBe('at-risk')
            expect(classifyLearningRisk(50, 45)).toBe('watch')
            expect(classifyLearningRisk(79, 35)).toBe('watch')
            expect(classifyLearningRisk(80, 35)).toBe('on-track')
        })

        it('covers threshold edges for each risk clause', () => {
            expect(classifyLearningRisk(24, 20)).toBe('watch')
            expect(classifyLearningRisk(24, 21)).toBe('at-risk')
            expect(classifyLearningRisk(25, 20)).toBe('watch')
            expect(classifyLearningRisk(25, 21)).toBe('watch')

            expect(classifyLearningRisk(49, 13)).toBe('on-track')
            expect(classifyLearningRisk(49, 14)).toBe('watch')
            expect(classifyLearningRisk(49, 44)).toBe('watch')
            expect(classifyLearningRisk(49, 45)).toBe('at-risk')

            expect(classifyLearningRisk(79, 34)).toBe('on-track')
            expect(classifyLearningRisk(79, 35)).toBe('watch')
            expect(classifyLearningRisk(80, 35)).toBe('on-track')
        })
    })

    describe('buildLearningFocusItems', () => {
        const now = new Date('2026-04-01T12:00:00.000Z')

        it('builds sorted focus items for active enrollments only', () => {
            const enrollments: Enrollment[] = [
                {
                    id: 'enrollment-risk',
                    userId: 'learner-1',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 18,
                    enrolledAt: '2026-02-20T12:00:00.000Z',
                },
                {
                    id: 'enrollment-watch',
                    userId: 'learner-2',
                    courseId: 'course-2',
                    status: 'in-progress',
                    progress: 42,
                    enrolledAt: '2026-03-10T12:00:00.000Z',
                },
                {
                    id: 'enrollment-complete',
                    userId: 'learner-3',
                    courseId: 'course-2',
                    status: 'completed',
                    progress: 100,
                    enrolledAt: '2026-03-01T12:00:00.000Z',
                    completedAt: '2026-03-20T12:00:00.000Z',
                },
            ]

            const items = buildLearningFocusItems(enrollments, courses, now)

            expect(items).toHaveLength(2)
            expect(items[0].enrollmentId).toBe('enrollment-risk')
            expect(items[0].riskLevel).toBe('at-risk')
            expect(items[1].enrollmentId).toBe('enrollment-watch')
            expect(items[1].riskLevel).toBe('watch')
            expect(items[0].progressGap).toBeGreaterThanOrEqual(items[1].progressGap)
        })

        it('skips in-progress enrollments when their course is missing', () => {
            const enrollments: Enrollment[] = [
                {
                    id: 'missing-course-enrollment',
                    userId: 'learner-4',
                    courseId: 'missing-course',
                    status: 'in-progress',
                    progress: 15,
                    enrolledAt: '2026-03-01T12:00:00.000Z',
                },
            ]

            expect(buildLearningFocusItems(enrollments, courses, now)).toEqual([])
        })

        it('returns empty array for empty enrollments', () => {
            expect(buildLearningFocusItems([], courses, now)).toEqual([])
        })

        it('returns empty array when courses are empty', () => {
            const enrollments: Enrollment[] = [
                {
                    id: 'focus-no-course',
                    userId: 'learner-1',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 10,
                    enrolledAt: '2026-03-01T12:00:00.000Z',
                },
            ]

            expect(buildLearningFocusItems(enrollments, [], now)).toEqual([])
        })

        it('returns empty array when all enrollments are completed', () => {
            const enrollments: Enrollment[] = [
                {
                    id: 'completed-only',
                    userId: 'learner-1',
                    courseId: 'course-1',
                    status: 'completed',
                    progress: 100,
                    enrolledAt: '2026-03-01T12:00:00.000Z',
                    completedAt: '2026-03-25T12:00:00.000Z',
                },
            ]

            expect(buildLearningFocusItems(enrollments, courses, now)).toEqual([])
        })

        it('keeps on-track items when logic classifies them as on-track', () => {
            const enrollments: Enrollment[] = [
                {
                    id: 'on-track-enrollment',
                    userId: 'learner-1',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 80,
                    enrolledAt: '2026-03-25T12:00:00.000Z',
                },
            ]

            const items = buildLearningFocusItems(enrollments, courses, now)
            expect(items).toHaveLength(1)
            expect(items[0].enrollmentId).toBe('on-track-enrollment')
            expect(items[0].riskLevel).toBe('on-track')
            expect(items[0].recommendedAction).toBe('Maintain cadence with one module this week.')
        })

        it('clamps expected progress at 100 for long-running enrollments', () => {
            const enrollments: Enrollment[] = [
                {
                    id: 'long-running-enrollment',
                    userId: 'learner-1',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 20,
                    enrolledAt: '2025-12-01T12:00:00.000Z',
                },
            ]

            const items = buildLearningFocusItems(enrollments, courses, now)
            expect(items).toHaveLength(1)
            expect(items[0].expectedProgress).toBe(100)
            expect(items[0].progressGap).toBe(80)
        })

        it('sorts ties by progress gap and then days since enrollment', () => {
            const enrollments: Enrollment[] = [
                {
                    id: 'tie-gap-high',
                    userId: 'learner-1',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 20,
                    enrolledAt: '2026-03-12T12:00:00.000Z',
                },
                {
                    id: 'tie-gap-low',
                    userId: 'learner-2',
                    courseId: 'course-2',
                    status: 'in-progress',
                    progress: 15,
                    enrolledAt: '2026-03-17T12:00:00.000Z',
                },
                {
                    id: 'tie-gap-days-older',
                    userId: 'learner-3',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 23,
                    enrolledAt: '2026-03-12T12:00:00.000Z',
                },
            ]

            const items = buildLearningFocusItems(enrollments, courses, now)
            expect(items.map((item) => item.enrollmentId)).toEqual([
                'tie-gap-high',
                'tie-gap-days-older',
                'tie-gap-low',
            ])
        })

        it('skips enrollments with invalid enrolledAt timestamps', () => {
            const enrollments: Enrollment[] = [
                {
                    id: 'invalid-enrolled-at',
                    userId: 'learner-1',
                    courseId: 'course-1',
                    status: 'in-progress',
                    progress: 25,
                    enrolledAt: 'not-a-date',
                },
            ]

            expect(buildLearningFocusItems(enrollments, courses, now)).toEqual([])
        })
    })
})
