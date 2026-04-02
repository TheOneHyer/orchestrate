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

        it('returns empty array when course catalog is empty', () => {
            expect(getMissingCertificationsForUser(user, [])).toEqual([])
        })

        it('returns all published certifications when user has none', () => {
            const uncertifiedUser: User = {
                ...user,
                certifications: [],
            }

            expect(getMissingCertificationsForUser(uncertifiedUser, courses)).toEqual(['Leadership', 'Quality'])
        })

        it('returns empty array when all courses are unpublished', () => {
            const unpublishedOnly = courses.map((course) => ({ ...course, published: false }))
            expect(getMissingCertificationsForUser(user, unpublishedOnly)).toEqual([])
        })

        it('ignores empty certification strings', () => {
            const withEmptyCerts: Course[] = [
                {
                    ...courses[0],
                    id: 'course-empty-certs',
                    certifications: ['Leadership', '  ', ''],
                },
            ]

            expect(getMissingCertificationsForUser({ ...user, certifications: [] }, withEmptyCerts)).toEqual(['Leadership'])
        })

        it('normalizes certification whitespace before deduping and comparison', () => {
            const whitespaceCourses: Course[] = [
                {
                    ...courses[0],
                    id: 'course-whitespace',
                    certifications: [' Leadership ', 'Leadership', 'Quality '],
                },
            ]

            const normalizedUser: User = {
                ...user,
                certifications: ['Leadership '],
            }

            expect(getMissingCertificationsForUser(normalizedUser, whitespaceCourses)).toEqual(['Quality'])
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

        it('returns an empty list when course catalog is empty', () => {
            expect(buildLearningPathRecommendations({ ...user, certifications: [] }, [], [])).toEqual([])
        })

        it('ignores enrollments with unknown course IDs when excluding active/completed courses', () => {
            const enrollments: Enrollment[] = [
                {
                    id: 'unknown-course-enrollment',
                    userId: user.id,
                    courseId: 'missing-course-id',
                    status: 'in-progress',
                    progress: 20,
                    enrolledAt: '2026-03-01T00:00:00.000Z',
                },
            ]

            const recommendations = buildLearningPathRecommendations(user, courses, enrollments)
            expect(recommendations.map((item) => item.courseId)).toEqual(['course-b', 'course-a'])
        })

        it('returns an empty list when maxRecommendations is zero or negative', () => {
            expect(buildLearningPathRecommendations(user, courses, [], 0)).toEqual([])
            expect(buildLearningPathRecommendations(user, courses, [], -2)).toEqual([])
        })

        it('returns recommendation shape and deterministic ordering by gap, duration, then title', () => {
            const tieCourses: Course[] = [
                {
                    ...courses[0],
                    id: 'course-z-short',
                    title: 'Z Short',
                    certifications: ['Leadership'],
                    duration: 30,
                },
                {
                    ...courses[0],
                    id: 'course-a-short',
                    title: 'A Short',
                    certifications: ['Leadership'],
                    duration: 30,
                },
                {
                    ...courses[1],
                    id: 'course-gap-2',
                    title: 'Gap Two',
                    certifications: ['Leadership', 'Quality'],
                    duration: 120,
                },
            ]

            const recommendations = buildLearningPathRecommendations({ ...user, certifications: [] }, tieCourses, [])
            expect(recommendations[0]).toMatchObject({
                courseId: 'course-gap-2',
                courseTitle: 'Gap Two',
                gapClosureCount: 2,
                matchingCertifications: ['Leadership', 'Quality'],
            })
            expect(recommendations[0].reason).toMatch(/Closes 2 certification gaps:/)
            expect(recommendations.slice(1).map((item) => item.courseTitle)).toEqual(['A Short', 'Z Short'])
        })

        it('normalizes and deduplicates matching certifications for recommendation reasons', () => {
            const whitespaceRecommendationCourses: Course[] = [
                {
                    ...courses[0],
                    id: 'course-normalized-gaps',
                    title: 'Normalized Gaps Course',
                    certifications: [' Leadership ', 'Leadership', ' Quality'],
                },
            ]

            const recommendations = buildLearningPathRecommendations(
                { ...user, certifications: ['Safety'] },
                whitespaceRecommendationCourses,
                [],
            )

            expect(recommendations).toHaveLength(1)
            expect(recommendations[0].matchingCertifications).toEqual(['Leadership', 'Quality'])
        })

        it('excludes already active, completed, or enrolled course IDs', () => {
            const enrollments: Enrollment[] = [
                {
                    id: 'status-in-progress',
                    userId: user.id,
                    courseId: 'course-a',
                    status: 'in-progress',
                    progress: 10,
                    enrolledAt: '2026-03-01T00:00:00.000Z',
                },
                {
                    id: 'status-completed',
                    userId: user.id,
                    courseId: 'course-b',
                    status: 'completed',
                    progress: 100,
                    enrolledAt: '2026-02-01T00:00:00.000Z',
                    completedAt: '2026-03-01T00:00:00.000Z',
                },
                {
                    id: 'status-enrolled',
                    userId: user.id,
                    courseId: 'course-c',
                    status: 'enrolled',
                    progress: 0,
                    enrolledAt: '2026-04-01T00:00:00.000Z',
                },
            ]

            const recommendations = buildLearningPathRecommendations({ ...user, certifications: [] }, courses, enrollments)
            expect(recommendations).toEqual([])
        })
    })
})
