import { useState, useCallback, useEffect, useMemo, type FormEvent } from 'react'
import { useKV } from '@github/spark/hooks'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/components/views/Dashboard'
import { Schedule } from '@/components/views/Schedule'
import { ScheduleTemplates } from '@/components/views/ScheduleTemplates'
import { Courses } from '@/components/views/Courses'
import { People } from '@/components/views/People'
import { Analytics } from '@/components/views/Analytics'
import { TrainerAvailability } from '@/components/views/TrainerAvailability'
import { BurnoutDashboard } from '@/components/views/BurnoutDashboard'
import { TrainerWellness } from '@/components/views/TrainerWellness'
import { CertificationDashboard } from '@/components/views/CertificationDashboard'
import { Notifications } from '@/components/views/Notifications'
import { UserGuide } from '@/components/views/UserGuide'
import { NotificationPermissionBanner } from '@/components/NotificationPermissionBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AttendanceRecord,
  User,
  Session,
  Course,
  Enrollment,
  Notification,
  CertificationRecord,
  CheckInSchedule,
  RecoveryPlan,
  ScheduleTemplate,
  WellnessCheckIn
} from '@/lib/types'
import { useUtilizationNotifications } from '@/hooks/use-utilization-notifications'
import { useCertificationNotifications } from '@/hooks/use-certification-notifications'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { ensureAllTrainersHaveProfiles } from '@/lib/trainer-profile-generator'
import { createPreviewSeedData, PREVIEW_SEED_VERSION } from '@/lib/preview-seed-data'
import { getPreviewSeedMode, isPreviewSeedEnabled, PreviewSeedMode } from '@/lib/preview-mode'
import { RiskHistorySnapshot } from '@/lib/risk-history-tracker'
import { normalizeNavigationValue } from '@/lib/navigation-utils'
import { canAccessSession } from '@/lib/helpers'
import { applyScore, shouldNotifyCompletion } from '@/lib/scoring'

const VIEW_ACCESS: Record<string, Array<User['role']>> = {
  dashboard: ['admin', 'trainer', 'employee'],
  schedule: ['admin', 'trainer', 'employee'],
  'schedule-templates': ['admin', 'trainer'],
  courses: ['admin', 'trainer', 'employee'],
  people: ['admin', 'trainer'],
  analytics: ['admin', 'trainer'],
  'trainer-availability': ['admin', 'trainer'],
  'burnout-dashboard': ['admin'],
  'trainer-wellness': ['admin'],
  certifications: ['admin'],
  'certification-dashboard': ['admin'],
  notifications: ['admin', 'trainer', 'employee'],
  'user-guide': ['admin', 'trainer', 'employee'],
  settings: ['admin'],
}

const KNOWN_NOTIFICATION_VIEWS = new Set<string>([
  'dashboard',
  'schedule',
  'schedule-templates',
  'courses',
  'people',
  'analytics',
  'trainer-availability',
  'burnout-dashboard',
  'trainer-wellness',
  'certification-dashboard',
  'certifications',
  'notifications',
  'user-guide',
  'settings',
])

/**
 * Generates a timestamp/random-based entity ID using a stable prefix.
 *
 * @param prefix - Domain prefix for the ID (e.g. `session`, `course`).
 * @returns A unique prefixed identifier.
 */
function createEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Root application component for the Orchestrate training management platform.
 *
 * Manages all persistent application state (users, sessions, courses,
 * enrollments, notifications, wellness records, and more) via KV-backed hooks,
 * and orchestrates navigation between the various views rendered inside the
 * shared {@link Layout}.
 *
 * Also handles automatic seeding of preview/demo data when the application is
 * launched in a preview environment, and wires up utilization and
 * certification notification hooks that generate in-app alerts.
 *
 * @returns The full application shell including the active view, a
 *   notification permission banner, and the toast container.
 */
