import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarBlank, ListBullets, ChartBar as ChartBarIcon, Plus, MapPin, Users as UsersIcon, Clock, Robot, UserCircleGear, UserPlus } from '@phosphor-icons/react'
import { Session, Course, User } from '@/lib/types'
import { format, startOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, isSameDay, isSameMonth, eachDayOfInterval, startOfDay, differenceInMinutes, setHours, setMinutes } from 'date-fns'
import { formatDuration } from '@/lib/helpers'
import { AutoScheduler } from './AutoScheduler'
import { GuidedScheduler } from './GuidedScheduler'
import { EnrollStudentsDialog } from '@/components/EnrollStudentsDialog'
import { toast } from 'sonner'
import { checkSessionConflicts, formatConflictMessage } from '@/lib/conflict-detection'

/** Props for the Schedule component. */
interface ScheduleProps {
  /** All training sessions to display on the schedule. */
  sessions: Session[]
  /** All available courses (used when creating or editing a session). */
  courses: Course[]
  /** All users, used to resolve trainer names and for assignment. */
  users: User[]
  /** The currently authenticated user; controls which scheduling actions are available. */
  currentUser: User
  /** Callback invoked when a new session is to be created. @param session - Partial session data. */
  onCreateSession: (session: Partial<Session>) => void
  /**
   * Callback invoked when an existing session is updated.
   * @param id - ID of the session to update.
   * @param updates - Partial updates to apply.
   */
  onUpdateSession: (id: string, updates: Partial<Session>) => void
  /**
   * Callback for navigating to another view.
   * @param view - Target view name.
   * @param data - Optional payload for the target view.
   */
  onNavigate: (view: string, data?: unknown) => void
  /** Optional navigation payload used to deep-link to a specific session. */
  navigationPayload?: unknown
  /** Optional callback invoked after a navigation payload has been consumed. */
  onNavigationPayloadConsumed?: () => void
}

/**
 * Type guard for schedule view navigation payload.
 * @param value - Unknown payload to validate.
 * @returns True when payload contains a string `sessionId`.
 */
function hasSessionIdPayload(value: unknown): value is { sessionId: string } {
  return !!value && typeof value === 'object' && 'sessionId' in value && typeof value.sessionId === 'string'
}

/** Roles that are allowed to create or modify schedule entries. */
const allowedScheduleManagers: ReadonlyArray<User['role']> = ['admin', 'trainer']

/** The available view modes for the schedule. */
type ViewType = 'calendar' | 'list' | 'board'

/** Type guard that narrows a string to {@link ViewType}. */
function isViewType(v: string): v is ViewType {
  return v === 'calendar' || v === 'list' || v === 'board'
}

/**
 * Renders the schedule management UI with calendar, list, and board views and handles session creation, editing, enrollment, drag-and-drop rescheduling, and conflict detection.
 *
 * @param props - Properties including `sessions`, `courses`, `users`, `currentUser`, and callbacks `onCreateSession`, `onUpdateSession`, and `onNavigate`.
 * Navigation payload deep-links are processed once per payload so later session list refreshes do not reopen the same sheet unexpectedly.
 * @returns The Schedule component's React element.
 */
