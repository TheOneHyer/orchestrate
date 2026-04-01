import { describe, expect, it } from 'vitest'

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
})
