import { describe, expect, it } from 'vitest'

import {
  buildLearningEngagementItems,
  DEFAULT_CRITICAL_STALL_DAYS,
  DEFAULT_STALL_DAYS,
} from './learning-engagement'
import type { Course, Enrollment } from './types'

const courses: Course[] = [
  {
    id: 'course-1',
    title: 'Safety Basics',
    description: 'Safety training',
    modules: ['Module 1'],
    duration: 60,
    certifications: [],
    createdBy: 'admin-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    published: true,
    passScore: 80,
  },
  {
    id: 'course-2',
    title: 'Leadership Essentials',
    description: 'Leadership training',
    modules: ['Module 1'],
    duration: 75,
    certifications: [],
    createdBy: 'admin-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    published: true,
    passScore: 80,
  },
]

describe('learning-engagement', () => {
  it('uses configured stall thresholds', () => {
    expect(DEFAULT_STALL_DAYS).toBe(7)
    expect(DEFAULT_CRITICAL_STALL_DAYS).toBe(14)
  })

  it('builds engagement insights sorted by severity and inactivity', () => {
    const now = new Date('2026-04-01T00:00:00.000Z')
    const enrollments: Enrollment[] = [
      {
        id: 'critical-enrollment',
        userId: 'learner-1',
        courseId: 'course-1',
        status: 'in-progress',
        progress: 35,
        enrolledAt: '2026-02-01T00:00:00.000Z',
        lastProgressAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'stalled-enrollment',
        userId: 'learner-2',
        courseId: 'course-2',
        status: 'enrolled',
        progress: 5,
        enrolledAt: '2026-03-10T00:00:00.000Z',
        lastProgressAt: '2026-03-24T00:00:00.000Z',
      },
      {
        id: 'active-enrollment',
        userId: 'learner-3',
        courseId: 'course-2',
        status: 'in-progress',
        progress: 60,
        enrolledAt: '2026-03-20T00:00:00.000Z',
        lastProgressAt: '2026-03-30T00:00:00.000Z',
      },
    ]

    const items = buildLearningEngagementItems(enrollments, courses, now)

    expect(items).toHaveLength(2)
    expect(items[0].enrollmentId).toBe('critical-enrollment')
    expect(items[0].severity).toBe('critical-stall')
    expect(items[1].enrollmentId).toBe('stalled-enrollment')
    expect(items[1].severity).toBe('stalled')
  })

  it('falls back to enrolledAt when lastProgressAt is missing', () => {
    const now = new Date('2026-04-01T00:00:00.000Z')
    const enrollments: Enrollment[] = [
      {
        id: 'fallback-enrollment',
        userId: 'learner-1',
        courseId: 'course-1',
        status: 'in-progress',
        progress: 15,
        enrolledAt: '2026-03-20T00:00:00.000Z',
      },
    ]

    const items = buildLearningEngagementItems(enrollments, courses, now)

    expect(items).toHaveLength(1)
    expect(items[0].daysSinceProgress).toBe(12)
  })

  it('skips enrollments for unknown courses or invalid dates', () => {
    const now = new Date('2026-04-01T00:00:00.000Z')
    const enrollments: Enrollment[] = [
      {
        id: 'missing-course',
        userId: 'learner-1',
        courseId: 'course-missing',
        status: 'in-progress',
        progress: 20,
        enrolledAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'invalid-date',
        userId: 'learner-2',
        courseId: 'course-1',
        status: 'in-progress',
        progress: 20,
        enrolledAt: 'not-a-date',
      },
    ]

    expect(buildLearningEngagementItems(enrollments, courses, now)).toEqual([])
  })
})