export function Schedule({ sessions, courses, users, currentUser, onCreateSession, onUpdateSession, onNavigate, navigationPayload, onNavigationPayloadConsumed }: ScheduleProps) {
  const [viewType, setViewType] = useState<ViewType>('calendar')
  const [calendarPeriod, setCalendarPeriod] = useState<'day' | 'week' | 'month'>('month')
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [autoSchedulerOpen, setAutoSchedulerOpen] = useState(false)
  const [guidedSchedulerOpen, setGuidedSchedulerOpen] = useState(false)
  const [guidedSchedulerPrefilledDate, setGuidedSchedulerPrefilledDate] = useState<Date | null>(null)
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [draggedSession, setDraggedSession] = useState<Session | null>(null)
  const [dragOverDay, setDragOverDay] = useState<Date | null>(null)
  const [dragConflicts, setDragConflicts] = useState<string[]>([])
  const sessionsRef = useRef(sessions)
  const processedPayloadRef = useRef<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    location: '',
    startTime: '',
    endTime: '',
    capacity: '20',
    status: 'scheduled' as Session['status'],
  })

  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  useEffect(() => {
    if (navigationPayload && typeof navigationPayload === 'object' && 'create' in navigationPayload) {
      setGuidedSchedulerOpen(true)
      processedPayloadRef.current = null
      onNavigationPayloadConsumed?.()
      return
    }

    if (!hasSessionIdPayload(navigationPayload)) {
      processedPayloadRef.current = null
      return
    }

    if (processedPayloadRef.current === navigationPayload.sessionId) {
      return
    }

    const targetSession = sessionsRef.current.find((session) => session.id === navigationPayload.sessionId)
    if (!targetSession) {
      return
    }

    setSelectedSession(targetSession)
    setSheetOpen(true)
    setCurrentDate(new Date(targetSession.startTime))
    processedPayloadRef.current = navigationPayload.sessionId
    onNavigationPayloadConsumed?.()
  }, [navigationPayload, onNavigationPayloadConsumed, sessions])

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session)
    setSheetOpen(true)
  }

  const handleAutoSchedule = (sessions: Partial<Session>[]) => {
    sessions.forEach(session => onCreateSession(session))
    setAutoSchedulerOpen(false)
  }

  const handleGuidedSchedule = (sessions: Partial<Session>[]) => {
    sessions.forEach(session => onCreateSession(session))
    setGuidedSchedulerOpen(false)
    setGuidedSchedulerPrefilledDate(null)
  }

  const handleOpenGuidedScheduler = (prefilledDate?: Date) => {
    if (prefilledDate) {
      setGuidedSchedulerPrefilledDate(prefilledDate)
    } else {
      setGuidedSchedulerPrefilledDate(null)
    }
    setGuidedSchedulerOpen(true)
  }

  const handleEnrollStudents = (studentIds: string[]) => {
    if (!selectedSession) return

    const updatedEnrolledStudents = [...selectedSession.enrolledStudents, ...studentIds]
    onUpdateSession(selectedSession.id, {
      enrolledStudents: updatedEnrolledStudents
    })

    setSelectedSession({
      ...selectedSession,
      enrolledStudents: updatedEnrolledStudents
    })

    toast.success('Students enrolled', {
      description: `${studentIds.length} student${studentIds.length > 1 ? 's' : ''} enrolled successfully`
    })
  }

  const handleEditClick = () => {
    if (!selectedSession) return

    setEditingSession(selectedSession)
    setEditForm({
      title: selectedSession.title,
      location: selectedSession.location,
      startTime: format(new Date(selectedSession.startTime), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(new Date(selectedSession.endTime), "yyyy-MM-dd'T'HH:mm"),
      capacity: selectedSession.capacity.toString(),
      status: selectedSession.status,
    })
    setEditDialogOpen(true)
    setSheetOpen(false)
  }

  const handleSaveSessionEdit = () => {
    if (!editingSession) return

    const trimmedTitle = editForm.title.trim()
    const trimmedLocation = editForm.location.trim()

    if (!trimmedTitle) {
      toast.error('Title is required', {
        description: 'Please provide a session title before saving.',
      })
      return
    }

    if (!trimmedLocation) {
      toast.error('Location is required', {
        description: 'Please provide a session location before saving.',
      })
      return
    }

    const parsedStartTime = new Date(editForm.startTime)
    const parsedEndTime = new Date(editForm.endTime)
    const parsedCapacity = Number.parseInt(editForm.capacity, 10)

    if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedEndTime.getTime())) {
      toast.error('Invalid schedule time', {
        description: 'Please provide valid start and end times.',
      })
      return
    }

    if (parsedEndTime <= parsedStartTime) {
      toast.error('Invalid time range', {
        description: 'End time must be after start time.',
      })
      return
    }

    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
      toast.error('Invalid capacity', {
        description: 'Capacity must be a positive whole number.',
      })
      return
    }

    const enrolledCount = editingSession.enrolledStudents.length
    if (parsedCapacity < enrolledCount) {
      const enrolledStudentLabel = {
        one: 'student',
        other: 'students',
      }[new Intl.PluralRules('en').select(enrolledCount)]

      toast.error('Invalid capacity', {
        description: `Capacity cannot be less than the ${enrolledCount} currently enrolled ${enrolledStudentLabel}.`,
      })
      return
    }

    const updates: Partial<Session> = {
      title: trimmedTitle,
      location: trimmedLocation,
      startTime: parsedStartTime.toISOString(),
      endTime: parsedEndTime.toISOString(),
      capacity: parsedCapacity,
      status: editForm.status,
    }

    const tentativeSession: Session = {
      ...editingSession,
      ...updates,
      startTime: parsedStartTime.toISOString(),
      endTime: parsedEndTime.toISOString(),
      capacity: parsedCapacity,
      status: editForm.status,
      title: trimmedTitle,
      location: trimmedLocation,
    }

    // checkSessionConflicts ignores matching ids, so the edited session won't conflict with itself.
    const conflictCheck = checkSessionConflicts(
      tentativeSession,
      parsedStartTime,
      parsedEndTime,
      sessions,
      users
    )

    if (conflictCheck.hasConflicts) {
      toast.error('Cannot save session changes', {
        description: formatConflictMessage(conflictCheck.conflicts),
        duration: 6000,
      })
      return
    }

    onUpdateSession(editingSession.id, updates)

    setSelectedSession((current) => {
      if (!current || current.id !== editingSession.id) return current
      return { ...current, ...updates }
    })

    setEditDialogOpen(false)
    setEditingSession(null)

    toast.success('Session updated', {
      description: 'Schedule changes have been saved.',
    })
  }

  const availableStudents = users.filter(u => u.role === 'employee')
  const canManageSchedule = allowedScheduleManagers.includes(currentUser.role)

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date())
      return
    }

    const change = direction === 'prev' ? -1 : 1
    if (calendarPeriod === 'day') {
      setCurrentDate(addDays(currentDate, change))
    } else if (calendarPeriod === 'week') {
      setCurrentDate(addWeeks(currentDate, change))
    } else {
      setCurrentDate(addMonths(currentDate, change))
    }
  }

  const handleDragStart = (e: React.DragEvent, session: Session) => {
    setDraggedSession(session)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4'
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedSession(null)
    setDragOverDay(null)
    setDragConflicts([])
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }

  const handleDragOver = (e: React.DragEvent, day: Date) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDay(day)

    if (draggedSession) {
      const originalStart = new Date(draggedSession.startTime)
      const originalEnd = new Date(draggedSession.endTime)
      const sessionDuration = differenceInMinutes(originalEnd, originalStart)

      const newStart = new Date(day)
      newStart.setHours(originalStart.getHours())
      newStart.setMinutes(originalStart.getMinutes())

      const newEnd = new Date(newStart)
      newEnd.setMinutes(newEnd.getMinutes() + sessionDuration)

      const conflictCheck = checkSessionConflicts(
        draggedSession,
        newStart,
        newEnd,
        sessions,
        users
      )

      if (conflictCheck.hasConflicts) {
        setDragConflicts(conflictCheck.conflicts.map(c => c.message))
        e.dataTransfer.dropEffect = 'none'
      } else {
        setDragConflicts([])
      }
    }
  }

  const handleDragLeave = () => {
    setDragOverDay(null)
    setDragConflicts([])
  }

  const handleDrop = (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault()
    setDragOverDay(null)

    if (!draggedSession) return

    const originalStart = new Date(draggedSession.startTime)
    const originalEnd = new Date(draggedSession.endTime)
    const sessionDuration = differenceInMinutes(originalEnd, originalStart)

    const newStart = new Date(targetDay)
    newStart.setHours(originalStart.getHours())
    newStart.setMinutes(originalStart.getMinutes())

    const newEnd = new Date(newStart)
    newEnd.setMinutes(newEnd.getMinutes() + sessionDuration)

    const conflictCheck = checkSessionConflicts(
      draggedSession,
      newStart,
      newEnd,
      sessions,
      users
    )

    if (conflictCheck.hasConflicts) {
      const errorConflicts = conflictCheck.conflicts.filter(c => c.severity === 'error')

      if (errorConflicts.length > 0) {
        toast.error('Cannot move session', {
          description: formatConflictMessage(conflictCheck.conflicts),
          duration: 6000,
        })
        setDraggedSession(null)
        return
      }
    }

    onUpdateSession(draggedSession.id, {
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
    })

    toast.success('Session rescheduled', {
      description: `${draggedSession.title} moved to ${format(newStart, 'MMMM d, yyyy')}`,
    })

    setDraggedSession(null)
  }

  const renderDailyView = () => {
    const isToday = isSameDay(currentDate, new Date())
    const daySessions = sessions
      .filter(s => isSameDay(new Date(s.startTime), currentDate))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    const isDragOver = dragOverDay && isSameDay(dragOverDay, currentDate)
    const hasConflict = isDragOver && dragConflicts.length > 0

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('prev')}
            >
              Previous Day
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('today')}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('next')}
            >
              Next Day
            </Button>
          </div>
          <h3 className="text-lg font-medium">
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </h3>
        </div>

        <div
          data-day-dropzone
          className={`border rounded-lg p-6 min-h-[400px] transition-colors cursor-pointer hover:border-primary/50 ${hasConflict ? 'border-destructive bg-destructive/10 border-2' :
            isDragOver ? 'border-accent bg-accent/10 border-2' :
              isToday ? 'border-primary bg-primary/5' :
                'border-border'
            }`}
          onDragOver={(e) => handleDragOver(e, currentDate)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, currentDate)}
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (
              canManageSchedule &&
              !target.closest('[draggable]') &&
              (target.closest('[data-calendar-cell-body]') || target === e.currentTarget)
            ) {
              handleOpenGuidedScheduler(currentDate)
            }
          }}
        >
          {hasConflict && (
            <div className="mb-4 p-3 bg-destructive/20 border border-destructive rounded-lg">
              <div className="font-semibold text-destructive mb-1">⚠️ Scheduling Conflicts</div>
              <ul className="text-sm text-destructive space-y-1">
                {dragConflicts.map((conflict, idx) => (
                  <li key={idx}>• {conflict}</li>
                ))}
              </ul>
            </div>
          )}
          {daySessions.length === 0 ? (
            <div className="flex items-center justify-center h-[350px] text-muted-foreground">
              No sessions scheduled for this day
            </div>
          ) : (
            <div data-calendar-cell-body className="space-y-3">
              {daySessions.map(session => {
                const course = courses.find(c => c.id === session.courseId)
                const trainer = users.find(u => u.id === session.trainerId)
                return (
                  <div
                    key={session.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, session)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSessionClick(session)
                    }}
                    className="w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-secondary transition-colors cursor-move"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-foreground text-lg">{session.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {format(new Date(session.startTime), 'h:mm a')} - {format(new Date(session.endTime), 'h:mm a')}
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin size={16} />
                            {session.location}
                          </span>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <UsersIcon size={16} />
                            {session.enrolledStudents.length}/{session.capacity}
                          </span>
                          {trainer && (
                            <span className="text-sm text-muted-foreground">
                              Trainer: {trainer.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant={session.status === 'scheduled' ? 'secondary' : session.status === 'completed' ? 'default' : 'outline'}>
                        {session.status}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderWeeklyView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('prev')}
            >
              Previous Week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('today')}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('next')}
            >
              Next Week
            </Button>
          </div>
          <h3 className="text-lg font-medium">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </h3>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const daySessions = sessions.filter(s => isSameDay(new Date(s.startTime), day))
            const isToday = isSameDay(day, new Date())
            const isDragOver = dragOverDay && isSameDay(dragOverDay, day)
            const hasConflict = isDragOver && dragConflicts.length > 0

            return (
              <div
                key={day.toString()}
                className={`border rounded-lg p-3 min-h-[200px] transition-colors cursor-pointer hover:border-primary/50 ${hasConflict ? 'border-destructive bg-destructive/10 border-2' :
                  isDragOver ? 'border-accent bg-accent/10 border-2' :
                    isToday ? 'border-primary bg-primary/5' :
                      'border-border'
                  }`}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
                onClick={(e) => {
                  const target = e.target as HTMLElement
                  if (canManageSchedule && !target.closest('[draggable]') && (target.closest('[data-calendar-cell-body]') || target === e.currentTarget)) {
                    handleOpenGuidedScheduler(day)
                  }
                }}
              >
                <div className={`text-sm font-medium mb-2 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {format(day, 'EEE')}
                </div>
                <div className={`text-2xl font-semibold mb-3 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </div>
                {hasConflict && (
                  <div className="mb-2 p-1 bg-destructive/20 rounded text-xs text-destructive font-medium">
                    ⚠️ Conflict
                  </div>
                )}
                <div data-calendar-cell-body className="space-y-2">
                  {daySessions.map(session => {
                    return (
                      <div
                        key={session.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, session)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSessionClick(session)
                        }}
                        className="w-full text-left p-2 rounded bg-primary text-primary-foreground text-xs hover:opacity-90 transition-opacity cursor-move"
                      >
                        <div className="font-medium truncate">{session.title}</div>
                        <div className="opacity-90">{format(new Date(session.startTime), 'h:mm a')}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderMonthlyView = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 0 })
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: addDays(calendarEnd, 6) })

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('prev')}
            >
              Previous Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('today')}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('next')}
            >
              Next Month
            </Button>
          </div>
          <h3 className="text-lg font-medium">
            {format(currentDate, 'MMMM yyyy')}
          </h3>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-muted">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground border-r border-b last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const daySessions = sessions.filter(s => isSameDay(new Date(s.startTime), day))
              const isToday = isSameDay(day, new Date())
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isDragOver = dragOverDay && isSameDay(dragOverDay, day)
              const hasConflict = isDragOver && dragConflicts.length > 0

              return (
                <div
                  key={day.toString()}
                  className={`border-r border-b last:border-r-0 p-2 min-h-[100px] transition-colors cursor-pointer hover:border-primary/50 ${!isCurrentMonth ? 'bg-muted/30' : ''
                    } ${isToday ? 'bg-primary/5' : ''} ${hasConflict ? 'bg-destructive/10 border-destructive border-2' :
                      isDragOver ? 'bg-accent/10 border-accent border-2' : ''
                    }`}
                  onDragOver={(e) => handleDragOver(e, day)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (canManageSchedule && !target.closest('[draggable]') && (target.closest('[data-calendar-cell-body]') || target === e.currentTarget)) {
                      handleOpenGuidedScheduler(day)
                    }
                  }}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary font-bold' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                    {format(day, 'd')}
                  </div>
                  {hasConflict && (
                    <div className="mb-1 p-0.5 bg-destructive/20 rounded text-xs text-destructive font-medium">
                      ⚠️
                    </div>
                  )}
                  <div data-calendar-cell-body className="space-y-1">
                    {daySessions.slice(0, 2).map(session => (
                      <div
                        key={session.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, session)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSessionClick(session)
                        }}
                        className="w-full text-left px-1 py-0.5 rounded bg-primary text-primary-foreground text-xs hover:opacity-90 transition-opacity truncate cursor-move"
                      >
                        {format(new Date(session.startTime), 'h:mm a')} {session.title}
                      </div>
                    ))}
                    {daySessions.length > 2 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{daySessions.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderCalendarView = () => {
    if (calendarPeriod === 'day') return renderDailyView()
    if (calendarPeriod === 'week') return renderWeeklyView()
    return renderMonthlyView()
  }

  const renderListView = () => {
    const sortedSessions = [...sessions].sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )

    return (
      <div className="space-y-2">
        {sortedSessions.map(session => {
          const course = courses.find(c => c.id === session.courseId)
          const trainer = users.find(u => u.id === session.trainerId)

          return (
            <button
              key={session.id}
              onClick={() => handleSessionClick(session)}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-secondary transition-colors text-left"
            >
              <div className="flex flex-col items-center justify-center w-16 h-16 bg-primary text-primary-foreground rounded">
                <div className="text-xs font-medium">{format(new Date(session.startTime), 'MMM')}</div>
                <div className="text-2xl font-bold">{format(new Date(session.startTime), 'd')}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{session.title}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {format(new Date(session.startTime), 'EEEE, h:mm a')} - {format(new Date(session.endTime), 'h:mm a')}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={14} />
                    {session.location}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UsersIcon size={14} />
                    {session.enrolledStudents.length}/{session.capacity}
                  </span>
                  {course && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={14} />
                      {formatDuration(course.duration)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={session.status === 'scheduled' ? 'secondary' : session.status === 'completed' ? 'default' : 'outline'}>
                  {session.status}
                </Badge>
                {trainer && (
                  <div className="text-xs text-muted-foreground">
                    {trainer.name}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  const renderBoardView = () => {
    const statusGroups = {
      scheduled: sessions.filter(s => s.status === 'scheduled'),
      'in-progress': sessions.filter(s => s.status === 'in-progress'),
      completed: sessions.filter(s => s.status === 'completed'),
    }

    return (
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(statusGroups).map(([status, statusSessions]) => (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold capitalize">{status.replace('-', ' ')}</h3>
              <Badge variant="outline">{statusSessions.length}</Badge>
            </div>
            <div className="space-y-2">
              {statusSessions.map(session => {
                const course = courses.find(c => c.id === session.courseId)
                return (
                  <button
                    key={session.id}
                    onClick={() => handleSessionClick(session)}
                    className="w-full p-3 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-left"
                  >
                    <div className="font-medium text-foreground mb-1">{session.title}</div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {format(new Date(session.startTime), 'MMM d, h:mm a')}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{session.location}</span>
                      <span className="text-muted-foreground">{session.enrolledStudents.length}/{session.capacity}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Schedule</h1>
          <p className="text-muted-foreground mt-1">Manage training sessions and schedules</p>
        </div>
        {canManageSchedule && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAutoSchedulerOpen(true)}>
              <Robot size={18} weight="bold" className="mr-2" />
              Auto-Schedule
            </Button>
            <Button variant="outline" onClick={() => handleOpenGuidedScheduler()}>
              <UserCircleGear size={18} weight="bold" className="mr-2" />
              Guided Schedule
            </Button>
            <Button onClick={() => onNavigate('schedule', { create: true })}>
              <Plus size={18} weight="bold" className="mr-2" />
              New Session
            </Button>
          </div>
        )}
      </div>

      <Tabs value={viewType} onValueChange={(v) => { if (isViewType(v)) { setViewType(v) } else { console.warn(`Unknown view type: "${v}"`) } }}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="calendar">
              <CalendarBlank size={18} className="mr-2" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="list">
              <ListBullets size={18} className="mr-2" />
              List
            </TabsTrigger>
            <TabsTrigger value="board">
              <ChartBarIcon size={18} className="mr-2" />
              Board
            </TabsTrigger>
          </TabsList>

          {viewType === 'calendar' && (
            <div className="flex items-center gap-2">
              <Button
                variant={calendarPeriod === 'day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCalendarPeriod('day')}
              >
                Day
              </Button>
              <Button
                variant={calendarPeriod === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCalendarPeriod('week')}
              >
                Week
              </Button>
              <Button
                variant={calendarPeriod === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCalendarPeriod('month')}
              >
                Month
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="calendar" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {renderCalendarView()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {renderListView()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="board" className="mt-6">
          {renderBoardView()}
        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          {selectedSession && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedSession.title}</SheetTitle>
                <SheetDescription>
                  {format(new Date(selectedSession.startTime), 'EEEE, MMMM d, yyyy')}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <div>
                  <Label>Time</Label>
                  <div className="text-sm text-muted-foreground mt-1">
                    {format(new Date(selectedSession.startTime), 'h:mm a')} - {format(new Date(selectedSession.endTime), 'h:mm a')}
                  </div>
                </div>
                <div>
                  <Label>Location</Label>
                  <div className="text-sm text-muted-foreground mt-1">{selectedSession.location}</div>
                </div>
                <div>
                  <Label>Capacity</Label>
                  <div className="text-sm text-muted-foreground mt-1">
                    {selectedSession.enrolledStudents.length} / {selectedSession.capacity} enrolled
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">
                    <Badge>{selectedSession.status}</Badge>
                  </div>
                </div>
                {canManageSchedule && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEnrollDialogOpen(true)}
                      disabled={selectedSession.enrolledStudents.length >= selectedSession.capacity}
                    >
                      <UserPlus size={18} className="mr-2" />
                      Enroll Students
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    className={canManageSchedule ? 'flex-1' : 'w-full'}
                    onClick={() => {
                      onNavigate('courses', { courseId: selectedSession.courseId })
                      setSheetOpen(false)
                    }}
                  >
                    View Course
                  </Button>
                  {canManageSchedule && (
                    <Button variant="outline" className="flex-1" onClick={handleEditClick}>
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setEditingSession(null)
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>
              Update session details and save your schedule changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-session-title">Title *</Label>
              <Input
                id="edit-session-title"
                value={editForm.title}
                onChange={(e) => setEditForm((current) => ({ ...current, title: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-session-location">Location *</Label>
              <Input
                id="edit-session-location"
                value={editForm.location}
                onChange={(e) => setEditForm((current) => ({ ...current, location: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-session-start">Start Time *</Label>
                <Input
                  id="edit-session-start"
                  type="datetime-local"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm((current) => ({ ...current, startTime: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-session-end">End Time *</Label>
                <Input
                  id="edit-session-end"
                  type="datetime-local"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm((current) => ({ ...current, endTime: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-session-capacity">Capacity</Label>
                <Input
                  id="edit-session-capacity"
                  type="number"
                  min={1}
                  value={editForm.capacity}
                  onChange={(e) => setEditForm((current) => ({ ...current, capacity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm((current) => ({ ...current, status: value as Session['status'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSessionEdit}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={autoSchedulerOpen} onOpenChange={setAutoSchedulerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Automatic Trainer Scheduler</DialogTitle>
            <DialogDescription>
              Let AI match trainers based on certifications and shift availability
            </DialogDescription>
          </DialogHeader>
          <AutoScheduler
            users={users}
            courses={courses}
            onSessionsCreated={handleAutoSchedule}
            onClose={() => setAutoSchedulerOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={guidedSchedulerOpen} onOpenChange={setGuidedSchedulerOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Guided Trainer Scheduler</DialogTitle>
            <DialogDescription>
              Review data-driven insights while you select the best trainer
            </DialogDescription>
          </DialogHeader>
          <GuidedScheduler
            users={users}
            courses={courses}
            onSessionsCreated={handleGuidedSchedule}
            onClose={() => {
              setGuidedSchedulerOpen(false)
              setGuidedSchedulerPrefilledDate(null)
            }}
            prefilledDate={guidedSchedulerPrefilledDate}
          />
        </DialogContent>
      </Dialog>

      {selectedSession && (
        <EnrollStudentsDialog
          open={enrollDialogOpen}
          onOpenChange={setEnrollDialogOpen}
          session={selectedSession}
          allSessions={sessions}
          availableStudents={availableStudents}
          onEnrollStudents={handleEnrollStudents}
        />
      )}
    </div>
  )
}
