import { useEffect, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'
import { CheckInSchedule, User, WellnessCheckIn } from '@/lib/types'
import { differenceInHours, addDays, addWeeks, addMonths, isAfter } from 'date-fns'

export function useCheckInScheduler(
  users: User[],
  checkIns: WellnessCheckIn[],
  onTriggerCheckIn?: (trainerId: string, trainerName: string) => void
) {
  const [schedules, setSchedules] = useKV<CheckInSchedule[]>('check-in-schedules', [])

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
