import { addDays } from 'date-fns'

import { Course, Enrollment } from '@/lib/types'

/** Default enrollment completion horizon used when no explicit deadline is provided. */
export const DEFAULT_TARGET_COMPLETION_DAYS = 30

/** Threshold for raising due-soon urgency. */
export const DUE_SOON_THRESHOLD_DAYS = 7

/** Urgency bucket for enrollment deadline tracking. */
export type LearningDeadlineUrgency = 'on-track' | 'due-soon' | 'overdue'

/**
 * Enriched deadline insight for an active enrollment.
 */
export interface LearningDeadlineInsight {
  /** Enrollment identifier. */
  enrollmentId: string
  /** User identifier associated with the enrollment. */
  userId: string
  /** Course identifier associated with the enrollment. */
  courseId: string
  /** Resolved course title for display. */
  courseTitle: string
  /** Current enrollment status. */
  status: Enrollment['status']
  /** Current completion percentage. */
  progress: number
  /** ISO target completion timestamp. */
  targetCompletionDate: string
  /** Number of full days until due date. Negative means overdue. */
  daysUntilDue: number
  /** True when due date has passed. */
  isOverdue: boolean
  /** True when due date is within the due-soon threshold. */
  isDueSoon: boolean
  /** Priority bucket based on due date proximity. */
  urgency: LearningDeadlineUrgency
}

/**
 * Resolves an enrollment target completion date using explicit metadata when available,
 * otherwise deriving it from enrolledAt + default horizon.
 *
 * @param enrollment - Enrollment record to inspect.
 * @param fallbackDays - Number of days after enrollment to use when no explicit target exists.
 * @returns A Date representing the target completion deadline.
 */
export function resolveEnrollmentTargetDate(
  enrollment: Enrollment,
  fallbackDays: number = DEFAULT_TARGET_COMPLETION_DAYS
): Date {
  if (enrollment.targetCompletionDate) {
    const explicitDate = new Date(enrollment.targetCompletionDate)
    if (!Number.isNaN(explicitDate.getTime())) {
      return explicitDate
    }
  }

  const enrolledDate = new Date(enrollment.enrolledAt)
  if (!Number.isNaN(enrolledDate.getTime())) {
    return addDays(enrolledDate, fallbackDays)
  }

  return addDays(new Date(), fallbackDays)
}

/**
 * Builds sorted deadline insights for active enrollments.
 *
 * @param enrollments - Enrollment records to evaluate.
 * @param courses - Course catalog used to resolve titles.
 * @param now - Reference clock used for due-date math.
 * @returns Enrollment deadline insights sorted by urgency and due-date proximity.
 */
export function buildLearningDeadlineInsights(
  enrollments: Enrollment[],
  courses: Course[],
  now: Date = new Date()
): LearningDeadlineInsight[] {
  const courseById = new Map(courses.map((course) => [course.id, course]))

  const insights = enrollments
    .filter((enrollment) => enrollment.status === 'enrolled' || enrollment.status === 'in-progress')
    .map((enrollment) => {
      const course = courseById.get(enrollment.courseId)
      if (!course) {
        return null
      }

      const targetDate = resolveEnrollmentTargetDate(enrollment)
      const millisUntilDue = targetDate.getTime() - now.getTime()
      const daysUntilDueFloat = millisUntilDue / (1000 * 60 * 60 * 24)
      const daysUntilDue = millisUntilDue >= 0 ? Math.floor(daysUntilDueFloat) : Math.ceil(daysUntilDueFloat)
      const isOverdue = daysUntilDue < 0
      const isDueSoon = !isOverdue && daysUntilDue <= DUE_SOON_THRESHOLD_DAYS

      const urgency: LearningDeadlineUrgency = isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : 'on-track'

      return {
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        courseTitle: course.title,
        status: enrollment.status,
        progress: enrollment.progress,
        targetCompletionDate: targetDate.toISOString(),
        daysUntilDue,
        isOverdue,
        isDueSoon,
        urgency,
      }
    })
    .filter((insight): insight is LearningDeadlineInsight => insight !== null)

  const urgencyWeight: Record<LearningDeadlineUrgency, number> = {
    overdue: 3,
    'due-soon': 2,
    'on-track': 1,
  }

  return insights.sort((left, right) => {
    const urgencyDiff = urgencyWeight[right.urgency] - urgencyWeight[left.urgency]
    if (urgencyDiff !== 0) {
      return urgencyDiff
    }

    return left.daysUntilDue - right.daysUntilDue
  })
}
