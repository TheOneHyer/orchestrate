import { useEffect, useMemo, useRef, useState } from 'react'
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
import { AttendanceRecord, Session, Course, User, Enrollment } from '@/lib/types'
import { RecordScoreDialog } from '@/components/RecordScoreDialog'
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
  /** All enrollments visible to the current user, used to display per-student status in session details. */
  enrollments?: Enrollment[]
  /** Attendance records visible to the current user. */
  attendanceRecords?: AttendanceRecord[]
  /** Callback invoked when a new session is to be created. @param session - Partial session data. */
  onCreateSession: (session: Partial<Session>) => void
  /**
   * Callback invoked when an existing session is updated.
   * @param id - ID of the session to update.
   * @param updates - Partial updates to apply.
   */
  onUpdateSession: (id: string, updates: Partial<Session>) => void
  /** Callback invoked when an existing session is deleted. */
  onDeleteSession?: (id: string) => void
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
  /**
   * Callback invoked when an admin or trainer records a score for an enrollment.
   * @param enrollmentId - ID of the enrollment being scored.
   * @param score - The assessment score (0–100).
   */
  onRecordScore?: (enrollmentId: string, score: number) => void
  /** Callback invoked when attendance is marked for an enrolled student in a session. */
  onMarkAttendance?: (sessionId: string, userId: string, status: AttendanceRecord['status']) => void
}

/**
 * Type guard for schedule view navigation payload.
 * @param value - Unknown payload to validate.
 * @returns True when payload contains a string `sessionId`.
 */
function hasSessionIdPayload(value: unknown): value is { sessionId: string } {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>

  return 'sessionId' in candidate && typeof candidate.sessionId === 'string'
}

/**
 * Type guard for schedule view create-intent navigation payload.
 * @param value - Unknown payload to validate.
 * @returns True when payload has `create: true`.
 */
