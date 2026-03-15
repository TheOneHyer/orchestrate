import { useState } from 'react'
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

interface CheckInScheduleDialogProps {
  open: boolean
  onClose: () => void
  trainers: User[]
  onSubmit: (schedule: Omit<CheckInSchedule, 'id' | 'createdAt' | 'completedCheckIns' | 'missedCheckIns'>) => void
  currentUserId: string
  existingSchedule?: CheckInSchedule
}

export function CheckInScheduleDialog({
  open,
  onClose,
  trainers,
  onSubmit,
  currentUserId,
  existingSchedule
}: CheckInScheduleDialogProps) {
  const [trainerId, setTrainerId] = useState(existingSchedule?.trainerId || '')
  const [frequency, setFrequency] = useState<CheckInFrequency>(existingSchedule?.frequency || 'weekly')
  const [customDays, setCustomDays] = useState(existingSchedule?.customDays?.toString() || '7')
  const [startDate, setStartDate] = useState(
    existingSchedule?.startDate 
      ? format(new Date(existingSchedule.startDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
  )
  const [hasEndDate, setHasEndDate] = useState(!!existingSchedule?.endDate)
  const [endDate, setEndDate] = useState(
    existingSchedule?.endDate 
      ? format(new Date(existingSchedule.endDate), 'yyyy-MM-dd')
      : format(addDays(new Date(), 90), 'yyyy-MM-dd')
  )
  const [notificationEnabled, setNotificationEnabled] = useState(existingSchedule?.notificationEnabled ?? true)
  const [autoReminders, setAutoReminders] = useState(existingSchedule?.autoReminders ?? true)
  const [reminderHoursBefore, setReminderHoursBefore] = useState(
    existingSchedule?.reminderHoursBefore?.toString() || '24'
  )
  const [notes, setNotes] = useState(existingSchedule?.notes || '')

  const handleSubmit = () => {
    if (!trainerId) return

    const scheduleData: Omit<CheckInSchedule, 'id' | 'createdAt' | 'completedCheckIns' | 'missedCheckIns'> = {
      trainerId,
      frequency,
      customDays: frequency === 'custom' ? parseInt(customDays) : undefined,
      startDate: new Date(startDate).toISOString(),
      endDate: hasEndDate ? new Date(endDate).toISOString() : undefined,
      nextScheduledDate: new Date(startDate).toISOString(),
      lastCheckInDate: existingSchedule?.lastCheckInDate,
      status: existingSchedule?.status || 'active',
      notificationEnabled,
      autoReminders,
      reminderHoursBefore: parseInt(reminderHoursBefore),
      createdBy: currentUserId,
      notes: notes.trim() || undefined
    }

    onSubmit(scheduleData)
    handleClose()
  }

  const handleClose = () => {
    if (!existingSchedule) {
      setTrainerId('')
      setFrequency('weekly')
      setCustomDays('7')
      setStartDate(format(new Date(), 'yyyy-MM-dd'))
      setHasEndDate(false)
      setEndDate(format(addDays(new Date(), 90), 'yyyy-MM-dd'))
      setNotificationEnabled(true)
      setAutoReminders(true)
      setReminderHoursBefore('24')
      setNotes('')
    }
    onClose()
  }

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

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="trainer">Trainer *</Label>
            <Select value={trainerId} onValueChange={setTrainerId} disabled={!!existingSchedule}>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Check-In Frequency *</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as CheckInFrequency)}>
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
            </div>

            {frequency === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="customDays">Custom Days *</Label>
                <Input
                  id="customDays"
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="Enter number of days"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="endDate">End Date (Optional)</Label>
                <Switch
                  checked={hasEndDate}
                  onCheckedChange={setHasEndDate}
                />
              </div>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={!hasEndDate}
                min={startDate}
              />
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
              <Switch
                id="notificationEnabled"
                checked={notificationEnabled}
                onCheckedChange={setNotificationEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoReminders">Automatic Reminders</Label>
                <p className="text-xs text-muted-foreground">
                  Send reminder before check-in is due
                </p>
              </div>
              <Switch
                id="autoReminders"
                checked={autoReminders}
                onCheckedChange={setAutoReminders}
                disabled={!notificationEnabled}
              />
            </div>

            {autoReminders && notificationEnabled && (
              <div className="space-y-2">
                <Label htmlFor="reminderHours">Reminder Time (Hours Before)</Label>
                <Select value={reminderHoursBefore} onValueChange={setReminderHoursBefore}>
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
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes or special instructions..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!trainerId}>
            {existingSchedule ? 'Update Schedule' : 'Create Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
