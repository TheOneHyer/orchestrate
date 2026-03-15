import { useEffect, useRef } from 'react'
import { User, Session, Notification } from '@/lib/types'
import { analyzeWorkloadBalance } from '@/lib/workload-balancer'
import { startOfWeek, addDays } from 'date-fns'

const OVERUTILIZED_THRESHOLD = 85
const CRITICALLY_OVERUTILIZED_THRESHOLD = 95

interface UtilizationState {
  trainerId: string
  utilizationRate: number
  wasOverutilized: boolean
  wasCritical: boolean
}

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
