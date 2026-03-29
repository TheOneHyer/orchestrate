import { differenceInDays, parseISO } from 'date-fns'
import { CertificationRecord, User, Notification } from './types'

/**
 * An alert generated for a trainer's certification that is expiring soon or
 * has already expired, including urgency metadata for prioritization.
 */
export interface CertificationAlert {
  /** ID of the trainer who holds the certification. */
  userId: string
  /** Display name of the trainer. */
  userName: string
  /** The certification record that is expiring or has expired. */
  certification: CertificationRecord
  /**
   * Number of days until expiration. Negative values indicate the certification
   * has already expired.
   */
  daysUntilExpiration: number
  /** Urgency level used to prioritize and style the alert. */
  urgency: 'critical' | 'high' | 'medium' | 'low'
}

/**
 * Derives the current status of a certification record based on its expiration date
 * relative to today.
 *
 * - `'expired'` — expiration date is in the past.
 * - `'expiring-soon'` — expiration is within the next 30 days.
 * - `'active'` — more than 30 days remain.
 *
 * @param cert - The certification record to evaluate.
 * @returns The computed status string for the certification.
 */
export function calculateCertificationStatus(cert: CertificationRecord): CertificationRecord['status'] {
  const now = new Date()
  const expirationDate = parseISO(cert.expirationDate)
  const daysUntilExpiration = differenceInDays(expirationDate, now)

  if (daysUntilExpiration < 0) {
    return 'expired'
  } else if (daysUntilExpiration <= 30) {
    return 'expiring-soon'
  }
  return 'active'
}

/**
 * Determines whether an automated renewal reminder should be sent for a
 * given certification at the current moment.
 *
 * Uses a tiered schedule based on how many days remain until expiration and
 * how many reminders have already been sent, with a minimum 7-day cooldown
 * between reminders:
 * - 61–90 days: up to 1 reminder
 * - 31–60 days: up to 2 reminders
 * - 15–30 days: up to 3 reminders
 * - 8–14 days: up to 4 reminders
 * - 1–7 days: always send
 *
 * @param cert - The certification record to evaluate.
 * @returns `true` if a reminder should be sent now, `false` otherwise.
 */
export function shouldSendRenewalReminder(cert: CertificationRecord): boolean {
  const now = new Date()
  const expirationDate = parseISO(cert.expirationDate)
  const daysUntilExpiration = differenceInDays(expirationDate, now)

  if (cert.lastReminderDate) {
    const daysSinceLastReminder = differenceInDays(now, parseISO(cert.lastReminderDate))
    if (daysSinceLastReminder <= 7) {
      return false
    }
  }

  const reminderRules = [
    { maxDays: 90, minDaysExclusive: 60, maxRemindersSent: 0 },
    { maxDays: 60, minDaysExclusive: 30, maxRemindersSent: 1 },
    { maxDays: 30, minDaysExclusive: 14, maxRemindersSent: 2 },
    { maxDays: 14, minDaysExclusive: 7, maxRemindersSent: 3 },
  ]

  const matchingRule = reminderRules.find(
    (rule) => daysUntilExpiration <= rule.maxDays && daysUntilExpiration > rule.minDaysExclusive
  )

  if (matchingRule) {
    return cert.remindersSent <= matchingRule.maxRemindersSent
  }

  if (daysUntilExpiration <= 7 && daysUntilExpiration > 0) {
    return true
  }

  return false
}

/**
 * Scans all trainer users and returns {@link CertificationAlert} objects for any
 * certification that expires within the next 90 days (or has already expired).
 * Results are sorted from most urgent (soonest expiration) to least urgent.
 *
 * @param users - Full list of users to scan.
 * @returns Array of certification alerts sorted ascending by days until expiration.
 */
export function getExpiringCertifications(users: User[]): CertificationAlert[] {
  const alerts: CertificationAlert[] = []
  const now = new Date()

  users.forEach(user => {
    if (user.role === 'trainer' && user.trainerProfile?.certificationRecords) {
      user.trainerProfile.certificationRecords.forEach(cert => {
        const expirationDate = parseISO(cert.expirationDate)
        const daysUntilExpiration = differenceInDays(expirationDate, now)

        if (daysUntilExpiration <= 90) {
          let urgency: CertificationAlert['urgency'] = 'low'

          if (daysUntilExpiration < 0) {
            urgency = 'critical'
          } else if (daysUntilExpiration <= 14) {
            urgency = 'critical'
          } else if (daysUntilExpiration <= 30) {
            urgency = 'high'
          } else if (daysUntilExpiration <= 60) {
            urgency = 'medium'
          }

          alerts.push({
            userId: user.id,
            userName: user.name,
            certification: cert,
            daysUntilExpiration,
            urgency
          })
        }
      })
    }
  })

  return alerts.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration)
}

/**
 * Builds a {@link Notification} payload (without `id` or `createdAt`) for a
 * certification alert, tailoring the title, message body, and priority to both
 * the urgency level and whether the recipient is an admin or the trainer themselves.
 *
 * @param alert - The certification alert to generate a notification for.
 * @param isAdmin - When `true`, the notification is addressed to an admin user;
 *   when `false` (default), it is addressed to the trainer who holds the certification.
 * @returns A partial notification object ready to be persisted with an ID and timestamp.
 */
