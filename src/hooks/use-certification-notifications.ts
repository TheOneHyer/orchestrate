import { useEffect, useCallback, useRef } from 'react'
import { User, Notification } from '@/lib/types'
import {
  getExpiringCertifications,
  shouldSendRenewalReminder,
  generateCertificationNotification
} from '@/lib/certification-tracker'

/**
 * Creates a deep clone of a User object, duplicating nested certification records
 * to prevent unintended mutations when updating certification state.
 *
 * @param user - The user to clone.
 * @returns A new User object with independently cloned trainer profile data.
 */
function cloneUserForCertificationUpdate(user: User): User {
  if (!user.trainerProfile) {
    return { ...user }
  }

  return {
    ...user,
    trainerProfile: {
      ...user.trainerProfile,
      certificationRecords: user.trainerProfile.certificationRecords
        ? user.trainerProfile.certificationRecords.map((record) => ({ ...record }))
        : user.trainerProfile.certificationRecords,
    },
  }
}

/**
 * Hook that monitors trainer certifications and dispatches renewal reminder
 * notifications when certifications are approaching expiry.
 *
 * On mount and whenever the `users` list changes, it checks all trainers for
 * expiring certifications. A periodic 24-hour interval repeats the check while
 * the component is mounted. When a reminder is due, the hook:
 * - Creates a notification for the trainer themselves.
 * - Creates a separate notification for the admin.
 * - Increments the `remindersSent` counter on the certification record.
 *
 * @param users - Array of all application users to scan for expiring certifications.
 * @param onCreateNotification - Callback invoked to persist each new notification.
 * @param onUpdateUsers - Callback invoked to persist the updated users array after
 *   incrementing reminder counters on certification records.
 */
export function useCertificationNotifications(
  users: User[],
  onCreateNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void,
  onUpdateUsers: (newValue: User[] | ((oldValue?: User[]) => User[])) => void
) {
  const usersRef = useRef(users)
  const onCreateNotificationRef = useRef(onCreateNotification)
  const onUpdateUsersRef = useRef(onUpdateUsers)

  useEffect(() => {
    usersRef.current = users
  }, [users])

  useEffect(() => {
    onCreateNotificationRef.current = onCreateNotification
  }, [onCreateNotification])

  useEffect(() => {
    onUpdateUsersRef.current = onUpdateUsers
  }, [onUpdateUsers])

  // The dependency array is intentionally empty: all mutable external values used inside
  // (onCreateNotificationRef, onUpdateUsersRef) are stable refs that are kept current via
  // the useEffect syncs above. The list of users is provided via the usersToProcess parameter,
  // so no state or prop dependencies need to be declared here.
  const checkAndNotify = useCallback((usersToProcess: User[]) => {
    const expiringCerts = getExpiringCertifications(usersToProcess)
    const updatedUsers = [...usersToProcess]
    const clonedUsers = new Set<string>()
    let hasUpdates = false

    expiringCerts.forEach(alert => {
      const userIndex = updatedUsers.findIndex(u => u.id === alert.userId)
      if (userIndex === -1) return

      if (!clonedUsers.has(alert.userId)) {
        updatedUsers[userIndex] = cloneUserForCertificationUpdate(updatedUsers[userIndex])
        clonedUsers.add(alert.userId)
      }

      const user = updatedUsers[userIndex]
      if (!user?.trainerProfile?.certificationRecords) return

      const certIndex = user.trainerProfile.certificationRecords.findIndex(
        c => c.certificationName === alert.certification.certificationName
      )

      if (certIndex === -1) return

      const cert = user.trainerProfile.certificationRecords[certIndex]
      if (cert.renewalInProgress) return

      if (shouldSendRenewalReminder(cert)) {
        const nextReminderCount = (cert.remindersSent ?? 0) + 1

        onCreateNotificationRef.current({
          ...generateCertificationNotification(alert, false),
          metadata: {
            remindersSent: nextReminderCount,
            certificationName: cert.certificationName,
          },
        })
        onCreateNotificationRef.current({
          ...generateCertificationNotification(alert, true),
          metadata: {
            remindersSent: nextReminderCount,
            certificationName: cert.certificationName,
          },
        })

        user.trainerProfile.certificationRecords[certIndex] = {
          ...cert,
          remindersSent: nextReminderCount,
          lastReminderDate: new Date().toISOString()
        }
        hasUpdates = true
      }
    })

    if (hasUpdates) {
      onUpdateUsersRef.current(updatedUsers)
    }
  }, [])

  useEffect(() => {
    checkAndNotify(users)
  }, [users, checkAndNotify])

  useEffect(() => {
    const interval = setInterval(() => {
      checkAndNotify(usersRef.current)
    }, 24 * 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [checkAndNotify])
}
