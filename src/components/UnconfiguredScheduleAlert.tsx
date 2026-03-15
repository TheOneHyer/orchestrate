import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { WarningCircle, CalendarX } from '@phosphor-icons/react'
import { User } from '@/lib/types'

interface UnconfiguredScheduleAlertProps {
  user: User
  onEdit?: () => void
  variant?: 'default' | 'compact' | 'inline'
}

export function UnconfiguredScheduleAlert({ user, onEdit, variant = 'default' }: UnconfiguredScheduleAlertProps) {
  const hasSchedule = user.trainerProfile?.shiftSchedules && user.trainerProfile.shiftSchedules.length > 0

  if (hasSchedule) {
    return null
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
        <WarningCircle size={16} weight="fill" />
        <span className="font-medium">Schedule not configured</span>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
        <WarningCircle size={18} weight="fill" className="text-amber-600 dark:text-amber-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Schedule not configured</p>
          <p className="text-xs text-amber-700 dark:text-amber-300">This trainer needs work schedule setup</p>
        </div>
        {onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit} className="ml-2 flex-shrink-0">
            Configure
          </Button>
        )}
      </div>
    )
  }

  return (
    <Alert variant="default" className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
      <CalendarX className="h-5 w-5 text-amber-600 dark:text-amber-500" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">Work Schedule Not Configured</AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <p className="mb-3">
          {user.name}'s work schedule has not been set up yet. Configure shift schedules, work days, and hours to:
        </p>
        <ul className="list-disc list-inside space-y-1 mb-3 text-sm">
          <li>Enable automatic scheduling and workload calculations</li>
          <li>Accurately track trainer availability and utilization</li>
          <li>Prevent scheduling conflicts and overutilization</li>
          <li>Support burnout prevention and wellness monitoring</li>
        </ul>
        {onEdit && (
          <Button onClick={onEdit} size="sm" className="mt-2">
            Configure Schedule Now
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
