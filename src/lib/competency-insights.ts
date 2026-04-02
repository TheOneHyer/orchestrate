import { Course, Enrollment, User } from '@/lib/types'

/**
 * A ranked recommendation for the next course in a user's learning path.
 */
export interface LearningPathRecommendation {
    /** The recommended course identifier. */
    courseId: string
    /** Display title of the recommended course. */
    courseTitle: string
    /** Number of missing certifications this course helps close. */
    gapClosureCount: number
    /** Missing certification names this course can help the user attain. */
    matchingCertifications: string[]
    /** Short explanation suitable for direct UI display. */
    reason: string
}

/**
 * Returns the set of certification names the user still needs based on published course outcomes.
 *
 * @param user - The learner being evaluated.
 * @param courses - Course catalog used to infer required and available certifications.
 * @returns Unique missing certification names sorted alphabetically.
 */
export function getMissingCertificationsForUser(user: User, courses: Course[]): string[] {
    const userCertSet = new Set(
        user.certifications
            .map((certification) => certification.trim())
            .filter((certification) => certification.length > 0)
    )
    const availableCertifications = new Set(
        courses
            .filter((course) => course.published)
            .flatMap((course) => course.certifications.map((certification) => certification.trim()))
            .filter((certification) => certification.length > 0)
    )

    return Array.from(availableCertifications)
        .filter((certification) => !userCertSet.has(certification))
        .sort((left, right) => left.localeCompare(right))
}

/**
 * Builds ranked learning-path recommendations that close current certification gaps.
 *
 * @param user - The learner for whom recommendations are generated.
 * @param courses - Course catalog used to evaluate recommendation candidates.
 * @param enrollments - Existing enrollments used to avoid duplicate active/completed recommendations.
 * @param maxRecommendations - Maximum number of recommendations to return.
 * @returns Ordered recommendation list, highest impact first.
 */
export function buildLearningPathRecommendations(
    user: User,
    courses: Course[],
    enrollments: Enrollment[],
    maxRecommendations: number = 3
): LearningPathRecommendation[] {
    const missingCertifications = new Set(getMissingCertificationsForUser(user, courses))
    if (missingCertifications.size === 0) {
        return []
    }

    const skippedStatuses = new Set(['in-progress', 'completed', 'enrolled'])
    const alreadyActiveOrCompletedCourseIds = new Set(
        enrollments
            .filter((enrollment) => enrollment.userId === user.id && skippedStatuses.has(enrollment.status))
            .map((enrollment) => enrollment.courseId)
    )

    const recommendations = courses
        .filter((course) => course.published)
        .filter((course) => !alreadyActiveOrCompletedCourseIds.has(course.id))
        .map((course) => {
            const matchingCertifications = course.certifications
                .map((certification) => certification.trim())
                .filter((certification) => certification.length > 0)
                .filter((certification) => missingCertifications.has(certification))
                .filter((certification, index, certifications) => certifications.indexOf(certification) === index)
                .sort((left, right) => left.localeCompare(right))

            if (matchingCertifications.length === 0) {
                return null
            }

            return {
                courseId: course.id,
                courseTitle: course.title,
                gapClosureCount: matchingCertifications.length,
                matchingCertifications,
                reason: `Closes ${matchingCertifications.length} certification gap${matchingCertifications.length === 1 ? '' : 's'}: ${matchingCertifications.join(', ')}`,
                duration: course.duration,
            }
        })
        .filter((recommendation): recommendation is LearningPathRecommendation & { duration: number } => recommendation !== null)
        .sort((left, right) => {
            const closureDiff = right.gapClosureCount - left.gapClosureCount
            if (closureDiff !== 0) {
                return closureDiff
            }

            const durationDiff = left.duration - right.duration
            if (durationDiff !== 0) {
                return durationDiff
            }

            return left.courseTitle.localeCompare(right.courseTitle)
        })
        .slice(0, Math.max(0, maxRecommendations))

    return recommendations.map(({ duration: _duration, ...recommendation }) => recommendation)
}
