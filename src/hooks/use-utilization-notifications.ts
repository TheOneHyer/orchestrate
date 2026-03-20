import { useEffect, useRef } from 'react'
import { User, Session, Notification } from '@/lib/types'
import { analyzeWorkloadBalance } from '@/lib/workload-balancer'
import { startOfWeek, addDays } from 'date-fns'

const OVERUTILIZED_THRESHOLD = 85
const CRITICALLY_OVERUTILIZED_THRESHOLD = 95

/**
 * Tracks the most-recently observed utilization state for a single trainer,
 * used to detect transitions between utilization bands across render cycles.
 */
interface UtilizationState {
  /** The trainer's unique identifier. */
  trainerId: string
  /** The trainer's utilization rate as a percentage (0–100+). */
  utilizationRate: number
  /** Whether the trainer was considered overutilized in the last evaluation. */
  wasOverutilized: boolean
  /** Whether the trainer was at critical utilization in the last evaluation. */
  wasCritical: boolean
}

/**
 * Hook that monitors trainer workload utilization for the current week and
 * dispatches notifications when trainers cross utilization thresholds.
 *
 * Runs a workload analysis on every render when `users` or `sessions` change.
 * Notifications are only created on threshold *transitions* (not repeatedly):
 * - Trainer enters overutilized zone (≥ 85 %) → high-priority alert.
 * - Trainer enters critical zone (≥ 95 %) → critical-priority alert.
 * - Trainer returns below the overutilized threshold → resolved notification.
 *
 * Both the trainer and the admin receive a notification for each event.
 *
 * @param users - Full list of application users; trainers are identified by their role.
 * @param sessions - All sessions for the current week, used to compute utilization rates.
 * @param onCreateNotification - Callback invoked to persist each generated notification.
 */
export function useUtilizationNotifications(
  users: User[],
  sessions: Session[],
  onCreateNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void
) {
  const previousStateRef = useRef<Map<string, UtilizationState>>(new Map())

  useEffect(() => {
    if (!users.length || !sessions.length) return

    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    const end = addDays(start, 6)

    const analysis = analyzeWorkloadBalance(users, sessions, [], start, end)

    const currentStates = new Map<string, UtilizationState>()

    analysis.workloads.forEach(workload => {
      const trainerId = workload.trainer.id
      const utilizationRate = workload.utilizationRate
      const isOverutilized = utilizationRate >= OVERUTILIZED_THRESHOLD
      const isCritical = utilizationRate >= CRITICALLY_OVERUTILIZED_THRESHOLD

      currentStates.set(trainerId, {
        trainerId,
        utilizationRate,
        wasOverutilized: isOverutilized,
        wasCritical: isCritical
      })

      const previousState = previousStateRef.current.get(trainerId)

      if (!previousState) {
        if (isCritical) {
          createCriticalUtilizationNotification(workload.trainer, utilizationRate, workload.totalHours, workload.sessionCount, onCreateNotification)
        } else if (isOverutilized) {
          createOverutilizationNotification(workload.trainer, utilizationRate, workload.totalHours, workload.sessionCount, onCreateNotification)
        }
      } else {
        if (isCritical && !previousState.wasCritical) {
          createCriticalUtilizationNotification(workload.trainer, utilizationRate, workload.totalHours, workload.sessionCount, onCreateNotification)
        } else if (isOverutilized && !previousState.wasOverutilized) {
          createOverutilizationNotification(workload.trainer, utilizationRate, workload.totalHours, workload.sessionCount, onCreateNotification)
        } else if (!isOverutilized && previousState.wasOverutilized) {
          createUtilizationResolvedNotification(workload.trainer, utilizationRate, onCreateNotification)
        }
      }
    })

    previousStateRef.current = currentStates
  }, [users, sessions, onCreateNotification])
}

/**
 * Creates high-priority overutilization notifications for both the affected trainer
 * and the admin when a trainer's utilization reaches or exceeds the overutilization threshold.
 *
 * @param trainer - The trainer who is overutilized.
 * @param utilizationRate - The trainer's current utilization percentage.
 * @param totalHours - Total scheduled hours for the current week.
 * @param sessionCount - Number of sessions scheduled this week.
 * @param onCreateNotification - Callback used to persist each created notification.
 */
function createOverutilizationNotification(
  trainer: User,
  utilizationRate: number,
  totalHours: number,
  sessionCount: number,
  onCreateNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void
) {
  onCreateNotification({
    userId: trainer.id,
    type: 'workload',
    title: 'High Workload Alert',
    message: `You are currently at ${utilizationRate.toFixed(0)}% utilization (${totalHours.toFixed(1)} hours, ${sessionCount} sessions this week). Consider redistributing some sessions.`,
    link: '/trainer-availability',
    read: false,
    priority: 'high'
  })

  onCreateNotification({
    userId: 'admin',
    type: 'workload',
    title: `Trainer Overutilization: ${trainer.name}`,
    message: `${trainer.name} is at ${utilizationRate.toFixed(0)}% utilization with ${sessionCount} sessions scheduled this week. Review workload balance.`,
    link: '/trainer-availability',
    read: false,
    priority: 'high'
  })
}

/**
 * Creates critical-priority notifications for both the affected trainer and the
 * admin when a trainer's utilization reaches or exceeds the critical threshold.
 *
 * @param trainer - The trainer who is critically overutilized.
 * @param utilizationRate - The trainer's current utilization percentage.
 * @param totalHours - Total scheduled hours for the current week.
 * @param sessionCount - Number of sessions scheduled this week.
 * @param onCreateNotification - Callback used to persist each created notification.
 */
function createCriticalUtilizationNotification(
  trainer: User,
  utilizationRate: number,
  totalHours: number,
  sessionCount: number,
  onCreateNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void
) {
  onCreateNotification({
    userId: trainer.id,
    type: 'workload',
    title: '⚠️ Critical Workload Alert',
    message: `URGENT: You are critically overloaded at ${utilizationRate.toFixed(0)}% utilization (${totalHours.toFixed(1)} hours, ${sessionCount} sessions). Immediate action needed to prevent burnout.`,
    link: '/trainer-availability',
    read: false,
    priority: 'critical'
  })

  onCreateNotification({
    userId: 'admin',
    type: 'workload',
    title: `🚨 Critical: ${trainer.name} Overutilized`,
    message: `URGENT: ${trainer.name} is critically overloaded at ${utilizationRate.toFixed(0)}% utilization (${sessionCount} sessions, ${totalHours.toFixed(1)}h). Immediate redistribution required.`,
    link: '/trainer-availability',
    read: false,
    priority: 'critical'
  })
}

/**
 * Creates low-priority resolution notifications for both the affected trainer and
 * the admin when a trainer's utilization drops back below the overutilization threshold.
 *
 * @param trainer - The trainer whose workload has been balanced.
 * @param utilizationRate - The trainer's new (normal) utilization percentage.
 * @param onCreateNotification - Callback used to persist each created notification.
 */
function createUtilizationResolvedNotification(
  trainer: User,
  utilizationRate: number,
  onCreateNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void
) {
  onCreateNotification({
    userId: trainer.id,
    type: 'workload',
    title: 'Workload Normalized',
    message: `Your workload has been balanced. You are now at ${utilizationRate.toFixed(0)}% utilization.`,
    read: false,
    priority: 'low'
  })

  onCreateNotification({
    userId: 'admin',
    type: 'workload',
    title: `Workload Balanced: ${trainer.name}`,
    message: `${trainer.name}'s workload has been successfully balanced to ${utilizationRate.toFixed(0)}% utilization.`,
    read: false,
    priority: 'low'
  })
}
