import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { CheckInSchedule, CheckInFrequency, User } from '@/lib/types'
import { CalendarCheck } from '@phosphor-icons/react'
import { addDays, format } from 'date-fns'

/**
 * Props for the {@link CheckInScheduleDialog} component.
 */
interface CheckInScheduleDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Callback to close the dialog. */
  onClose: () => void
  /** List of trainers available for selection. */
  trainers: User[]
  /**
   * Callback invoked with the completed schedule data when the user saves.
   * @param schedule - The new or updated schedule (without auto-generated fields).
   */
  onSubmit: (schedule: Omit<CheckInSchedule, 'id' | 'createdAt' | 'completedCheckIns' | 'missedCheckIns'>) => void
  /** The ID of the currently authenticated user, stored as `createdBy` on the schedule. */
  currentUserId: string
  /** When provided, the dialog populates its fields from this schedule and operates in edit mode. */
  existingSchedule?: CheckInSchedule
}

const checkInFrequencies = ['daily', 'weekly', 'biweekly', 'monthly', 'custom'] as const

/**
 * Validates check-in schedule form input prior to submission.
 *
 * Enforces required trainer/frequency/date fields, constrains `customDays`
 * to an integer in the 1-365 range, ensures valid date strings, and
 * requires `endDate` to be later than `startDate` when an end date is enabled.
 */
const checkInScheduleSchema = z.object({
  trainerId: z.string().min(1, 'Trainer is required'),
  frequency: z.enum(checkInFrequencies),
  customDays: z.coerce.number().int().min(1, 'Custom days must be at least 1').max(365, 'Custom days must be 365 or fewer'),
  startDate: z.string().min(1, 'Start date is required'),
  hasEndDate: z.boolean(),
  endDate: z.string().optional(),
  notificationEnabled: z.boolean(),
  autoReminders: z.boolean(),
  reminderHoursBefore: z.coerce.number().min(0, 'Reminder hours cannot be negative'),
  notes: z.string(),
}).superRefine((values, ctx) => {
  const startDate = new Date(values.startDate)
  if (Number.isNaN(startDate.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Start date is invalid.',
      path: ['startDate'],
    })
  }

  if (values.hasEndDate) {
    if (!values.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date is required.',
        path: ['endDate'],
      })
      return
    }

    const endDate = new Date(values.endDate)

    if (Number.isNaN(endDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date is invalid.',
        path: ['endDate'],
      })
      return
    }

    if (!Number.isNaN(startDate.getTime()) && endDate <= startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be after start date.',
        path: ['endDate'],
      })
    }
  }
})

type CheckInScheduleFormValues = z.infer<typeof checkInScheduleSchema>

/**
 * Builds default form values for create and edit schedule flows.
 *
 * @param existingSchedule - Optional schedule used to prefill edit values.
 * @returns Initial values consumed by the check-in schedule form.
 */
function getDefaultFormValues(existingSchedule?: CheckInSchedule): CheckInScheduleFormValues {
  return {
    trainerId: existingSchedule?.trainerId || '',
    frequency: existingSchedule?.frequency || 'weekly',
    customDays: existingSchedule?.customDays ?? 7,
    startDate: existingSchedule?.startDate
      ? existingSchedule.startDate.split('T')[0]
      : format(new Date(), 'yyyy-MM-dd'),
    hasEndDate: Boolean(existingSchedule?.endDate),
    endDate: existingSchedule?.endDate
      ? existingSchedule.endDate.split('T')[0]
      : format(addDays(new Date(), 90), 'yyyy-MM-dd'),
    notificationEnabled: existingSchedule?.notificationEnabled ?? true,
    autoReminders: existingSchedule?.autoReminders ?? true,
    reminderHoursBefore: existingSchedule?.reminderHoursBefore ?? 24,
    notes: existingSchedule?.notes || '',
  }
}

/**
 * Dialog for creating or editing an automated wellness check-in schedule for a trainer.
 *
 * Allows configuring the target trainer, check-in frequency (daily, weekly, biweekly,
 * monthly, or a custom number of days), date range, reminder settings, and free-text notes.
 * When editing, the dialog is pre-populated with the values from {@link CheckInScheduleDialogProps.existingSchedule}
 * and the trainer selector is disabled. On save, {@link CheckInScheduleDialogProps.onSubmit}
 * is called with the constructed schedule data.
 */