function hasCreatePayload(value: unknown): value is { create: true } {
  return !!value && typeof value === 'object' && 'create' in value && (value as { create?: unknown }).create === true
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
export function Schedule({ sessions, courses, users, currentUser, enrollments, attendanceRecords, onCreateSession, onUpdateSession, onDeleteSession, onNavigate, navigationPayload, onNavigationPayloadConsumed, onRecordScore, onMarkAttendance }: ScheduleProps) {
  const [viewType, setViewType] = useState<ViewType>('calendar')
  const [calendarPeriod, setCalendarPeriod] = useState<'day' | 'week' | 'month'>('month')
  const [searchQuery, setSearchQuery] = useState('')
  const [trainerFilter, setTrainerFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'next-7' | 'next-30' | 'past'>('all')
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [autoSchedulerOpen, setAutoSchedulerOpen] = useState(false)
  const [guidedSchedulerOpen, setGuidedSchedulerOpen] = useState(false)
  const [guidedSchedulerPrefilledDate, setGuidedSchedulerPrefilledDate] = useState<Date | null>(null)
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false)
  const [recordScoreEnrollmentId, setRecordScoreEnrollmentId] = useState<string | null>(null)
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

  const filteredSessions = useMemo(() => {
    const userById = new Map(users.map((user) => [user.id, user]))
    const courseById = new Map(courses.map((courseItem) => [courseItem.id, courseItem]))
    const now = new Date()
    const query = searchQuery.trim().toLowerCase()

    return sessions.filter((session) => {
      const trainer = userById.get(session.trainerId)
      const course = courseById.get(session.courseId)

      const matchesQuery = !query || [
        session.title,
        session.location,
        trainer?.name || '',
        course?.title || '',
      ].some((value) => value.toLowerCase().includes(query))

      const matchesTrainer = trainerFilter === 'all' || session.trainerId === trainerFilter
      const matchesCourse = courseFilter === 'all' || session.courseId === courseFilter
      const matchesDepartment = departmentFilter === 'all' || trainer?.department === departmentFilter
      const matchesStatus = statusFilter === 'all' || session.status === statusFilter

      const sessionStart = new Date(session.startTime)
      const diffDays = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      const matchesDate = (() => {
        switch (dateFilter) {
          case 'next-7':
            return diffDays >= 0 && diffDays <= 7
          case 'next-30':
            return diffDays >= 0 && diffDays <= 30
          case 'past':
            return diffDays < 0
          default:
            return true
        }
      })()

      return matchesQuery && matchesTrainer && matchesCourse && matchesDepartment && matchesStatus && matchesDate
    })
  }, [sessions, users, courses, searchQuery, trainerFilter, courseFilter, departmentFilter, statusFilter, dateFilter])

  const trainerOptions = users.filter((user) => user.role === 'trainer')
  const departmentOptions = Array.from(new Set(trainerOptions.map((user) => user.department))).sort()
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user] as const)), [users])
  const enrollmentsBySessionId = useMemo(() => {
    const bySessionId = new Map<string, Map<string, Enrollment>>()

    for (const enrollment of enrollments ?? []) {
      if (!enrollment.sessionId) {
        continue
      }

      const sessionEnrollments = bySessionId.get(enrollment.sessionId)
      if (sessionEnrollments) {
        sessionEnrollments.set(enrollment.userId, enrollment)
        continue
      }

      bySessionId.set(enrollment.sessionId, new Map([[enrollment.userId, enrollment]]))
    }

    return bySessionId
  }, [enrollments])
  const attendanceBySessionId = useMemo(() => {
    const bySessionId = new Map<string, Map<string, AttendanceRecord>>()

    for (const attendanceRecord of attendanceRecords ?? []) {
      const sessionAttendance = bySessionId.get(attendanceRecord.sessionId)
      if (sessionAttendance) {
        sessionAttendance.set(attendanceRecord.userId, attendanceRecord)
        continue
      }

      bySessionId.set(attendanceRecord.sessionId, new Map([[attendanceRecord.userId, attendanceRecord]]))
    }

    return bySessionId
  }, [attendanceRecords])
  const selectedSessionEnrollments = useMemo(
    () =>
      selectedSession
        ? enrollmentsBySessionId.get(selectedSession.id) ?? new Map<string, Enrollment>()
        : new Map<string, Enrollment>(),
    [selectedSession, enrollmentsBySessionId],
  )
  const selectedSessionAttendance = useMemo(
    () =>
      selectedSession
        ? attendanceBySessionId.get(selectedSession.id) ?? new Map<string, AttendanceRecord>()
        : new Map<string, AttendanceRecord>(),
    [selectedSession, attendanceBySessionId],
  )
  const visibleSelectedSessionStudentIds = useMemo(() => {
    const userCanManageSchedule = allowedScheduleManagers.includes(currentUser.role)

    if (!selectedSession) {
      return [] as string[]
    }

    if (userCanManageSchedule) {
      return selectedSession.enrolledStudents
    }

    return selectedSession.enrolledStudents.filter((studentId) => studentId === currentUser.id)
  }, [currentUser.id, currentUser.role, selectedSession])
  const recordScoreContext = useMemo(() => {
    if (!recordScoreEnrollmentId || !onRecordScore) {
      return null
    }

    const enrollment = (enrollments ?? []).find((entry) => entry.id === recordScoreEnrollmentId)
    if (!enrollment) {
      return null
    }

    const course = courses.find((entry) => entry.id === enrollment.courseId)
    if (!course) {
      return null
    }

    const student = usersById.get(enrollment.userId)
    if (!student) {
      return null
    }

    return {
      enrollment,
      course,
      student,
    }
  }, [courses, enrollments, onRecordScore, recordScoreEnrollmentId, usersById])

  useEffect(() => {
    if (hasCreatePayload(navigationPayload)) {
      // Guard against re-processing the same create-intent when `sessions` updates
      // but `onNavigationPayloadConsumed` is not provided (so the payload persists).
      if (processedPayloadRef.current === '__create__') {
        return
      }
      setGuidedSchedulerPrefilledDate(null)
      setGuidedSchedulerOpen(true)
      processedPayloadRef.current = '__create__'
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
      updatedAt: editingSession.updatedAt,
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
  const canDeleteSession = currentUser.role === 'admin' && typeof onDeleteSession === 'function'

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
    if (!canManageSchedule) {
      return
    }

    setDraggedSession(session)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4'
    }
  }

  const handleBoardColumnDrop = (e: React.DragEvent, status: Session['status']) => {
    e.preventDefault()

    if (!canManageSchedule) {
      setDraggedSession(null)
      return
    }

    if (!draggedSession || draggedSession.status === status) {
      setDraggedSession(null)
      return
    }

    onUpdateSession(draggedSession.id, { status, updatedAt: draggedSession.updatedAt })

    if (selectedSession?.id === draggedSession.id) {
      const { updatedAt: _staleUpdatedAt, ...rest } = draggedSession
      setSelectedSession({ ...rest, status })
    }

    toast.success('Session status updated', {
      description: `${draggedSession.title} moved to ${status.replace('-', ' ')}.`
    })
    setDraggedSession(null)
  }

  const handleDeleteSelectedSession = () => {
    if (!selectedSession || !canDeleteSession) {
      return
    }

    const confirmed = window.confirm(`Delete ${selectedSession.title}? This cannot be undone.`)
    if (!confirmed) {
      return
    }

    onDeleteSession(selectedSession.id)
    setSheetOpen(false)
    setSelectedSession(null)
    toast.success('Session deleted', {
      description: 'The session and its linked enrollments have been removed.',
    })
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
      updatedAt: draggedSession.updatedAt,
    })

    toast.success('Session rescheduled', {
      description: `${draggedSession.title} moved to ${format(newStart, 'MMMM d, yyyy')}`,
    })

    setDraggedSession(null)
  }

  const renderDailyView = () => {
    const isToday = isSameDay(currentDate, new Date())
    const daySessions = filteredSessions
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
            const daySessions = filteredSessions.filter(s => isSameDay(new Date(s.startTime), day))
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
              const daySessions = filteredSessions.filter(s => isSameDay(new Date(s.startTime), day))
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
    const sortedSessions = [...filteredSessions].sort((a, b) =>
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
      scheduled: filteredSessions.filter(s => s.status === 'scheduled'),
      'in-progress': filteredSessions.filter(s => s.status === 'in-progress'),
      completed: filteredSessions.filter(s => s.status === 'completed'),
      cancelled: filteredSessions.filter(s => s.status === 'cancelled'),
    }

    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {Object.entries(statusGroups).map(([status, statusSessions]) => (
          <div
            key={status}
            className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3"
            {...(canManageSchedule ? {
              onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              },
              onDrop: (event: React.DragEvent<HTMLDivElement>) => handleBoardColumnDrop(event, status as Session['status']),
            } : {})}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold capitalize">{status.replace('-', ' ')}</h3>
              <Badge variant="outline">{statusSessions.length}</Badge>
            </div>
            <div className="space-y-2">
              {statusSessions.map(session => {
                return (
                  <button
                    key={session.id}
                    {...(canManageSchedule ? {
                      draggable: true,
                      onDragStart: (event: React.DragEvent<HTMLButtonElement>) => handleDragStart(event, session),
                      onDragEnd: handleDragEnd,
                    } : {})}
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

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <Input
              placeholder="Search by session, trainer, location, or course..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <Select value={trainerFilter} onValueChange={setTrainerFilter}>
            <SelectTrigger aria-label="Filter by trainer">
              <SelectValue placeholder="Filter by trainer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trainers</SelectItem>
              {trainerOptions.map((trainer) => (
                <SelectItem key={trainer.id} value={trainer.id}>{trainer.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger aria-label="Filter by course">
              <SelectValue placeholder="Filter by course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger aria-label="Filter by department">
              <SelectValue placeholder="Filter by department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departmentOptions.map((department) => (
                <SelectItem key={department} value={department}>{department}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in-progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as typeof dateFilter)}>
              <SelectTrigger aria-label="Date window">
                <SelectValue placeholder="Date window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dates</SelectItem>
                <SelectItem value="next-7">Next 7 days</SelectItem>
                <SelectItem value="next-30">Next 30 days</SelectItem>
                <SelectItem value="past">Past sessions</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
                    {canDeleteSession && (
                      <Button variant="destructive" className="flex-1" onClick={handleDeleteSelectedSession}>
                        Delete Session
                      </Button>
                    )}
                  </div>
                )}
                {visibleSelectedSessionStudentIds.length > 0 && (
                  <div className="pt-2">
                    <Label className="mb-2 block">Enrolled Students</Label>
                    <div className="space-y-2">
                      {visibleSelectedSessionStudentIds.map((studentId) => {
                        const student = usersById.get(studentId)
                        const sessionEnrollment = selectedSessionEnrollments.get(studentId)
                        const attendanceRecord = selectedSessionAttendance.get(studentId)
                        if (!student) return null
                        return (
                          <div
                            key={studentId}
                            className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-3 py-1.5"
                            data-testid={`enrolled-student-${studentId}`}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">{student.name}</span>
                              {sessionEnrollment && (
                                <span className="text-xs text-muted-foreground capitalize">
                                  {sessionEnrollment.status}
                                  {sessionEnrollment.score !== undefined
                                    ? ` · ${sessionEnrollment.score}%`
                                    : ''}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground capitalize">
                                Attendance: {attendanceRecord?.status ?? 'unmarked'}
                              </span>
                            </div>
                            <div className="ml-2 flex shrink-0 gap-1">
                              {canManageSchedule && onMarkAttendance && (
                                <>
                                  <Button
                                    variant={attendanceRecord?.status === 'present' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => onMarkAttendance(selectedSession.id, studentId, 'present')}
                                    disabled={attendanceRecord?.status === 'present'}
                                    aria-pressed={attendanceRecord?.status === 'present'}
                                    className={attendanceRecord?.status === 'present' ? 'opacity-100' : undefined}
                                    data-testid={`mark-present-btn-${studentId}`}
                                  >
                                    Present
                                  </Button>
                                  <Button
                                    variant={attendanceRecord?.status === 'absent' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => onMarkAttendance(selectedSession.id, studentId, 'absent')}
                                    disabled={attendanceRecord?.status === 'absent'}
                                    aria-pressed={attendanceRecord?.status === 'absent'}
                                    className={attendanceRecord?.status === 'absent' ? 'opacity-100' : undefined}
                                    data-testid={`mark-absent-btn-${studentId}`}
                                  >
                                    Absent
                                  </Button>
                                </>
                              )}
                              {canManageSchedule && onRecordScore && sessionEnrollment && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setRecordScoreEnrollmentId(sessionEnrollment.id)}
                                  data-testid={`record-score-btn-${studentId}`}
                                >
                                  Record Score
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
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

      <RecordScoreDialogWrapper
        context={recordScoreContext}
        recordScoreEnrollmentId={recordScoreEnrollmentId}
        setRecordScoreEnrollmentId={setRecordScoreEnrollmentId}
        onRecordScore={onRecordScore}
      />
    </div>
  )
}

interface RecordScoreDialogWrapperProps {
  context: {
    enrollment: Enrollment
    course: Course
    student: User
  } | null
  recordScoreEnrollmentId: string | null
  setRecordScoreEnrollmentId: (id: string | null) => void
  onRecordScore?: ScheduleProps['onRecordScore']
}

function RecordScoreDialogWrapper({
  context,
  recordScoreEnrollmentId,
  setRecordScoreEnrollmentId,
  onRecordScore,
}: RecordScoreDialogWrapperProps) {
  useEffect(() => {
    if (!context) {
      setRecordScoreEnrollmentId(null)
    }
  }, [context, setRecordScoreEnrollmentId])

  if (!context || !onRecordScore) {
    return null
  }

  return (
    <RecordScoreDialog
      key={context.enrollment.id}
      open={recordScoreEnrollmentId !== null}
      onOpenChange={(open) => {
        if (!open) setRecordScoreEnrollmentId(null)
      }}
      enrollment={context.enrollment}
      course={context.course}
      student={context.student}
      onSubmit={onRecordScore}
    />
  )
}
