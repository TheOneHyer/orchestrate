import { Course, Enrollment, User } from '@/lib/types'

/**
 * Normalize certification labels by trimming whitespace, removing empties, and deduplicating values.
 *
 * @param certifications - Raw certification strings to normalize.
 * @returns A set of unique, non-empty certification labels.
 * @throws {TypeError} When `certifications` is not an array of strings and string operations are attempted during normalization.
 */
export function normalizeCertifications(certifications: string[]): Set<string> {
    return new Set(
        certifications
            .map((certification) => certification.trim())
            .filter((certification) => certification.length > 0)
    )
}

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
 * Compute certification names present in published courses that the user does not have.
 *
 * @param user - The learner whose certifications are compared.
 * @param courses - Course catalog used to derive available certifications (only published courses are considered).
 * @returns Unique certification names present in published courses but not in the user's certifications, sorted alphabetically.
 * @throws {TypeError} When `user.certifications` or any published course `certifications` value is not a string array and normalization cannot be completed.
 */
export function getMissingCertificationsForUser(user: User, courses: Course[]): string[] {
    const userCertSet = normalizeCertifications(user.certifications)
    const availableCertifications = normalizeCertifications(
        courses
            .filter((course) => course.published)
            .flatMap((course) => course.certifications)
    )

    return Array.from(availableCertifications)
        .filter((certification) => !userCertSet.has(certification))
        .sort((left, right) => left.localeCompare(right))
}

/**
 * Generate ranked learning-path recommendations that close the user's current certification gaps.
 *
 * Recommendations exclude courses the user is already enrolled in or has completed/in progress.
 *
 * @param user - The learner for whom recommendations are generated.
 * @param courses - Course catalog used to evaluate candidate courses.
 * @param enrollments - Existing enrollments used to exclude courses with statuses `in-progress`, `completed`, or `enrolled`.
 * @param maxRecommendations - Maximum number of recommendations to return (defaults to 3).
 * @returns An array of LearningPathRecommendation objects ordered by descending gapClosureCount, then by shorter course duration, then by alphabetical courseTitle.
 * @throws {TypeError} When `user`, `courses`, or `enrollments` contain malformed values (such as non-string certification entries) that break lookups or normalization.
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
            const matchingCertifications = Array.from(normalizeCertifications(course.certifications))
                .filter((certification) => missingCertifications.has(certification))
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