export function CheckInScheduleDialog({
  open,
  onClose,
  trainers,
  onSubmit,
  currentUserId,
  existingSchedule
}: CheckInScheduleDialogProps) {
  const defaultValues = useMemo(() => getDefaultFormValues(existingSchedule), [existingSchedule])
  const form = useForm<CheckInScheduleFormValues>({
    resolver: zodResolver(checkInScheduleSchema),
    defaultValues,
    mode: 'onSubmit',
  })

  const {
    register,
    control,
    watch,
    reset,
    formState: { errors },
  } = form

  useEffect(() => {
    if (open) {
      reset(getDefaultFormValues(existingSchedule))
    }
  }, [open, existingSchedule, reset])

  const trainerId = watch('trainerId')
  const frequency = watch('frequency')
  const hasEndDate = watch('hasEndDate')
  const notificationEnabled = watch('notificationEnabled')
  const autoReminders = watch('autoReminders')
  const startDate = watch('startDate')

  const handleClose = () => {
    if (!existingSchedule) {
      reset(getDefaultFormValues(undefined))
    }
    onClose()
  }

  /**
   * Converts a stored frequency value into the human-readable label shown in the UI.
   *
   * @param freq - The schedule frequency key.
   * @returns User-facing frequency label.
   */
  const getFrequencyLabel = (freq: CheckInFrequency) => {
    switch (freq) {
      case 'daily': return 'Every Day'
      case 'weekly': return 'Every Week'
      case 'biweekly': return 'Every 2 Weeks'
      case 'monthly': return 'Every Month'
      case 'custom': return 'Custom Interval'
      default: return freq
    }
  }

  /**
   * Transforms validated form values into a schedule payload and submits it.
   *
   * Converts date strings to ISO timestamps, conditionally includes custom
   * interval and optional end-date fields, and forwards the resulting
   * `CheckInSchedule` input shape to `onSubmit` before closing the dialog.
   *
   * @param values - Validated check-in schedule form values.
   */
  const submitForm = (values: CheckInScheduleFormValues) => {
    const scheduleData: Omit<CheckInSchedule, 'id' | 'createdAt' | 'completedCheckIns' | 'missedCheckIns'> = {
      trainerId: values.trainerId,
      frequency: values.frequency,
      customDays: values.frequency === 'custom' ? values.customDays : undefined,
      startDate: new Date(values.startDate).toISOString(),
      endDate: values.hasEndDate && values.endDate ? new Date(values.endDate).toISOString() : undefined,
      nextScheduledDate: new Date(values.startDate).toISOString(),
      lastCheckInDate: existingSchedule?.lastCheckInDate,
      status: existingSchedule?.status || 'active',
      notificationEnabled: values.notificationEnabled,
      autoReminders: values.autoReminders,
      reminderHoursBefore: values.reminderHoursBefore,
      createdBy: currentUserId,
      notes: values.notes.trim() || undefined,
    }

    onSubmit(scheduleData)
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <CalendarCheck weight="fill" className="text-accent" />
            {existingSchedule ? 'Edit Check-In Schedule' : 'Create Check-In Schedule'}
          </DialogTitle>
          <DialogDescription>
            Set up automated wellness check-in schedules for trainers with customizable frequencies and reminders.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6 py-4" noValidate onSubmit={form.handleSubmit(submitForm)}>
          <div className="space-y-2">
            <Label htmlFor="trainer">Trainer *</Label>
            <Controller
              control={control}
              name="trainerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(existingSchedule)}>
                  <SelectTrigger id="trainer">
                    <SelectValue placeholder="Select a trainer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {trainers.map(trainer => (
                      <SelectItem key={trainer.id} value={trainer.id}>
                        {trainer.name} - {trainer.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.trainerId && <p className="text-sm text-destructive">{errors.trainerId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Check-In Frequency *</Label>
              <Controller
                control={control}
                name="frequency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as CheckInFrequency)}>
                    <SelectTrigger id="frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{getFrequencyLabel('daily')}</SelectItem>
                      <SelectItem value="weekly">{getFrequencyLabel('weekly')}</SelectItem>
                      <SelectItem value="biweekly">{getFrequencyLabel('biweekly')}</SelectItem>
                      <SelectItem value="monthly">{getFrequencyLabel('monthly')}</SelectItem>
                      <SelectItem value="custom">{getFrequencyLabel('custom')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {frequency === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="customDays">Custom Days *</Label>
                <Input
                  id="customDays"
                  type="number"
                  min="1"
                  max="365"
                  placeholder="Enter number of days"
                  {...register('customDays', { valueAsNumber: true })}
                />
                {errors.customDays && <p className="text-sm text-destructive">{errors.customDays.message}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate')}
              />
              {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="endDate">End Date (Optional)</Label>
                <Controller
                  control={control}
                  name="hasEndDate"
                  render={({ field }) => (
                    <Switch
                      data-testid="end-date-switch"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
              <Input
                id="endDate"
                type="date"
                disabled={!hasEndDate}
                min={startDate}
                {...register('endDate')}
              />
              {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
            </div>
          </div>

          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-medium text-sm">Notification Settings</h4>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notificationEnabled">Enable Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send notifications when check-ins are due
                </p>
              </div>
              <Controller
                control={control}
                name="notificationEnabled"
                render={({ field }) => (
                  <Switch
                    id="notificationEnabled"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoReminders">Automatic Reminders</Label>
                <p className="text-xs text-muted-foreground">
                  Send reminder before check-in is due
                </p>
              </div>
              <Controller
                control={control}
                name="autoReminders"
                render={({ field }) => (
                  <Switch
                    id="autoReminders"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!notificationEnabled}
                  />
                )}
              />
            </div>

            {autoReminders && notificationEnabled && (
              <div className="space-y-2">
                <Label htmlFor="reminderHours">Reminder Time (Hours Before)</Label>
                <Controller
                  control={control}
                  name="reminderHoursBefore"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                      <SelectTrigger id="reminderHours">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hour before</SelectItem>
                        <SelectItem value="4">4 hours before</SelectItem>
                        <SelectItem value="12">12 hours before</SelectItem>
                        <SelectItem value="24">24 hours before</SelectItem>
                        <SelectItem value="48">48 hours before</SelectItem>
                        <SelectItem value="72">72 hours before</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.reminderHoursBefore && <p className="text-sm text-destructive">{errors.reminderHoursBefore.message}</p>}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes or special instructions..."
              rows={3}
              {...register('notes')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!trainerId}>
              {existingSchedule ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