export function generateCertificationNotification(
  alert: CertificationAlert,
  isAdmin: boolean = false
): Omit<Notification, 'id' | 'createdAt'> {
  const { certification, daysUntilExpiration, userId, userName } = alert

  let title = ''
  let message = ''
  let priority: Notification['priority'] = 'low'

  if (daysUntilExpiration < 0) {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Certification Expired`
      : `Your ${certification.certificationName} Certification Has Expired`
    message = isAdmin
      ? `The certification expired ${Math.abs(daysUntilExpiration)} days ago. ${userName} is no longer authorized to teach courses requiring this certification.`
      : `Your certification expired ${Math.abs(daysUntilExpiration)} days ago. You are no longer authorized to teach courses requiring this certification. Please renew immediately.`
    priority = 'critical'
  } else if (daysUntilExpiration === 0) {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires Today`
      : `Your ${certification.certificationName} Certification Expires Today`
    message = isAdmin
      ? `Action required: ${userName} must renew this certification today to maintain teaching authorization.`
      : 'Action required: Renew your certification today to maintain teaching authorization.'
    priority = 'critical'
  } else if (daysUntilExpiration <= 7) {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires in ${daysUntilExpiration} Days`
      : `Your ${certification.certificationName} Certification Expires in ${daysUntilExpiration} Days`
    message = isAdmin
      ? `Urgent: Only ${daysUntilExpiration} days remaining. Ensure ${userName} starts the renewal process immediately.`
      : `Urgent: Only ${daysUntilExpiration} days remaining. Start your renewal process immediately.`
    priority = 'critical'
  } else if (daysUntilExpiration <= 14) {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires in ${daysUntilExpiration} Days`
      : `Your ${certification.certificationName} Certification Expires in ${daysUntilExpiration} Days`
    message = isAdmin
      ? `Renewal needed soon. Contact ${userName} to initiate the certification renewal process.`
      : 'Renewal needed soon. Please initiate your certification renewal process.'
    priority = 'high'
  } else if (daysUntilExpiration <= 30) {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires in ${daysUntilExpiration} Days`
      : `Your ${certification.certificationName} Certification Expires in ${daysUntilExpiration} Days`
    message = isAdmin
      ? `Plan renewal: ${userName} should schedule certification renewal within the next month.`
      : 'Plan your renewal: Schedule your certification renewal within the next month.'
    priority = 'high'
  } else if (daysUntilExpiration <= 60) {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires in ${Math.round(daysUntilExpiration / 7)} Weeks`
      : `Your ${certification.certificationName} Certification Expires in ${Math.round(daysUntilExpiration / 7)} Weeks`
    message = isAdmin
      ? `Reminder: ${userName} should begin planning certification renewal.`
      : 'Reminder: Begin planning your certification renewal.'
    priority = 'medium'
  } else {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires in ${Math.round(daysUntilExpiration / 30)} Months`
      : `Your ${certification.certificationName} Certification Expires in ${Math.round(daysUntilExpiration / 30)} Months`
    message = isAdmin
      ? `Early notice: ${userName}'s certification will expire soon. Keep this on your radar.`
      : 'Early notice: Your certification will expire soon. Keep this on your radar.'
    priority = 'low'
  }

  return {
    userId: isAdmin ? 'admin' : userId,
    type: 'reminder',
    title,
    message,
    priority,
    read: false,
    link: isAdmin ? `/people/${userId}` : '/people'
  }
}

/**
 * Returns a new array of users where every trainer's certification records
 * have their `status` field recomputed against the current date using
 * {@link calculateCertificationStatus}. Non-trainer users are returned unchanged.
 *
 * @param users - The array of users to process.
 * @returns A new array of users with up-to-date certification statuses.
 */
export function updateCertificationRecords(users: User[]): User[] {
  return users.map(user => {
    if (user.role === 'trainer' && user.trainerProfile?.certificationRecords) {
      const updatedRecords = user.trainerProfile.certificationRecords.map(cert => ({
        ...cert,
        status: calculateCertificationStatus(cert)
      }))

      return {
        ...user,
        trainerProfile: {
          ...user.trainerProfile,
          certificationRecords: updatedRecords
        }
      }
    }
    return user
  })
}

/**
 * Aggregates certification statistics across all trainer users, providing a
 * quick compliance overview for admin dashboards.
 *
 * @param users - The array of users to analyse.
 * @returns An object containing counts of total, active, expiring-soon, and expired
 *   certifications, plus an overall compliance rate as a percentage (0–100).
 *   Returns 100% compliance when there are no certifications.
 */
export function getCertificationSummary(users: User[]) {
  let totalCertifications = 0
  let activeCertifications = 0
  let expiringSoon = 0
  let expired = 0

  users.forEach(user => {
    if (user.role === 'trainer' && user.trainerProfile?.certificationRecords) {
      user.trainerProfile.certificationRecords.forEach(cert => {
        totalCertifications++
        const status = calculateCertificationStatus(cert)

        if (status === 'active') activeCertifications++
        else if (status === 'expiring-soon') expiringSoon++
        else if (status === 'expired') expired++
      })
    }
  })

  return {
    totalCertifications,
    activeCertifications,
    expiringSoon,
    expired,
    complianceRate: totalCertifications > 0
      ? Math.round((activeCertifications / totalCertifications) * 100)
      : 100
  }
}
