import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Calendar, Users, Clock, MapPin } from '@phosphor-icons/react'
import { ScheduleTemplate, Session } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { addDays, addWeeks, addMonths, format } from 'date-fns'

/**
 * Props for the {@link ApplyTemplateDialog} component.
 */
interface ApplyTemplateDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Callback to update the open state of the dialog. */
  onOpenChange: (open: boolean) => void
  /** The schedule template to apply, or `null` when no template has been selected yet. */
  template: ScheduleTemplate | null
  /**
   * Callback invoked with the generated session stubs when the user confirms.
   * @param sessions - Partially-constructed {@link Session} objects ready to be persisted.
   */
  onApply: (sessions: Partial<Session>[]) => void
}

/**
 * Dialog for configuring and applying a {@link ScheduleTemplate} to create training sessions.
 *
 * Lets the user select a start date, number of recurrence cycles, and optional overrides
 * (course, location, capacity). A live preview of the first five generated sessions is shown
 * before the user confirms. On confirmation, {@link ApplyTemplateDialogProps.onApply} receives
 * the full list of generated session stubs.
 */
export function ApplyTemplateDialog({ open, onOpenChange, template, onApply }: ApplyTemplateDialogProps) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [occurrences, setOccurrences] = useState('4')
  const [courseOverride, setCourseOverride] = useState('')
  const [locationOverride, setLocationOverride] = useState('')
  const [capacityOverride, setCapacityOverride] = useState('')
  const [useAutoAssign, setUseAutoAssign] = useState(template?.autoAssignTrainers ?? true)
  const [sendNotifications, setSendNotifications] = useState(template?.notifyParticipants ?? true)

  /**
   * Generates an array of partial {@link Session} objects from a {@link ScheduleTemplate}.
   *
   * Iterates over the requested number of recurrence cycles starting from `startDate`,
   * computes the concrete date/time for each template session slot (respecting `dayOfWeek`
   * and the template's `recurrenceType`), and applies any user-supplied overrides for
   * course, location, and capacity.
   *
   * @returns An array of partial session objects, or an empty array when `template` is null
   *          or `startDate` is invalid.
   */
  const generateSessions = (): Partial<Session>[] => {
    if (!template) return []

    const sessions: Partial<Session>[] = []
    const numOccurrences = parseInt(occurrences) || 1
    const [yearStr, monthStr, dayStr] = startDate.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const day = Number(dayStr)

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      year < 1900 ||
      year > 3000 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return []
    }

    const baseDate = new Date(year, month - 1, day)

    if (
      Number.isNaN(baseDate.getTime()) ||
      baseDate.getFullYear() !== year ||
      baseDate.getMonth() !== month - 1 ||
      baseDate.getDate() !== day
    ) {
      return []
    }

    for (let i = 0; i < numOccurrences; i++) {
      let cycleStartDate: Date

      switch (template.recurrenceType) {
        case 'daily':
          cycleStartDate = addDays(baseDate, i)
          break
        case 'weekly':
          cycleStartDate = addWeeks(baseDate, i)
          break
        case 'biweekly':
          cycleStartDate = addWeeks(baseDate, i * 2)
          break
        case 'monthly':
          cycleStartDate = addMonths(baseDate, i)
          break
        case 'custom':
          cycleStartDate = addDays(baseDate, i * (template.cycleDays || 7))
          break
        default:
          cycleStartDate = addWeeks(baseDate, i)
      }

      template.sessions.forEach(templateSession => {
        let sessionDate = new Date(cycleStartDate)

        if (template.recurrenceType !== 'daily' && templateSession.dayOfWeek !== undefined) {
          const dayDiff = templateSession.dayOfWeek - cycleStartDate.getDay()
          sessionDate = addDays(cycleStartDate, dayDiff >= 0 ? dayDiff : dayDiff + 7)
        }

        const [hours, minutes] = templateSession.time.split(':').map(Number)
        sessionDate.setHours(hours, minutes, 0, 0)

        const endTime = new Date(sessionDate)
        endTime.setMinutes(endTime.getMinutes() + templateSession.duration)

        sessions.push({
          courseId: courseOverride || template.courseId || '',
          title: template.name,
          startTime: sessionDate.toISOString(),
          endTime: endTime.toISOString(),
          shift: templateSession.shift,
          location: locationOverride || templateSession.location || 'TBD',
          capacity: capacityOverride ? parseInt(capacityOverride) : templateSession.capacity,
          enrolledStudents: [],
          status: 'scheduled'
        })
      })
    }

    return sessions
  }

  const handleApply = () => {
    const sessions = generateSessions()
    onApply(sessions)
    onOpenChange(false)
  }

  const previewSessions = generateSessions().slice(0, 5)
  const totalSessions = template ? template.sessions.length * parseInt(occurrences || '1') : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply Schedule Template</DialogTitle>
          <DialogDescription>
            Configure how this template will be applied to create training sessions.
          </DialogDescription>
        </DialogHeader>

        {template && (
          <div className="flex flex-col gap-6 py-4">
            <Card className="p-4 bg-muted/30">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </div>
                  <Badge variant="secondary">{template.category}</Badge>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {template.recurrenceType}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {template.sessions.length} session{template.sessions.length !== 1 ? 's' : ''} per cycle
                  </span>
                </div>
              </div>
            </Card>

            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="start-date">Start Date *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="occurrences">Number of Cycles *</Label>
                  <Input
                    id="occurrences"
                    type="number"
                    min="1"
                    max="52"
                    value={occurrences}
                    onChange={e => setOccurrences(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    Will create {totalSessions} total session{totalSessions !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="course-override">Course Override (Optional)</Label>
                <Input
                  id="course-override"
                  value={courseOverride}
                  onChange={e => setCourseOverride(e.target.value)}
                  placeholder={template.courseId ? 'Using template default' : 'Leave empty to set later'}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="location-override">Location Override (Optional)</Label>
                  <Input
                    id="location-override"
                    value={locationOverride}
                    onChange={e => setLocationOverride(e.target.value)}
                    placeholder="Override template locations"
                  />
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="capacity-override">Capacity Override (Optional)</Label>
                  <Input
                    id="capacity-override"
                    type="number"
                    min="1"
                    value={capacityOverride}
                    onChange={e => setCapacityOverride(e.target.value)}
                    placeholder="Override template capacity"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="use-auto-assign">Auto-assign Trainers</Label>
                    <span className="text-xs text-muted-foreground">
                      Automatically find and assign trainers to sessions
                    </span>
                  </div>
                  <Switch id="use-auto-assign" checked={useAutoAssign} onCheckedChange={setUseAutoAssign} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="send-notifications">Send Notifications</Label>
                    <span className="text-xs text-muted-foreground">Notify participants when sessions are created</span>
                  </div>
                  <Switch id="send-notifications" checked={sendNotifications} onCheckedChange={setSendNotifications} />
                </div>
              </div>
            </div>

            {previewSessions.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Preview (First {Math.min(5, previewSessions.length)} Sessions)</Label>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {previewSessions.map((session, index) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {format(new Date(session.startTime!), 'EEE, MMM d, yyyy')}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {session.shift}
                            </Badge>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {format(new Date(session.startTime!), 'h:mm a')} - {format(new Date(session.endTime!), 'h:mm a')}
                            </span>
                            {session.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={12} />
                                {session.location}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Users size={12} />
                              Capacity: {session.capacity}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {totalSessions > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      ...and {totalSessions - 5} more session{totalSessions - 5 !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!template || !startDate || !occurrences}>
            Create {totalSessions} Session{totalSessions !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
