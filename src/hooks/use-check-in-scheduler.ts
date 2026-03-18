import { useEffect, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'
import { CheckInSchedule, User, WellnessCheckIn } from '@/lib/types'
import { differenceInHours, addDays, addWeeks, addMonths, isAfter } from 'date-fns'

/**
 * Hook that manages scheduled wellness check-ins for trainers.
 *
 * Persists check-in schedules via KV storage and polls every 30 minutes to:
 * - Trigger due check-ins by calling `onTriggerCheckIn`.
 * - Show toast reminders ahead of scheduled check-ins when auto-reminders are enabled.
 * - Increment the missed check-in counter for overdue, unaddressed schedules.
 *
 * When new wellness check-in data arrives it automatically advances the next
 * scheduled date for the matching active schedule.
 *
 * @param users - Array of all application users, used to resolve trainer names.
 * @param checkIns - Array of completed wellness check-ins; the latest entry is
 *   used to advance matching schedule dates automatically.
 * @param onTriggerCheckIn - Optional callback invoked when a check-in becomes due,
 *   receiving the trainer's ID and display name.
 * @returns An object containing:
 *   - `schedules` – The current list of persisted check-in schedules.
 *   - `setSchedules` – Setter for directly updating the schedules list.
 *   - `updateScheduleNextDate` – Advances a schedule's next date after a check-in is recorded.
 *   - `checkForDueCheckIns` – Manually trigger a due-check evaluation.
 */
export function useCheckInScheduler(
  users: User[],
  checkIns: WellnessCheckIn[],
  onTriggerCheckIn?: (trainerId: string, trainerName: string) => void
) {
  const [schedules, setSchedules] = useKV<CheckInSchedule[]>('check-in-schedules', [])

/**
 * Computes the next check-in date for a given schedule based on its frequency setting.
 *
 * @param schedule - The check-in schedule to compute the next date for.
 * @returns The calculated next scheduled {@link Date}.
 */
  const getNextScheduledDate = useCallback((schedule: CheckInSchedule): Date => {
    const baseDate = schedule.lastCheckInDate
      ? new Date(schedule.lastCheckInDate)
      : new Date(schedule.startDate)

    switch (schedule.frequency) {
      case 'daily':
        return addDays(baseDate, 1)
      case 'weekly':
        return addWeeks(baseDate, 1)
      case 'biweekly':
        return addWeeks(baseDate, 2)
      case 'monthly':
        return addMonths(baseDate, 1)
      case 'custom':
        return addDays(baseDate, schedule.customDays || 7)
      default:
        return addWeeks(baseDate, 1)
    }
  }, [])

  const updateScheduleNextDate = useCallback((scheduleId: string, lastCheckInDate: string) => {
    setSchedules((current) =>
      (current || []).map(schedule => {
        if (schedule.id === scheduleId) {
          const updatedSchedule = {
            ...schedule,
            lastCheckInDate,
            completedCheckIns: schedule.completedCheckIns + 1
          }
          const nextDate = getNextScheduledDate(updatedSchedule)

          if (schedule.endDate && isAfter(nextDate, new Date(schedule.endDate))) {
            return {
              ...updatedSchedule,
              status: 'completed' as const,
              nextScheduledDate: schedule.endDate
            }
          }

          return {
            ...updatedSchedule,
            nextScheduledDate: nextDate.toISOString()
          }
        }
        return schedule
      })
    )
  }, [setSchedules, getNextScheduledDate])

  const checkForDueCheckIns = useCallback(() => {
    const now = new Date()
    const safeSchedules = schedules || []

    safeSchedules.forEach(schedule => {
      if (schedule.status !== 'active') return

      const nextDate = new Date(schedule.nextScheduledDate)
      const hoursDiff = differenceInHours(nextDate, now)

      const trainer = users.find(u => u.id === schedule.trainerId)
      if (!trainer) return

      if (hoursDiff <= 0 && hoursDiff > -24) {
        if (schedule.notificationEnabled && onTriggerCheckIn) {
          onTriggerCheckIn(trainer.id, trainer.name)
        }
      } else if (schedule.autoReminders && hoursDiff > 0 && hoursDiff <= schedule.reminderHoursBefore) {
        const alreadyReminded = localStorage.getItem(`reminder-${schedule.id}-${schedule.nextScheduledDate}`)
        if (!alreadyReminded) {
          toast.info(`Wellness Check-In Reminder`, {
            description: `${trainer.name} has a check-in scheduled in ${hoursDiff} hours`,
            duration: 8000
          })
          localStorage.setItem(`reminder-${schedule.id}-${schedule.nextScheduledDate}`, 'true')
        }
      }

      if (hoursDiff < -24) {
        setSchedules((current) =>
          (current || []).map(s =>
            s.id === schedule.id
              ? { ...s, missedCheckIns: s.missedCheckIns + 1, nextScheduledDate: getNextScheduledDate(s).toISOString() }
              : s
          )
        )
      }
    })
  }, [schedules, users, onTriggerCheckIn, setSchedules, getNextScheduledDate])

  useEffect(() => {
    checkForDueCheckIns()

    const interval = setInterval(() => {
      checkForDueCheckIns()
    }, 1000 * 60 * 30)

    return () => clearInterval(interval)
  }, [checkForDueCheckIns])

  useEffect(() => {
    const safeSchedules = schedules || []
    const safeCheckIns = checkIns || []

    if (safeCheckIns.length === 0) return

    const latestCheckIn = safeCheckIns[safeCheckIns.length - 1]
    const matchingSchedule = safeSchedules.find(
      s => s.trainerId === latestCheckIn.trainerId && s.status === 'active'
    )

    if (matchingSchedule) {
      const lastRecordedDate = matchingSchedule.lastCheckInDate || matchingSchedule.startDate
      if (latestCheckIn.timestamp !== lastRecordedDate) {
        updateScheduleNextDate(matchingSchedule.id, latestCheckIn.timestamp)
      }
    }
  }, [checkIns, schedules, updateScheduleNextDate])

  return {
    schedules: schedules || [],
    setSchedules,
    updateScheduleNextDate,
    checkForDueCheckIns
  }
}