function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [navigationPayload, setNavigationPayload] = useState<unknown>(null)
  const [firstAdminName, setFirstAdminName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  // ... rest of state declarations

  const previewSeedMode = getPreviewSeedMode()
  const previewSeedEnabled = isPreviewSeedEnabled(previewSeedMode)
  const previewMode = !import.meta.env.PROD

  const [users, setUsers] = useKV<User[]>('users', [])
  const [activeUserId, setActiveUserId] = useKV<string>('active-user-id', '')
  const [authPasswords, setAuthPasswords] = useKV<Record<string, string>>('auth-passwords', {})
  const [sessions, setSessions] = useKV<Session[]>('sessions', [])
  const [courses, setCourses] = useKV<Course[]>('courses', [])
  const [enrollments, setEnrollments] = useKV<Enrollment[]>('enrollments', [])
  const [attendanceRecords, setAttendanceRecords] = useKV<AttendanceRecord[]>('attendance-records', [])
  const [notifications, setNotifications] = useKV<Notification[]>('notifications', [])
  const [, setWellnessCheckIns] = useKV<WellnessCheckIn[]>('wellness-check-ins', [])
  const [, setRecoveryPlans] = useKV<RecoveryPlan[]>('recovery-plans', [])
  const [, setCheckInSchedules] = useKV<CheckInSchedule[]>('check-in-schedules', [])
  const [, setScheduleTemplates] = useKV<ScheduleTemplate[]>('schedule-templates', [])
  const [, setRiskHistorySnapshots] = useKV<RiskHistorySnapshot[]>('risk-history-snapshots', [])
  const [, setTargetTrainerCoverage] = useKV<number>('target-trainer-coverage', 4)
  const [previewSeedVersion, setPreviewSeedVersion] = useKV<string>('preview-seed-version', '')

  const { sendNotification } = usePushNotifications()

  /**
   * Populates all KV stores with deterministic preview seed data generated by
   * {@link createPreviewSeedData}, then records a versioned seed marker so the
   * seeding logic does not run again for the same mode.
   *
   * Passing `'off'` is a no-op. For all other modes (including `'manual'`),
   * the stored seed-version marker is always updated to reflect the applied mode.
   *
   * @param seedMode - The preview seed mode to apply. One of the
   *   {@link PreviewSeedMode} values or `'manual'`.
   */
  const applyPreviewSeedData = useCallback((seedMode: PreviewSeedMode | 'manual' = 'manual') => {
    if (seedMode === 'off') {
      return
    }

    const seedData = createPreviewSeedData()
    const seedMarker = `${PREVIEW_SEED_VERSION}:${seedMode}`

    setUsers(seedData.users)
    setSessions(seedData.sessions)
    setCourses(seedData.courses)
    setEnrollments(seedData.enrollments)
    setAttendanceRecords([])
    setNotifications(seedData.notifications)
    setWellnessCheckIns(seedData.wellnessCheckIns)
    setRecoveryPlans(seedData.recoveryPlans)
    setCheckInSchedules(seedData.checkInSchedules)
    setScheduleTemplates(seedData.scheduleTemplates)
    setRiskHistorySnapshots(seedData.riskHistorySnapshots)
    setTargetTrainerCoverage(seedData.targetTrainerCoverage)
    setPreviewSeedVersion(seedMarker)
    setActiveUserId(seedData.users[0]?.id || '')

    toast.success('Preview test data loaded', {
      description: `Seeded ${seedData.users.length} users, ${seedData.sessions.length} sessions, and related edge-case data.`
    })
  }, [
    setUsers,
    setSessions,
    setCourses,
    setEnrollments,
    setNotifications,
    setWellnessCheckIns,
    setRecoveryPlans,
    setCheckInSchedules,
    setScheduleTemplates,
    setRiskHistorySnapshots,
    setTargetTrainerCoverage,
    setPreviewSeedVersion,
    setActiveUserId
  ])

  /**
   * Derived boolean that is `true` when at least one user, session, course, or
   * enrollment record already exists in the KV store. Used to warn the user
   * before overwriting data with seed data.
   */
  const hasExistingCoreData = useMemo(() => {
    return (users?.length || 0) > 0 ||
      (sessions?.length || 0) > 0 ||
      (courses?.length || 0) > 0 ||
      (enrollments?.length || 0) > 0
  }, [users?.length, sessions?.length, courses?.length, enrollments?.length])

  /**
   * Handles a user-initiated request to load preview seed data from the
   * Settings page. If core data already exists, shows a confirmation dialog
   * before overwriting it. Delegates to {@link applyPreviewSeedData}.
   */
  const handleLoadPreviewSeedData = useCallback(() => {
    if (hasExistingCoreData) {
      const shouldOverwrite = window.confirm(
        'This will overwrite existing local data in preview storage. Continue?'
      )

      if (!shouldOverwrite) {
        return
      }
    }

    applyPreviewSeedData('manual')
  }, [hasExistingCoreData, applyPreviewSeedData])

  /**
   * Handles a user-initiated request to wipe all preview data. Prompts the
   * user for confirmation, then clears every KV-backed collection (users,
   * sessions, courses, enrollments, notifications, wellness records, recovery
   * plans, check-in schedules, schedule templates, and risk history snapshots),
   * resets the target trainer coverage to its default, and removes any
   * `reminder-*` keys from `localStorage`.
   */
  const handleResetPreviewData = useCallback(() => {
    const confirmed = window.confirm(
      'Reset all local preview data (users, sessions, courses, notifications, wellness, templates, and history)? This cannot be undone.'
    )

    if (!confirmed) {
      return
    }

    setUsers([])
    setSessions([])
    setCourses([])
    setEnrollments([])
    setAttendanceRecords([])
    setNotifications([])
    setWellnessCheckIns([])
    setRecoveryPlans([])
    setCheckInSchedules([])
    setScheduleTemplates([])
    setRiskHistorySnapshots([])
    setTargetTrainerCoverage(4)
    setPreviewSeedVersion('')
    setActiveUserId('')

    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('reminder-')) {
          localStorage.removeItem(key)
        }
      })
    }

    toast.success('Preview data reset complete', {
      description: 'All local preview records have been cleared.'
    })
  }, [
    setUsers,
    setSessions,
    setCourses,
    setEnrollments,
    setAttendanceRecords,
    setNotifications,
    setWellnessCheckIns,
    setRecoveryPlans,
    setCheckInSchedules,
    setScheduleTemplates,
    setRiskHistorySnapshots,
    setTargetTrainerCoverage,
    setPreviewSeedVersion,
    setActiveUserId
  ])

  useEffect(() => {
    if (!previewSeedEnabled) {
      return
    }

    const seedMarker = `${PREVIEW_SEED_VERSION}:${previewSeedMode}`
    const alreadySeededForMode = previewSeedVersion === seedMarker
    const hasExistingCoreData =
      (users?.length || 0) > 0 ||
      (sessions?.length || 0) > 0 ||
      (courses?.length || 0) > 0 ||
      (enrollments?.length || 0) > 0

    if (alreadySeededForMode) {
      return
    }

    if (previewSeedMode === 'full' && hasExistingCoreData) {
      return
    }

    applyPreviewSeedData(previewSeedMode)
  }, [
    previewSeedEnabled,
    previewSeedMode,
    previewSeedVersion,
    users,
    sessions,
    courses,
    enrollments,
    setUsers,
    setSessions,
    setCourses,
    setEnrollments,
    setAttendanceRecords,
    setNotifications,
    setWellnessCheckIns,
    setRecoveryPlans,
    setCheckInSchedules,
    setScheduleTemplates,
    setRiskHistorySnapshots,
    setTargetTrainerCoverage,
    setPreviewSeedVersion,
    applyPreviewSeedData
  ])

  useEffect(() => {
    if (!previewMode) {
      return
    }

    if (!users || users.length === 0) {
      return
    }

    setAuthPasswords((current) => {
      const existing = current || {}
      let changed = false
      const next = { ...existing }

      users.forEach((user) => {
        if (!(user.id in next)) {
          next[user.id] = 'password123'
          changed = true
        }
      })

      return changed ? next : existing
    })
  }, [previewMode, users, setAuthPasswords])

  useEffect(() => {
    if (users && users.length > 0) {
      const trainers = users.filter(u => u.role === 'trainer')
      const trainersWithoutProfiles = trainers.filter(t => !t.trainerProfile)

      if (trainersWithoutProfiles.length > 0) {
        const updatedUsers = ensureAllTrainersHaveProfiles(users)
        setUsers(updatedUsers)
      }
    }
  }, [])

  const safeUsers = users || []
  const safeSessions = sessions || []
  const safeCourses = courses || []
  const safeEnrollments = enrollments || []
  const safeNotifications = notifications || []
  const hasPersistedUsers = safeUsers.length > 0

  useEffect(() => {
    setShowSetup(!hasPersistedUsers)
  }, [hasPersistedUsers])

  const fallbackUser = useMemo<User>(() => ({
    id: '1',
    name: 'Admin User',
    email: 'admin@company.com',
    role: 'admin',
    department: 'Administration',
    certifications: [],
    hireDate: new Date().toISOString()
  }), [])

  useEffect(() => {
    if (safeUsers.length === 0) {
      return
    }

    if (!activeUserId) {
      return
    }

    const hasActiveUser = safeUsers.some((user) => user.id === activeUserId)
    if (!hasActiveUser) {
      const nextUser = safeUsers[0]
      setActiveUserId(nextUser.id)
      if (!VIEW_ACCESS[activeView]?.includes(nextUser.role)) {
        setActiveView('dashboard')
        setNavigationPayload(null)
      }
    }
  }, [activeUserId, activeView, safeUsers, setActiveUserId])

  /**
   * Creates a new {@link Notification} record with a generated ID and
   * timestamp, prepends it to the notifications KV store, fires a push
   * notification via {@link usePushNotifications}, and shows a toast for
   * high-priority or critical alerts.
   *
   * @param notification - All notification fields except the auto-generated
   *   `id` and `createdAt`.
   */
  const handleCreateNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: createEntityId('notif'),
      createdAt: new Date().toISOString()
    }

    setNotifications((current) => [newNotification, ...(current || [])])

    const priorityMap = {
      low: 'low' as const,
      medium: 'medium' as const,
      high: 'high' as const,
      critical: 'critical' as const
    }
    const pushPriority = priorityMap[notification.priority || 'medium']

    sendNotification(notification.title, {
      body: notification.message,
      priority: pushPriority,
      tag: notification.type,
      onClick: notification.link ? () => {
        const link = notification.link!
        let target: ReturnType<typeof normalizeNavigationValue>
        try {
          target = normalizeNavigationValue(link)
        } catch (error) {
          if (!import.meta.env.PROD) {
            console.warn('[sendPushNotification] Ignoring malformed notification link', { link, error })
          }
          return
        }
        if (!target) {
          return
        }

        if (!KNOWN_NOTIFICATION_VIEWS.has(target.view as string)) {
          return
        }

        const activeRole = safeUsers.find((user) => user.id === activeUserId)?.role ?? safeUsers[0]?.role ?? fallbackUser.role
        if (!VIEW_ACCESS[target.view]?.includes(activeRole)) {
          return
        }

        setActiveView(target.view)
        setNavigationPayload(target.data ?? null)
      } : undefined
    })

    if (notification.priority === 'critical' || notification.priority === 'high') {
      const icon = notification.priority === 'critical' ? '🚨' : '⚠️'
      toast.error(`${icon} ${notification.title}`, {
        description: notification.message,
        duration: 8000
      })
    }
  }, [activeUserId, safeUsers, sendNotification, setNotifications])

  useUtilizationNotifications(safeUsers, safeSessions, handleCreateNotification)

  useCertificationNotifications(safeUsers, handleCreateNotification, setUsers)

  const currentUser: User = safeUsers.find((user) => user.id === activeUserId) || safeUsers[0] || fallbackUser

  const safeAttendanceRecords = attendanceRecords || []

  const visibleCourses = useMemo(() => {
    if (currentUser.role === 'admin') {
      return safeCourses
    }

    if (currentUser.role === 'trainer') {
      return safeCourses.filter((course) => course.published || course.createdBy === currentUser.id)
    }

    const enrolledCourseIds = new Set(
      safeEnrollments
        .filter((enrollment) => enrollment.userId === currentUser.id)
        .map((enrollment) => enrollment.courseId)
    )

    return safeCourses.filter((course) => course.published || enrolledCourseIds.has(course.id))
  }, [currentUser, safeCourses, safeEnrollments])

  const visibleSessions = useMemo(() => {
    if (currentUser.role === 'admin') {
      return safeSessions
    }

    return safeSessions.filter((session) => canAccessSession(currentUser, session))
  }, [currentUser, safeSessions])

  const visibleNotifications = useMemo(() => {
    if (currentUser.role === 'admin') {
      return safeNotifications
    }

    return safeNotifications.filter((notification) => notification.userId === currentUser.id)
  }, [currentUser, safeNotifications])

  const visibleEnrollments = useMemo(() => {
    if (currentUser.role === 'admin') {
      return safeEnrollments
    }

    if (currentUser.role === 'employee') {
      return safeEnrollments.filter((enrollment) => enrollment.userId === currentUser.id)
    }

    const visibleCourseIds = new Set(visibleCourses.map((course) => course.id))
    const visibleSessionIds = new Set(visibleSessions.map((session) => session.id))

    return safeEnrollments.filter((enrollment) => {
      return visibleCourseIds.has(enrollment.courseId) || (enrollment.sessionId ? visibleSessionIds.has(enrollment.sessionId) : false)
    })
  }, [currentUser, safeEnrollments, visibleCourses, visibleSessions])

  const visibleAttendanceRecords = useMemo(() => {
    if (currentUser.role === 'admin') {
      return safeAttendanceRecords
    }

    if (currentUser.role === 'employee') {
      return safeAttendanceRecords.filter((record) => record.userId === currentUser.id)
    }

    const visibleSessionIds = new Set(visibleSessions.map((session) => session.id))
    return safeAttendanceRecords.filter((record) => visibleSessionIds.has(record.sessionId))
  }, [currentUser, safeAttendanceRecords, visibleSessions])

  const upcomingSessions = visibleSessions
    .filter(s => new Date(s.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 10)

  const unreadNotifications = visibleNotifications.filter(n => !n.read)

  const handleSwitchUser = useCallback((userId: string) => {
    setActiveUserId(userId)
    setActiveView('dashboard')
    setNavigationPayload(null)
  }, [setActiveUserId])

  const handleLogout = useCallback(() => {
    setActiveUserId(safeUsers[0]?.id || '')
    setActiveView('dashboard')
    setNavigationPayload(null)
  }, [safeUsers, setActiveUserId])

  // SECURITY NOTE: `authPasswords` stores plaintext demo credentials for preview-only flows.
  // This is not production-safe; replace with server-side auth (hashed passwords over TLS,
  // and token-based sessions or OAuth) before shipping.
  const handleSignIn = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    const email = loginEmail.trim().toLowerCase()
    const password = loginPassword

    if (!email || !password) {
      toast.error('Sign-in failed', {
        description: 'Enter an email and password to continue.',
      })
      return
    }

    if (!previewMode) {
      try {
        const response = await fetch('/api/auth/sign-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
          toast.error('Sign-in failed', {
            description: 'Authentication failed. Verify your credentials and try again.',
          })
          return
        }

        const data = await response.json().catch(() => null) as { userId?: string } | null
        const matchedUser = safeUsers.find((user) => user.email.trim().toLowerCase() === email)
        const authenticatedUserId = data?.userId ?? matchedUser?.id

        if (!authenticatedUserId) {
          toast.error('Sign-in failed', {
            description: 'Authentication succeeded but no user account is available in this workspace.',
          })
          return
        }

        const authenticatedUser = safeUsers.find((user) => user.id === authenticatedUserId)

        setActiveUserId(authenticatedUserId)
        setActiveView('dashboard')
        setNavigationPayload(null)
        setLoginPassword('')
        toast.success('Signed in', {
          description: `Welcome back, ${authenticatedUser?.name ?? email}.`,
        })
      } catch {
        toast.error('Sign-in failed', {
          description: 'Unable to reach the authentication service.',
        })
      }
      return
    }

    const matchedUser = safeUsers.find((user) => user.email.trim().toLowerCase() === email)
    if (!matchedUser) {
      toast.error('Sign-in failed', {
        description: 'No account matches that email address.',
      })
      return
    }

    const expectedPassword = authPasswords?.[matchedUser.id]
    if (!expectedPassword || expectedPassword !== password) {
      toast.error('Sign-in failed', {
        description: 'Incorrect password.',
      })
      return
    }

    setActiveUserId(matchedUser.id)
    setActiveView('dashboard')
    setNavigationPayload(null)
    setLoginPassword('')
    toast.success('Signed in', {
      description: `Welcome back, ${matchedUser.name}.`,
    })
  }, [authPasswords, loginEmail, loginPassword, previewMode, safeUsers, setActiveUserId])

  const handleSignOut = useCallback(() => {
    setActiveUserId('')
    setActiveView('dashboard')
    setNavigationPayload(null)
    setLoginPassword('')
  }, [setActiveUserId])

  const createFirstAdmin = useCallback(() => {
    if (hasPersistedUsers) {
      return
    }

    const name = firstAdminName.trim()
    const email = loginEmail.trim().toLowerCase()
    const password = loginPassword

    if (!name || !email || !password) {
      toast.error('Setup incomplete', {
        description: 'Enter name, email, and password to create the first admin.',
      })
      return
    }

    const now = new Date().toISOString()
    const firstAdmin: User = {
      id: createEntityId('user'),
      name,
      email,
      role: 'admin',
      department: 'Administration',
      certifications: [],
      hireDate: now,
      updatedAt: now,
    }

    setUsers([firstAdmin])

    if (previewMode) {
      setAuthPasswords({ [firstAdmin.id]: password })
    }

    setActiveUserId(firstAdmin.id)
    setActiveView('dashboard')
    setNavigationPayload(null)
    setShowSetup(false)
    setFirstAdminName('')
    setLoginEmail('')
    setLoginPassword('')

    toast.success('First admin created', {
      description: `${name} can now manage the workspace.`,
    })
  }, [firstAdminName, hasPersistedUsers, loginEmail, loginPassword, previewMode, setActiveUserId, setAuthPasswords, setUsers])

  const handleAssignRole = useCallback((userId: string, role: User['role']) => {
    const targetUser = safeUsers.find((entry) => entry.id === userId)
    if (!targetUser) {
      return
    }

    const adminCount = safeUsers.filter((entry) => entry.role === 'admin').length
    if (targetUser.role === 'admin' && role !== 'admin' && adminCount === 1) {
      toast.error('Cannot remove the last admin', {
        description: 'Assign another user as admin before changing this role.',
      })
      return
    }

    setUsers((currentUsers) => {
      const existingUsers = currentUsers || []
      const user = existingUsers.find((entry) => entry.id === userId)
      if (!user) {
        return existingUsers
      }

      if (user.role === role) {
        return existingUsers
      }

      return existingUsers.map((entry) => (
        entry.id === userId
          ? { ...entry, role, updatedAt: new Date().toISOString() }
          : entry
      ))
    })

    if (activeUserId === userId && !VIEW_ACCESS[activeView]?.includes(role)) {
      setActiveView('dashboard')
      setNavigationPayload(null)
    }

    toast.success('Role updated', {
      description: `User role changed to ${role}.`,
    })
  }, [activeUserId, activeView, safeUsers, setUsers])

  const applySessionUpdates = (session: Session, id: string, updates: Partial<Session>): Session => {
    if (session.id !== id) {
      return session
    }

    const expectedUpdatedAt = updates.updatedAt
    const { updatedAt: _ignoredUpdatedAt, ...sessionUpdates } = updates

    if (expectedUpdatedAt && session.updatedAt && expectedUpdatedAt !== session.updatedAt) {
      toast.error('Concurrent edit warning', {
        description: 'This session changed since you opened it. Your latest update was saved with last-write-wins.',
      })
    }

    return { ...session, ...sessionUpdates, updatedAt: new Date().toISOString() }
  }

  const applyUserUpdates = (user: User, id: string, updates: Partial<User>): User => {
    if (user.id !== id) {
      return user
    }

    const expectedUpdatedAt = updates.updatedAt
    const { updatedAt: _ignoredUpdatedAt, ...userUpdates } = updates
    if (expectedUpdatedAt && user.updatedAt && expectedUpdatedAt !== user.updatedAt) {
      toast.error('Concurrent edit warning', {
        description: 'This profile changed since you opened it. Your latest update was saved with last-write-wins.',
      })
    }

    return {
      ...user,
      ...userUpdates,
      updatedAt: new Date().toISOString(),
    }
  }

  const applyCourseUpdates = (course: Course, id: string, updates: Partial<Course>): Course => {
    if (course.id !== id) {
      return course
    }

    const expectedUpdatedAt = updates.updatedAt
    const { updatedAt: _ignoredUpdatedAt, ...courseUpdates } = updates

    if (expectedUpdatedAt && course.updatedAt && expectedUpdatedAt !== course.updatedAt) {
      toast.error('Concurrent edit warning', {
        description: 'This course changed since you opened it. Your latest update was saved with last-write-wins.',
      })
    }

    return { ...course, ...courseUpdates, updatedAt: new Date().toISOString() }
  }

  const handleMarkAttendance = useCallback((sessionId: string, userId: string, status: AttendanceRecord['status'], notes?: string) => {
    const now = new Date().toISOString()

    setAttendanceRecords((current) => {
      const existing = current || []
      const existingRecord = existing.find((record) => record.sessionId === sessionId && record.userId === userId)

      if (existingRecord) {
        return existing.map((record) => (
          record.id === existingRecord.id
            ? {
              ...record,
              status,
              notes: notes === undefined ? record.notes : notes,
              markedAt: now,
              markedBy: currentUser.id,
            }
            : record
        ))
      }

      const newRecord: AttendanceRecord = {
        id: createEntityId('attendance'),
        sessionId,
        userId,
        status,
        notes,
        markedAt: now,
        markedBy: currentUser.id,
      }

      return [newRecord, ...existing]
    })
  }, [currentUser.id, setAttendanceRecords])

  /**
   * Handles navigation events raised by child views by updating the active
   * view state.
   *
   * @param view - The key of the view to navigate to (e.g. `'dashboard'`,
   *   `'schedule'`, `'people'`).
   * @param data - Optional contextual data passed by the originating view.
   */
  const handleNavigate = (view: string, data?: unknown) => {
    let target: ReturnType<typeof normalizeNavigationValue>
    try {
      target = normalizeNavigationValue(view)
    } catch (error) {
      if (!import.meta.env.PROD) {
        console.warn('[handleNavigate] Ignoring navigation because normalizeNavigationValue threw', { view, error })
      }
      return
    }
    if (!target) {
      if (!import.meta.env.PROD) {
        console.warn('[handleNavigate] Ignoring navigation because normalizeNavigationValue returned null', { view })
      }
      return
    }

    if (!VIEW_ACCESS[target.view]?.includes(currentUser.role)) {
      toast.error('Access restricted', {
        description: 'That section is not available for the active role.',
      })
      return
    }

    setActiveView(target.view)
    setNavigationPayload(data ?? target.data ?? null)
  }

  /** Clears any active navigation payload after a view consumes it. */
  const clearNavigationPayload = useCallback(() => {
    setNavigationPayload(null)
  }, [])

  /**
   * Creates a single new {@link Session} with a generated ID, applying
   * sensible defaults for any omitted fields, and appends it to the sessions
   * KV store.
   *
   * @param session - Partial session data supplied by the caller. Missing
   *   required fields fall back to safe defaults (e.g. empty strings, the
   *   current timestamp, a capacity of 20).
   */
  const handleCreateSession = (session: Partial<Session>) => {
    const now = new Date().toISOString()
    const newSession: Session = {
      id: session.id || createEntityId('session'),
      courseId: session.courseId || '',
      trainerId: session.trainerId || '',
      title: session.title || 'Untitled Session',
      startTime: session.startTime || new Date().toISOString(),
      endTime: session.endTime || new Date().toISOString(),
      location: session.location || 'TBD',
      capacity: session.capacity || 20,
      enrolledStudents: session.enrolledStudents || [],
      status: session.status || 'scheduled',
      updatedAt: now,
      ...(session.recurrence && { recurrence: session.recurrence })
    }

    setSessions((currentSessions) => [...(currentSessions || []), newSession])
  }

  /**
   * Creates multiple {@link Session} records in a single KV update. Each
   * entry receives a unique generated ID and the same default-filling logic
   * applied by {@link handleCreateSession}. Used by schedule templates to
   * expand a template into a batch of concrete sessions.
   *
   * @param sessions - An array of partial session data objects.
   */
  const handleCreateMultipleSessions = (sessions: Partial<Session>[]) => {
    const now = new Date().toISOString()
    const newSessions: Session[] = sessions.map(session => ({
      id: session.id || createEntityId('session'),
      courseId: session.courseId || '',
      trainerId: session.trainerId || '',
      title: session.title || 'Untitled Session',
      startTime: session.startTime || new Date().toISOString(),
      endTime: session.endTime || new Date().toISOString(),
      location: session.location || 'TBD',
      capacity: session.capacity || 20,
      enrolledStudents: session.enrolledStudents || [],
      status: session.status || 'scheduled',
      updatedAt: now,
      ...(session.recurrence && { recurrence: session.recurrence })
    }))

    setSessions((currentSessions) => [...(currentSessions || []), ...newSessions])
  }

  /**
   * Applies a partial update to an existing session identified by `id`. Only
   * the provided fields in `updates` are merged; all other fields remain
   * unchanged.
   *
   * @param id - The unique identifier of the session to update.
   * @param updates - The fields to merge into the existing session record.
   */
  const handleUpdateSession = (id: string, updates: Partial<Session>) => {
    setSessions((currentSessions) =>
      (currentSessions || []).map((session) => applySessionUpdates(session, id, updates))
    )
  }

  /**
   * Deletes a single session and any enrollment rows bound to its `sessionId`.
   *
   * @param id - The ID of the session to remove.
   */
  const handleDeleteSession = useCallback((id: string) => {
    setSessions((currentSessions) => (currentSessions || []).filter((session) => session.id !== id))
    setEnrollments((currentEnrollments) => (currentEnrollments || []).filter((enrollment) => enrollment.sessionId !== id))
    setAttendanceRecords((currentAttendanceRecords) => (currentAttendanceRecords || []).filter((record) => record.sessionId !== id))
  }, [setAttendanceRecords, setEnrollments, setSessions])

  /**
   * Applies partial updates to an existing user record matched by `id`.
   *
   * @param id - The unique identifier of the user to update.
   * @param updates - The partial user fields to merge into the existing record.
   */
  const handleUpdateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers((currentUsers) =>
      (currentUsers || []).map((user) => applyUserUpdates(user, id, updates))
    )
  }, [setUsers])

  const handleUpdateUserFromProfile = useCallback((updatedUser: User) => {
    const { id, ...updates } = updatedUser
    handleUpdateUser(id, updates)
  }, [handleUpdateUser])

  /**
   * Appends a new {@link User} to the users KV store.
   *
   * @param newUser - The fully constructed user record to add.
   */
  const handleAddUser = (newUser: User) => {
    const updatedAt = new Date().toISOString()
    setUsers((currentUsers) => [...(currentUsers || []), { ...newUser, updatedAt }])

    if (previewMode) {
      setAuthPasswords((current) => ({
        ...(current || {}),
        [newUser.id]: current?.[newUser.id] ?? 'password123',
      }))
    }
  }

  /**
   * Creates a new {@link Course} with normalized defaults and appends it to
   * the courses KV store.
   *
   * @param course - Partial course data; missing fields are defaulted.
   */
  const handleCreateCourse = useCallback((course: Partial<Course>) => {
    const now = new Date().toISOString()
    const fullCourse: Course = {
      id: course.id || createEntityId('course'),
      title: course.title || 'Untitled Course',
      description: course.description || '',
      duration: course.duration ?? 60,
      passScore: course.passScore ?? 80,
      modules: course.modules || [],
      moduleDetails: course.moduleDetails || [],
      certifications: course.certifications || [],
      createdBy: course.createdBy || currentUser.id,
      createdAt: course.createdAt || now,
      published: course.published ?? false,
      updatedAt: now,
    }

    setCourses((currentCourses) => [...(currentCourses || []), fullCourse])
  }, [currentUser.id, setCourses])

  /**
   * Applies a partial update to an existing course.
   *
   * @param id - The ID of the course to update.
   * @param updates - The partial course fields to apply.
   */
  const handleUpdateCourse = useCallback((id: string, updates: Partial<Course>) => {
    setCourses((currentCourses) =>
      (currentCourses || []).map((course) => applyCourseUpdates(course, id, updates))
    )
  }, [setCourses])

  /**
   * Deletes a course and any sessions or enrollments associated with it.
   *
   * @param id - The ID of the course to delete.
   */
  const handleDeleteCourse = useCallback((id: string) => {
    const relatedSessionIds = new Set(safeSessions.filter((session) => session.courseId === id).map((session) => session.id))
    setCourses((currentCourses) => (currentCourses || []).filter((course) => course.id !== id))
    setSessions((currentSessions) => (currentSessions || []).filter((session) => session.courseId !== id))
    setEnrollments((currentEnrollments) =>
      (currentEnrollments || []).filter((enrollment) => enrollment.courseId !== id && !(enrollment.sessionId && relatedSessionIds.has(enrollment.sessionId)))
    )
    setAttendanceRecords((currentAttendanceRecords) =>
      (currentAttendanceRecords || []).filter((record) => !relatedSessionIds.has(record.sessionId))
    )
  }, [safeSessions, setAttendanceRecords, setCourses, setEnrollments, setSessions])

  /**
   * Removes a user from the users KV store and cleans up related session
   * records: sessions where the deleted user was the trainer have their
   * `trainerId` cleared, and sessions where the user was an enrolled student
   * have the user's ID removed from `enrolledStudents`.
   *
   * @param userId - The unique identifier of the user to delete.
   */
  const handleDeleteUser = (userId: string) => {
    if (activeUserId === userId) {
      const nextUser = safeUsers.find((user) => user.id !== userId)
      setActiveUserId(nextUser?.id || '')
    }

    setUsers((currentUsers) => (currentUsers || []).filter(user => user.id !== userId))
    setSessions((currentSessions) => (currentSessions || []).map(session => {
      if (session.trainerId === userId) {
        return { ...session, trainerId: '', status: 'scheduled' as const }
      }
      if (session.enrolledStudents.includes(userId)) {
        return { ...session, enrolledStudents: session.enrolledStudents.filter(id => id !== userId) }
      }
      return session
    }))
  }

  /**
   * Adds a new {@link CertificationRecord} to the `trainerProfile` of each
   * trainer listed in `trainerIds`. Non-trainer users and users not present in
   * `trainerIds` are left unchanged. The new record is initialised with
   * `status: 'active'`, `renewalRequired: false`, and `remindersSent: 0`.
   *
   * @param trainerIds - IDs of the trainer users to receive the certification.
   * @param certification - Certification data excluding the computed fields
   *   (`status`, `renewalRequired`, `remindersSent`).
   */
  const handleAddCertification = useCallback((trainerIds: string[], certification: Omit<CertificationRecord, 'status' | 'renewalRequired' | 'remindersSent'>) => {
    setUsers((currentUsers) =>
      (currentUsers || []).map(user => {
        if (!trainerIds.includes(user.id) || user.role !== 'trainer') {
          return user
        }

        const newCertificationRecord: CertificationRecord = {
          ...certification,
          status: 'active',
          renewalRequired: false,
          remindersSent: 0
        }

        const existingRecords = user.trainerProfile?.certificationRecords || []

        return {
          ...user,
          trainerProfile: {
            ...user.trainerProfile!,
            certificationRecords: [...existingRecords, newCertificationRecord]
          }
        }
      })
    )
  }, [setUsers])

  /**
   * Marks a single notification as read by setting its `read` flag to `true`.
   *
   * @param id - The unique identifier of the notification to mark as read.
   */
  const handleMarkNotificationAsRead = useCallback((id: string) => {
    setNotifications((current) =>
      (current || []).map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
  }, [setNotifications])

  /**
   * Marks a single notification as unread by setting its `read` flag to
   * `false`.
   *
   * @param id - The unique identifier of the notification to mark as unread.
   */
  const handleMarkNotificationAsUnread = useCallback((id: string) => {
    setNotifications((current) =>
      (current || []).map(notif =>
        notif.id === id ? { ...notif, read: false } : notif
      )
    )
  }, [setNotifications])

  /**
   * Marks every notification in the store as read by setting `read: true` on
   * all records.
   */
  const handleMarkAllNotificationsAsRead = useCallback(() => {
    setNotifications((current) =>
      (current || []).map(notif => ({ ...notif, read: true }))
    )
  }, [setNotifications])

  /**
   * Permanently removes a single notification from the store.
   *
   * @param id - The unique identifier of the notification to dismiss.
   */
  const handleDismissNotification = useCallback((id: string) => {
    setNotifications((current) =>
      (current || []).filter(notif => notif.id !== id)
    )
  }, [setNotifications])

  /**
   * Bulk-removes notifications from the store. When `filter` is `'read'`, only
   * already-read notifications are removed; otherwise all notifications are
   * cleared.
   *
   * @param filter - Optional scope of the dismissal. Pass `'read'` to remove
   *   only read notifications, or omit / pass `'all'` to clear everything.
   */
  const handleDismissAllNotifications = useCallback((filter?: 'all' | 'read') => {
    setNotifications((current) => {
      if (filter === 'read') {
        return (current || []).filter(notif => !notif.read)
      }
      return []
    })
  }, [setNotifications])

  /**
   * Records a final assessment score for an enrollment and, when the score
   * triggers a `'completed'` status transition for the first time, emits a
   * completion notification to the enrolled student.
   *
   * Progress is always set to `100` and `completedAt` is stamped when a score
   * is applied. A completion notification is only sent when the enrollment was
   * previously NOT already in `'completed'` status, preventing duplicate alerts
   * on subsequent score edits.
   *
   * @param enrollmentId - ID of the enrollment being scored.
   * @param score - The assessment score (0–100 inclusive).
   */
  const handleRecordScore = useCallback((enrollmentId: string, score: number) => {
    const enrollment = safeEnrollments.find((e) => e.id === enrollmentId)
    if (!enrollment) return

    const course = safeCourses.find((c) => c.id === enrollment.courseId)
    const passScore = course?.passScore ?? 80

    const update = applyScore(score, passScore)
    const notify = shouldNotifyCompletion(enrollment.status, score, passScore)

    setEnrollments((current) =>
      (current || []).map((e) =>
        e.id === enrollmentId ? { ...e, ...update } : e,
      ),
    )

    if (notify && course) {
      const student = safeUsers.find((u) => u.id === enrollment.userId)
      handleCreateNotification({
        userId: enrollment.userId,
        type: 'completion',
        title: `Course Completed — ${course.title}`,
        message: `${student?.name ?? 'A student'} completed "${course.title}" with a score of ${score}%.`,
        priority: 'medium',
        read: false,
        metadata: { enrollmentId, courseId: course.id, score },
      })
    }
  }, [safeEnrollments, safeCourses, safeUsers, setEnrollments, handleCreateNotification])

  /**
   * Returns the JSX for the currently active view, selected by the
   * `activeView` state string. Each case passes the relevant slice of
   * application state and the appropriate handler callbacks down to the
   * corresponding view component. Falls back to rendering the
   * {@link Dashboard} for any unknown view key.
   *
   * @returns The React element for the active view.
   */
  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard
            currentUser={currentUser}
            upcomingSessions={upcomingSessions}
            notifications={visibleNotifications}
            enrollments={visibleEnrollments}
            courses={visibleCourses}
            onNavigate={handleNavigate}
            onMarkNotificationAsRead={handleMarkNotificationAsRead}
            onDismissNotification={handleDismissNotification}
          />
        )
      case 'schedule':
        return (
          <Schedule
            sessions={visibleSessions}
            courses={visibleCourses}
            users={safeUsers}
            currentUser={currentUser}
            enrollments={visibleEnrollments}
            attendanceRecords={visibleAttendanceRecords}
            onCreateSession={handleCreateSession}
            onUpdateSession={handleUpdateSession}
            onDeleteSession={handleDeleteSession}
            onNavigate={handleNavigate}
            navigationPayload={navigationPayload}
            onNavigationPayloadConsumed={clearNavigationPayload}
            onRecordScore={handleRecordScore}
            onMarkAttendance={handleMarkAttendance}
          />
        )
      case 'schedule-templates':
        return (
          <ScheduleTemplates
            courses={visibleCourses}
            onNavigate={handleNavigate}
            onCreateSessions={handleCreateMultipleSessions}
          />
        )
      case 'courses':
        return (
          <Courses
            courses={visibleCourses}
            enrollments={visibleEnrollments}
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onCreateCourse={handleCreateCourse}
            onUpdateCourse={handleUpdateCourse}
            onDeleteCourse={handleDeleteCourse}
            navigationPayload={navigationPayload}
            onNavigationPayloadConsumed={clearNavigationPayload}
          />
        )
      case 'people':
        return (
          <People
            users={safeUsers}
            enrollments={visibleEnrollments}
            courses={visibleCourses}
            sessions={visibleSessions}
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onUpdateUser={handleUpdateUserFromProfile}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            navigationPayload={navigationPayload}
            onNavigationPayloadConsumed={clearNavigationPayload}
          />
        )
      case 'analytics':
        return (
          <Analytics
            users={safeUsers}
            enrollments={visibleEnrollments}
            sessions={visibleSessions}
            courses={visibleCourses}
            attendanceRecords={visibleAttendanceRecords}
          />
        )
      case 'trainer-availability':
        return (
          <TrainerAvailability
            users={safeUsers}
            sessions={visibleSessions}
            courses={visibleCourses}
            onNavigate={handleNavigate}
          />
        )
      case 'burnout-dashboard':
        return (
          <BurnoutDashboard
            users={safeUsers}
            sessions={visibleSessions}
            courses={visibleCourses}
            onNavigate={handleNavigate}
          />
        )
      case 'certifications':
        return (
          <CertificationDashboard
            users={safeUsers}
            onNavigate={handleNavigate}
            onAddCertification={handleAddCertification}
          />
        )
      case 'certification-dashboard':
        return (
          <CertificationDashboard
            users={safeUsers}
            onNavigate={handleNavigate}
            onAddCertification={handleAddCertification}
          />
        )
      case 'trainer-wellness':
        return (
          <TrainerWellness
            users={safeUsers}
            sessions={visibleSessions}
            currentUser={currentUser}
            onNavigate={handleNavigate}
          />
        )
      case 'notifications':
        return (
          <Notifications
            notifications={visibleNotifications}
            onMarkAsRead={handleMarkNotificationAsRead}
            onMarkAsUnread={handleMarkNotificationAsUnread}
            onMarkAllAsRead={handleMarkAllNotificationsAsRead}
            onDismiss={handleDismissNotification}
            onDismissAll={handleDismissAllNotifications}
            onNavigate={handleNavigate}
          />
        )
      case 'user-guide':
        return <UserGuide />
      case 'settings':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-semibold">Settings</h1>
              <p className="text-muted-foreground mt-1">Configure system settings</p>
            </div>
            <div className="max-w-4xl space-y-4">
              {previewMode && (
                <Card>
                  <CardHeader>
                    <CardTitle>Local Session</CardTitle>
                    <CardDescription>
                      Sign in with a user email and password, then manage role-based access for the active session.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border p-4">
                      <div className="text-sm text-muted-foreground">Active user</div>
                      <div className="mt-1 font-medium">{currentUser.name} ({currentUser.role})</div>
                      <div className="text-sm text-muted-foreground">{currentUser.email}</div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {safeUsers.map((user) => (
                        <Button key={user.id} variant={user.id === currentUser.id ? 'default' : 'outline'} onClick={() => handleSwitchUser(user.id)}>
                          Switch to {user.name}
                        </Button>
                      ))}
                      <Button variant="secondary" onClick={handleLogout}>Reset Session</Button>
                      <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Role Assignment</CardTitle>
                  <CardDescription>
                    Assign user roles with immediate access-control updates.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {safeUsers.map((user) => (
                    <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email} • {user.role}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant={user.role === 'admin' ? 'default' : 'outline'} onClick={() => handleAssignRole(user.id, 'admin')}>
                          Admin
                        </Button>
                        <Button size="sm" variant={user.role === 'trainer' ? 'default' : 'outline'} onClick={() => handleAssignRole(user.id, 'trainer')}>
                          Trainer
                        </Button>
                        <Button size="sm" variant={user.role === 'employee' ? 'default' : 'outline'} onClick={() => handleAssignRole(user.id, 'employee')}>
                          Employee
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Preview Test Data</CardTitle>
                  <CardDescription>
                    Load a deterministic fake dataset for testing all major workflows and edge cases.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Current preview mode: <span className="font-medium text-foreground">{previewSeedMode}</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleLoadPreviewSeedData}>Load Seed Data</Button>
                    <Button variant="destructive" onClick={handleResetPreviewData}>Reset Preview Data</Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Load will overwrite existing local data after confirmation. Reset clears all local preview records.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      default:
        return (
          <Dashboard
            currentUser={currentUser}
            upcomingSessions={upcomingSessions}
            notifications={visibleNotifications}
            enrollments={visibleEnrollments}
            courses={visibleCourses}
            onNavigate={handleNavigate}
          />
        )
    }
  }

  if (!activeUserId) {
    if (!hasPersistedUsers || showSetup) {
      return (
        <div className="min-h-screen bg-muted/20 p-6">
          <div className="mx-auto w-full max-w-md pt-16">
            <Card>
              <CardHeader>
                <CardTitle>Create First Admin</CardTitle>
                <CardDescription>
                  Set up the initial administrator account to bootstrap this workspace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="setup-name">Name</Label>
                    <Input
                      id="setup-name"
                      placeholder="Administrator"
                      value={firstAdminName}
                      onChange={(event) => setFirstAdminName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-email">Email</Label>
                    <Input
                      id="setup-email"
                      type="email"
                      placeholder="admin@company.com"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-password">Password</Label>
                    <Input
                      id="setup-password"
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                    />
                  </div>
                  <Button type="button" className="w-full" onClick={createFirstAdmin}>
                    Create First Admin
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <Toaster />
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-muted/20 p-6">
        <div className="mx-auto w-full max-w-md pt-16">
          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>
                Authenticate with your account to access role-based views.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSignIn}>
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="name@company.com"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Sign In
                </Button>
                {previewMode && (
                  <p className="text-xs text-muted-foreground">
                    Default password for seeded users is <strong>password123</strong>.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
        <Toaster />
      </div>
    )
  }

  return (
    <>
      <Layout
        activeView={activeView}
        onNavigate={handleNavigate}
        notificationCount={unreadNotifications.length}
        userRole={currentUser.role}
        currentUser={currentUser}
        users={previewMode ? safeUsers : [currentUser]}
        onSwitchUser={previewMode ? handleSwitchUser : undefined}
        onLogout={previewMode ? handleLogout : undefined}
      >
        {renderView()}
      </Layout>
      <NotificationPermissionBanner />
      <Toaster />
    </>
  )
}

export default App
