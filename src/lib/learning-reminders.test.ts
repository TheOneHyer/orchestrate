import { describe, expect, it } from 'vitest'

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
    expect(candidates[0].priority).toBe('high')
    expect(candidates[0].reminderKey).toBe('enrollment-overdue:overdue')
    expect(candidates[1].priority).toBe('medium')
    expect(candidates[1].reminderKey).toBe('enrollment-due-soon:due-soon')
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
})
