import { describe, expect, it } from 'vitest'

import { buildLearningPathRecommendations, getMissingCertificationsForUser } from './competency-insights'
import type { Course, Enrollment, User } from './types'

const user: User = {
  id: 'user-1',
  name: 'Casey Learner',
  email: 'casey@example.com',
  role: 'employee',
  department: 'Operations',
  certifications: ['Safety'],
  hireDate: '2024-01-01T00:00:00.000Z',
}

const courses: Course[] = [
  {
    id: 'course-a',
    title: 'Leadership Foundations',
    description: 'Leadership basics',
    modules: ['Intro'],
    duration: 120,
    certifications: ['Leadership'],
    createdBy: 'admin-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    published: true,
    passScore: 80,
  },
  {
    id: 'course-b',
    title: 'Quality and Leadership Accelerator',
    description: 'Quality and leadership bundle',
    modules: ['Intro'],
    duration: 150,
    certifications: ['Quality', 'Leadership'],
    createdBy: 'admin-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    published: true,
    passScore: 80,
  },
  {
    id: 'course-c',
    title: 'Draft Course',
    description: 'Not published',
    modules: ['Intro'],
    duration: 60,
    certifications: ['Incident Command'],
    createdBy: 'admin-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    published: false,
    passScore: 80,
  },
]

describe('competency-insights', () => {
  describe('getMissingCertificationsForUser', () => {
    it('returns unique missing certifications from published course outcomes', () => {
      expect(getMissingCertificationsForUser(user, courses)).toEqual(['Leadership', 'Quality'])
    })
  })

  describe('buildLearningPathRecommendations', () => {
    it('ranks recommendations by number of closed certification gaps', () => {
      const recommendations = buildLearningPathRecommendations(user, courses, [])

      expect(recommendations).toHaveLength(2)
      expect(recommendations[0].courseId).toBe('course-b')
      expect(recommendations[0].gapClosureCount).toBe(2)
      expect(recommendations[1].courseId).toBe('course-a')
      expect(recommendations[1].gapClosureCount).toBe(1)
    })

    it('excludes courses already active or completed for the learner', () => {
      const enrollments: Enrollment[] = [
        {
          id: 'enrollment-1',
          userId: user.id,
          courseId: 'course-b',
          status: 'in-progress',
          progress: 60,
          enrolledAt: '2026-03-01T00:00:00.000Z',
        },
      ]

      const recommendations = buildLearningPathRecommendations(user, courses, enrollments)
      expect(recommendations.map((item) => item.courseId)).toEqual(['course-a'])
    })

    it('returns an empty list when no certification gaps remain', () => {
      const certifiedUser: User = {
        ...user,
        certifications: ['Safety', 'Leadership', 'Quality'],
      }

      expect(buildLearningPathRecommendations(certifiedUser, courses, [])).toEqual([])
    })
  })
})
