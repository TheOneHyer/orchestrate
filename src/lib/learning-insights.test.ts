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
  })
})
