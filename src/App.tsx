import { useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useKV } from '@github/spark/hooks'
import { useForm } from 'react-hook-form'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { z } from 'zod'
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
import { hashPassword, verifyPassword } from '@/lib/auth-utils'
import { AppRuntimeEnvOverrides, AppTestHooks } from '@/test-support'

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

const DEMO_MODE_ACTIVE_STORAGE_KEY = 'orchestrate-demo-mode-active'
const DEMO_MODE_USER_ID_STORAGE_KEY = 'orchestrate-demo-mode-user-id'
const DEMO_MODE_SEEDED_STORAGE_KEY = 'orchestrate-demo-mode-seeded'
const SESSION_DEMO_MARKER_STORAGE_KEY = 'orchestrate-demo-seeded-in-tab'
const DEMO_MODE_LEASE_STORAGE_KEY = 'orchestrate-demo-seed-lease'
const DEMO_MODE_LEASE_DURATION_MS = 30 * 60 * 1000
const DEMO_MODE_LEASE_RENEW_INTERVAL_MS = 60 * 1000

type DemoModeLease = {
  expiresAtMs: number
  demoModeEnabled: true
  demoSessionUserId: string
}

/**
 * Read a value from window.sessionStorage, returning an empty string when unavailable.
 *
 * @param key - The sessionStorage key to read
 * @returns The stored string value for `key`, or an empty string if sessionStorage is unavailable or an error occurs
 */
function readSessionStorageValue(key: string) {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return window.sessionStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

/**
 * Checks whether a boolean flag stored in localStorage is set to `'true'`.
 *
 * @param key - The localStorage key to read
 * @returns `true` if the item value equals `'true'`, `false` otherwise (also returns `false` on server-side execution or when access to localStorage fails)
 */
function readLocalStorageFlag(key: string) {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

/**
 * Persist a string value to window.sessionStorage for the current browsing session, or remove the key when given an empty string.
 *
 * This function is a no-op outside the browser (when `window` is undefined) and suppresses any storage write errors.
 *
 * @param key - The sessionStorage key to set or remove
 * @param value - The string value to store; if empty, the key will be removed from sessionStorage
 */
function writeSessionStorageValue(key: string, value: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (value) {
      window.sessionStorage.setItem(key, value)
      return
    }

    window.sessionStorage.removeItem(key)
  } catch {
    // Ignore storage write failures; the in-memory session state still applies.
  }
}

/**
 * Set or clear a boolean flag in localStorage, stored as the string `"true"`.
 *
 * Writes the flag when `enabled` is `true`; removes the key when `enabled` is `false`.
 * This function no-ops on the server (when `window` is undefined) and silently ignores storage write errors.
 *
 * @param key - The localStorage key to set or remove
 * @param enabled - If `true`, store `"true"` under `key`; if `false`, remove `key`
 */
function writeLocalStorageFlag(key: string, enabled: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (enabled) {
      window.localStorage.setItem(key, 'true')
      return
    }

    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage write failures; the current tab session still applies.
  }
}

/**
 * Read a string value from localStorage in a safe, isomorphic manner.
 *
 * @param key - The localStorage key to read
 * @returns The stored string for `key`, or an empty string if not present or if access is unavailable or fails
 */
function readLocalStorageValue(key: string) {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

/**
 * Writes `value` to `window.localStorage` under `key`, or removes `key` when `value` is an empty string.
 *
 * This function is a no-op when `window` is unavailable (server-side) and silently ignores storage write errors.
 *
 * @param key - The localStorage key to set or remove
 * @param value - The string value to store; if empty, the key will be removed
 */
function writeLocalStorageValue(key: string, value: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (value) {
      window.localStorage.setItem(key, value)
      return
    }

    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage write failures; the current tab session still applies.
  }
}

/**
 * Creates a JSON lease string representing an active demo session for a user.
 *
 * @param userId - The user id to store in the lease; will be base64-encoded when possible.
 * @param expiresAtMs - Milliseconds-since-epoch when the lease expires (defaults to Date.now() + DEMO_MODE_LEASE_DURATION_MS).
 * @returns A JSON string with the properties `expiresAtMs` (number), `demoModeEnabled` (`true`), and `demoSessionUserId` (base64-encoded `userId` when encoding is available, otherwise the raw `userId`).
 */
function createDemoLease(userId: string, expiresAtMs = Date.now() + DEMO_MODE_LEASE_DURATION_MS) {
  let encodedUserId = userId
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      encodedUserId = window.btoa(userId)
    }
  } catch {
    // If encoding fails, fall back to the raw userId to avoid breaking demo behavior.
    encodedUserId = userId
  }

  return JSON.stringify({
    expiresAtMs,
    demoModeEnabled: true,
    demoSessionUserId: encodedUserId,
  })
}

/**
 * Reads and validates the active demo-mode lease stored in localStorage.
 *
 * If a valid, unexpired lease exists and `demoModeEnabled` is `true`, returns the parsed lease.
 * When present, attempts to base64-decode `demoSessionUserId` so callers receive the original user id.
 *
 * @returns A `DemoModeLease` object if a valid active lease is found, `null` otherwise.
 */
function readActiveDemoLease() {
  const rawLease = readLocalStorageValue(DEMO_MODE_LEASE_STORAGE_KEY)
  if (!rawLease) {
    return null
  }

  try {
    const lease = JSON.parse(rawLease) as Partial<DemoModeLease>
    if (typeof lease.expiresAtMs !== 'number' || lease.expiresAtMs <= Date.now()) {
      return null
    }

    if (lease.demoModeEnabled !== true || typeof lease.demoSessionUserId !== 'string' || !lease.demoSessionUserId) {
      return null
    }

    // Decode the demoSessionUserId so callers continue to receive the original userId.
    try {
      if (typeof window !== 'undefined' && typeof window.atob === 'function') {
        lease.demoSessionUserId = window.atob(lease.demoSessionUserId)
      }
    } catch {
      // If decoding fails, keep the stored value as-is.
    }

    return lease as DemoModeLease
  } catch {
    return null
  }
}

/**
 * Checks whether a valid, unexpired demo-mode lease exists in localStorage.
 *
 * @returns `true` if an active demo lease is present, `false` otherwise.
 */
function hasActiveDemoLease() {
  return readActiveDemoLease() !== null
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Creates a namespaced unique identifier using the provided prefix.
 *
 * @param prefix - Domain prefix for the identifier (e.g. `session`, `course`)
 * @returns A string identifier prefixed with `prefix`
 */
function createEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

const signInSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required'),
})

const firstAdminSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required'),
})

type SignInFormValues = z.infer<typeof signInSchema>
type FirstAdminFormValues = z.infer<typeof firstAdminSchema>

declare global {
  var __ORCHESTRATE_APP_TEST_ENV__: AppRuntimeEnvOverrides | undefined
  var __ORCHESTRATE_APP_TEST_HOOKS__: AppTestHooks | undefined
}

function getAppRuntimeEnv() {
  const overrides = !import.meta.env.PROD ? globalThis.__ORCHESTRATE_APP_TEST_ENV__ : undefined

  return {
    initialActiveView: overrides?.initialActiveView,
    previewMode: overrides?.previewMode ?? !import.meta.env.PROD,
    useServerAuth: overrides?.useServerAuth ?? import.meta.env.VITE_USE_SERVER_AUTH === 'true',
  }
}

/**
 * Root application component that manages KV-backed application state and renders the active view inside the shared layout.
 *
 * Manages users, sessions, courses, enrollments, notifications, wellness/recovery records, attendance, and related derived views;
 * wires preview/demo seeding and preview-mode auth flows; and exposes handlers for navigation, CRUD operations, notifications, scoring,
 * attendance, role assignment, and user/session lifecycle management.
 *
 * @returns The full application shell containing the active view, the notification permission banner, and the toast container.
 */
function App() {
  const runtimeEnv = getAppRuntimeEnv()
  const [activeView, setActiveView] = useState(runtimeEnv.initialActiveView ?? 'dashboard')
  const [navigationPayload, setNavigationPayload] = useState<unknown>(null)
  const [demoModeEnabled, setDemoModeEnabled] = useState(() => {
    return readSessionStorageValue(DEMO_MODE_ACTIVE_STORAGE_KEY) === 'true'
  })
  const [demoSessionUserId, setDemoSessionUserId] = useState(() => {
    return readSessionStorageValue(DEMO_MODE_USER_ID_STORAGE_KEY)
  })

  const signInForm = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onSubmit',
  })

  const firstAdminForm = useForm<FirstAdminFormValues>({
    resolver: zodResolver(firstAdminSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
    mode: 'onSubmit',
  })

  const previewSeedMode = getPreviewSeedMode()
  const previewSeedEnabled = isPreviewSeedEnabled(previewSeedMode)
  const { previewMode, useServerAuth } = runtimeEnv
  const localPreviewMode = previewMode || demoModeEnabled

  const [users, setUsers] = useKV<User[]>('users', [])
  const [persistedActiveUserId, setPersistedActiveUserId] = useKV<string>('active-user-id', '')
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

  /**
   * Computed active user identifier that switches between the demo session user ID
   * and the persisted user ID, depending on whether demo mode is enabled.
   */
  const activeUserId = demoModeEnabled ? demoSessionUserId : persistedActiveUserId

  const setDemoSessionState = useCallback((enabled: boolean, userId: string) => {
    setDemoModeEnabled(enabled)
    setDemoSessionUserId(userId)
    writeSessionStorageValue(DEMO_MODE_ACTIVE_STORAGE_KEY, enabled ? 'true' : '')
    writeSessionStorageValue(DEMO_MODE_USER_ID_STORAGE_KEY, enabled ? userId : '')
  }, [])

  const setSessionUserId = useCallback((userId: string) => {
    if (demoModeEnabled) {
      setDemoSessionState(true, userId)
      return
    }

    setPersistedActiveUserId(userId)
  }, [demoModeEnabled, setDemoSessionState, setPersistedActiveUserId])

  const { sendNotification } = usePushNotifications()

  // DEMO ONLY: Produces hashed credentials for preview seeding. All demo users
  // receive the same default password ('password123') stored as a SHA-256 hash
  // so that plain-text passwords are never persisted, even in preview mode.
  const buildPreviewAuthPasswords = useCallback(async (seedUsers: User[]) => {
    const hash = await hashPassword('password123')
    return seedUsers.reduce<Record<string, string>>((acc, user) => {
      acc[user.id] = hash
      return acc
    }, {})
  }, [])

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
   * @param sessionMode - Controls how the active preview user ID is stored:
   *   when set to `persisted`, the default seeded user ID is written to KV storage;
   *   when set to `transient`, the active user is kept in demo session state
   *   backed by tab-scoped `sessionStorage` and accompanied by a seeded marker
   *   in `localStorage` so demo mode can be detected on reload.
   */
  const applyPreviewSeedData = useCallback(async (seedMode: PreviewSeedMode | 'manual' = 'manual', sessionMode: 'persisted' | 'transient' = 'persisted') => {
    if (seedMode === 'off') {
      return
    }

    const seedData = createPreviewSeedData()
    const seedMarker = `${PREVIEW_SEED_VERSION}:${seedMode}`
    const defaultSessionUserId = seedData.users.find((user) => user.role === 'admin')?.id || seedData.users[0]?.id || ''

    // DEMO ONLY: Build auth passwords first so a rejection leaves the app un-mutated.
    const seededAuthPasswords = await buildPreviewAuthPasswords(seedData.users)

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
    setAuthPasswords(seededAuthPasswords)

    if (sessionMode === 'transient') {
      setPersistedActiveUserId('')
      setDemoSessionState(true, defaultSessionUserId)
      writeSessionStorageValue(SESSION_DEMO_MARKER_STORAGE_KEY, 'true')
      writeLocalStorageFlag(DEMO_MODE_SEEDED_STORAGE_KEY, true)
      writeLocalStorageValue(DEMO_MODE_LEASE_STORAGE_KEY, createDemoLease(defaultSessionUserId))
    } else {
      setDemoSessionState(false, '')
      writeSessionStorageValue(SESSION_DEMO_MARKER_STORAGE_KEY, '')
      writeLocalStorageFlag(DEMO_MODE_SEEDED_STORAGE_KEY, false)
      writeLocalStorageValue(DEMO_MODE_LEASE_STORAGE_KEY, '')
      setPersistedActiveUserId(defaultSessionUserId)
    }

    toast.success('Preview test data loaded', {
      description: `Seeded ${seedData.users.length} users, ${seedData.sessions.length} sessions, and related edge-case data.`
    })
  }, [
    setUsers,
    setAttendanceRecords,
    setAuthPasswords,
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
    setPersistedActiveUserId,
    setDemoSessionState,
    buildPreviewAuthPasswords
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

    void applyPreviewSeedData('manual', demoModeEnabled ? 'transient' : 'persisted').catch((error: unknown) => {
      console.error('Failed to load preview seed data', error)
      toast.error('Failed to load preview seed data', {
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while loading seed data.',
      })
    })
  }, [applyPreviewSeedData, demoModeEnabled, hasExistingCoreData])

  /**
   * Handles a user-initiated request to enter demo mode from the Setup Required screen.
   *
   * Seeds the KV store with preview data as a transient (non-persisted) demo session.
   * If core data already exists, prompts for confirmation before overwriting.
   * Shows an error toast if seeding fails.
   */
  const handleEnterDemoMode = useCallback(() => {
    if (hasExistingCoreData) {
      const shouldOverwrite = window.confirm(
        'This will overwrite existing local data in preview storage. Continue?'
      )

      if (!shouldOverwrite) {
        return
      }
    }

    void applyPreviewSeedData('manual', 'transient').catch((error: unknown) => {
      console.error('Failed to enter demo mode', error)
      toast.error('Failed to enter demo mode', {
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while loading demo data.',
      })
    })
  }, [applyPreviewSeedData, hasExistingCoreData])

  const clearPreviewDataState = useCallback((showToast: boolean) => {
    setUsers([])
    setAuthPasswords({})
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
    setPersistedActiveUserId('')
    setDemoSessionState(false, '')
    writeSessionStorageValue(SESSION_DEMO_MARKER_STORAGE_KEY, '')
    writeLocalStorageFlag(DEMO_MODE_SEEDED_STORAGE_KEY, false)
    writeLocalStorageValue(DEMO_MODE_LEASE_STORAGE_KEY, '')

    if (typeof window !== 'undefined') {
      try {
        Object.keys(window.localStorage).forEach((key) => {
          if (key.startsWith('reminder-')) {
            window.localStorage.removeItem(key)
          }
        })
      } catch {
        // Ignore storage cleanup failures; KV reset has already completed.
      }
    }

    if (showToast) {
      toast.success('Preview data reset complete', {
        description: 'All local preview records have been cleared.'
      })
    }
  }, [
    setUsers,
    setAuthPasswords,
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
    setPersistedActiveUserId,
    setDemoSessionState,
  ])

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

    clearPreviewDataState(true)
  }, [
    clearPreviewDataState,
  ])

  const seededInThisTab = readSessionStorageValue(SESSION_DEMO_MARKER_STORAGE_KEY) === 'true'
  const hasLiveDemoLease = hasActiveDemoLease()
  const shouldClearStaleDemoData = !previewMode
    && !demoModeEnabled
    && (seededInThisTab || !hasLiveDemoLease)
    && readLocalStorageFlag(DEMO_MODE_SEEDED_STORAGE_KEY)

  useIsomorphicLayoutEffect(() => {
    if (!shouldClearStaleDemoData) {
      return
    }

    clearPreviewDataState(false)
  }, [clearPreviewDataState, shouldClearStaleDemoData])

  useEffect(() => {
    if (!demoModeEnabled) {
      return
    }

    const leaseOwnerId = demoSessionUserId

    const renewDemoLease = () => {
      writeLocalStorageValue(DEMO_MODE_LEASE_STORAGE_KEY, createDemoLease(leaseOwnerId))
    }

    renewDemoLease()

    const intervalId = window.setInterval(renewDemoLease, DEMO_MODE_LEASE_RENEW_INTERVAL_MS)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        renewDemoLease()
      }
    }

    window.addEventListener('focus', renewDemoLease)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', renewDemoLease)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // demoSessionUserId is intentionally captured as a stable snapshot (leaseOwnerId)
    // at effect-run time so the interval keeps renewing even if the session user ID
    // later becomes empty while demoModeEnabled remains true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoModeEnabled])

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

    void applyPreviewSeedData(previewSeedMode, demoModeEnabled ? 'transient' : 'persisted').catch((error: unknown) => {
      console.error('Failed to apply preview seed data', error)
      toast('Failed to load preview data', {
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while seeding preview data.',
      })
    })
  }, [
    demoModeEnabled,
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
    if (!localPreviewMode) {
      return
    }

    if (!users || users.length === 0) {
      return
    }

    // DEMO ONLY: Seeds hashed 'password123' for any preview user that does not
    // yet have a stored credential, so plain-text passwords are never persisted.
    const seedMissingPasswords = async () => {
      const hash = await hashPassword('password123')
      setAuthPasswords((current) => {
        const existing = current || {}
        let changed = false
        const next = { ...existing }

        users.forEach((user) => {
          if (!(user.id in next)) {
            next[user.id] = hash
            changed = true
          }
        })

        return changed ? next : existing
      })
    }

    void seedMissingPasswords().catch((error: unknown) => {
      console.error('Failed to seed missing preview passwords', error)
      toast.error('Failed to set up preview credentials', {
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while setting up preview passwords.',
      })
    })
  }, [localPreviewMode, users, setAuthPasswords])

  useEffect(() => {
    if (users && users.length > 0) {
      const trainers = users.filter(u => u.role === 'trainer')
      const trainersWithoutProfiles = trainers.filter(t => !t.trainerProfile)

      if (trainersWithoutProfiles.length > 0) {
        const updatedUsers = ensureAllTrainersHaveProfiles(users)
        setUsers(updatedUsers)
      }
    }
  }, [users, setUsers])

  const safeUsers = useMemo(() => users || [], [users])
  const safeSessions = useMemo(() => sessions || [], [sessions])
  const safeCourses = useMemo(() => courses || [], [courses])
  const safeEnrollments = useMemo(() => enrollments || [], [enrollments])
  const safeNotifications = useMemo(() => notifications || [], [notifications])
  const sideEffectsEnabled = !shouldClearStaleDemoData && (localPreviewMode || Boolean(activeUserId))
  const sideEffectUsers = sideEffectsEnabled ? safeUsers : []
  const sideEffectSessions = sideEffectsEnabled ? safeSessions : []
  const hasPersistedUsers = safeUsers.length > 0

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
      setSessionUserId(nextUser.id)
      if (!VIEW_ACCESS[activeView]?.includes(nextUser.role)) {
        setActiveView('dashboard')
        setNavigationPayload(null)
      }
    }
  }, [activeUserId, activeView, safeUsers, setSessionUserId])

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
  }, [activeUserId, fallbackUser.role, safeUsers, sendNotification, setNotifications])

  useUtilizationNotifications(sideEffectUsers, sideEffectSessions, handleCreateNotification)

  useCertificationNotifications(sideEffectUsers, handleCreateNotification, setUsers)

  const currentUser: User = safeUsers.find((user) => user.id === activeUserId) || safeUsers[0] || fallbackUser

  const safeAttendanceRecords = useMemo(() => attendanceRecords || [], [attendanceRecords])

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
    setSessionUserId(userId)
    setActiveView('dashboard')
    setNavigationPayload(null)
  }, [setSessionUserId])

  const handleLogout = useCallback(() => {
    setSessionUserId(safeUsers[0]?.id || '')
    setActiveView('dashboard')
    setNavigationPayload(null)
  }, [safeUsers, setSessionUserId])

  // DEMO ONLY: `authPasswords` stores SHA-256-hashed credentials for the
  // preview/demo sign-in flow only. In production, authentication must be
  // delegated to a server-side auth service (bcrypt/Argon2 over TLS, with
  // token-based sessions or OAuth). Credentials must never travel as plain
  // text and must never be stored without server-side hashing.
  const handleSignIn = useCallback(async (values: SignInFormValues) => {
    const email = values.email.trim().toLowerCase()
    const password = values.password

    if (!email || !password) {
      toast.error('Sign-in failed', {
        description: 'Enter an email and password to continue.',
      })
      return
    }

    // DEMO ONLY: Verifies the entered password against its stored SHA-256 hash
    // in the local KV store. This path is only reachable in preview/demo mode
    // or when server auth is explicitly disabled.
    const authenticateLocally = async (): Promise<boolean> => {
      const matchedUser = safeUsers.find((user) => user.email.trim().toLowerCase() === email)
      if (!matchedUser) {
        toast.error('Sign-in failed', {
          description: 'No account matches that email address.',
        })
        return false
      }

      const storedHash = authPasswords?.[matchedUser.id]
      const passwordValid = storedHash ? await verifyPassword(password, storedHash) : false
      if (!passwordValid) {
        toast.error('Sign-in failed', {
          description: 'Incorrect password.',
        })
        return false
      }

      setSessionUserId(matchedUser.id)
      setActiveView('dashboard')
      setNavigationPayload(null)
      signInForm.setValue('password', '')
      toast.success('Signed in', {
        description: `Welcome back, ${matchedUser.name}.`,
      })
      return true
    }

    if (!localPreviewMode && useServerAuth) {
      try {
        const response = await fetch('/api/auth/sign-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
          toast.error('Authentication failed', {
            description: 'Verify your credentials and try again.',
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

        if (!authenticatedUser) {
          toast.error('Sign-in failed', {
            description: 'Authentication succeeded but no user account is available in this workspace.',
          })
          return
        }

        setSessionUserId(authenticatedUserId)
        setActiveView('dashboard')
        setNavigationPayload(null)
        signInForm.setValue('password', '')
        toast.success('Signed in', {
          description: `Welcome back, ${authenticatedUser.name}.`,
        })
      } catch {
        toast.error('Authentication failed', {
          description: 'Unable to reach the authentication service.',
        })
      }
      return
    }

    await authenticateLocally()
  }, [authPasswords, localPreviewMode, safeUsers, setSessionUserId, signInForm, useServerAuth])

  const handleSignOut = useCallback(() => {
    setSessionUserId('')
    setActiveView('dashboard')
    setNavigationPayload(null)
    signInForm.setValue('password', '')
  }, [setSessionUserId, signInForm])

  // DEMO ONLY: createFirstAdmin is a preview-only bootstrap flow. Passwords are
  // hashed with SHA-256 before being stored in the local KV store. In production,
  // first-user provisioning and credential storage must happen server-side.
  const createFirstAdmin = useCallback(async (values: FirstAdminFormValues) => {
    if (hasPersistedUsers) {
      return
    }

    if (!localPreviewMode) {
      toast.error('Setup unavailable', {
        description: 'Initial admin bootstrap in this client flow is preview-only.',
      })
      return
    }

    const name = values.name.trim()
    const email = values.email.trim().toLowerCase()
    const password = values.password

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

    // DEMO ONLY: Hash the password before storing — never persist plain text.
    const passwordHash = await hashPassword(password)

    setUsers([firstAdmin])
    setAuthPasswords({ [firstAdmin.id]: passwordHash })

    setSessionUserId(firstAdmin.id)
    setActiveView('dashboard')
    setNavigationPayload(null)
    firstAdminForm.reset()
    signInForm.reset({ email: '', password: '' })

    toast.success('First admin created', {
      description: `${name} can now manage the workspace.`,
    })
  }, [firstAdminForm, hasPersistedUsers, localPreviewMode, setSessionUserId, setAuthPasswords, setUsers, signInForm])

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
          ? {
            ...entry,
            role,
            trainerProfile: role === 'trainer' && !entry.trainerProfile
              ? {
                authorizedRoles: [],
                shiftSchedules: [],
                tenure: {
                  hireDate: entry.hireDate,
                  yearsOfService: 0,
                  monthsOfService: 0,
                },
                specializations: [],
                certificationRecords: [],
              }
              : entry.trainerProfile,
            updatedAt: new Date().toISOString(),
          }
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

  /**
   * Applies partial updates to a session, returning a new session object.
   * Shows a concurrent-edit warning toast when the stored `updatedAt` timestamp
   * differs from the expected one supplied in `updates`.
   *
   * @param session - The existing session to update.
   * @param id - The ID of the session to match; unmatched sessions are returned unchanged.
   * @param updates - Partial session fields to merge in.
   * @returns The updated session with a fresh `updatedAt` timestamp.
   */
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

  /**
   * Applies partial updates to a user, returning a new user object.
   * Shows a concurrent-edit warning toast when the stored `updatedAt` timestamp
   * differs from the expected one supplied in `updates`.
   *
   * @param user - The existing user to update.
   * @param id - The ID of the user to match; unmatched users are returned unchanged.
   * @param updates - Partial user fields to merge in.
   * @returns The updated user with a fresh `updatedAt` timestamp.
   */
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

  /**
   * Applies partial updates to a course, returning a new course object.
   * Shows a concurrent-edit warning toast when the stored `updatedAt` timestamp
   * differs from the expected one supplied in `updates`.
   *
   * @param course - The existing course to update.
   * @param id - The ID of the course to match; unmatched courses are returned unchanged.
   * @param updates - Partial course fields to merge in.
   * @returns The updated course with a fresh `updatedAt` timestamp.
   */
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
      // DEMO ONLY: Assigns a hashed default credential for new preview-mode users
      // so that no plain-text password is ever written to the KV store.
      void hashPassword('password123')
        .then((hash) => {
          setAuthPasswords((current) => ({
            ...(current || {}),
            [newUser.id]: current?.[newUser.id] ?? hash,
          }))
        })
        .catch((error) => {
          console.error('Failed to hash default preview password for new user', error)
          toast.error('Unable to set up a default password for the new preview user.')
        })
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
   * have the user's ID removed from `enrolledStudents`. Also cleans up
   * attendance records for the deleted user and ensures the active view is
   * accessible by the new active user.
   *
   * @param userId - The unique identifier of the user to delete.
   */
  const handleDeleteUser = useCallback((userId: string) => {
    if (activeUserId === userId) {
      const nextUser = safeUsers.find((user) => user.id !== userId)
      const nextUserId = nextUser?.id || ''
      setSessionUserId(nextUserId)

      // Ensure the new active user can access the current view
      if (nextUser && !VIEW_ACCESS[activeView]?.includes(nextUser.role)) {
        setActiveView('dashboard')
        setNavigationPayload(null)
      }
    }

    setAuthPasswords((currentPasswords) => {
      if (!currentPasswords || !(userId in currentPasswords)) {
        return currentPasswords || {}
      }

      const { [userId]: _deletedPassword, ...remainingPasswords } = currentPasswords
      return remainingPasswords
    })
    setUsers((currentUsers) => (currentUsers || []).filter(user => user.id !== userId))
    setEnrollments((currentEnrollments) =>
      (currentEnrollments || []).filter((enrollment) => enrollment.userId !== userId)
    )
    setSessions((currentSessions) => (currentSessions || []).map(session => {
      const removedTrainer = session.trainerId === userId
      const removedStudent = session.enrolledStudents.includes(userId)
      const shouldResetStatus = removedTrainer && session.status !== 'completed' && session.status !== 'cancelled'

      if (!removedTrainer && !removedStudent) {
        return session
      }

      return {
        ...session,
        trainerId: removedTrainer ? '' : session.trainerId,
        enrolledStudents: removedStudent
          ? session.enrolledStudents.filter(id => id !== userId)
          : session.enrolledStudents,
        ...(shouldResetStatus ? { status: 'scheduled' as const } : {}),
        updatedAt: new Date().toISOString(),
      }
    }))

    // Clean up attendance records for the deleted user
    setAttendanceRecords((currentRecords) =>
      (currentRecords || []).filter(record => record.userId !== userId)
    )
    setNotifications((currentNotifications) =>
      (currentNotifications || []).filter((notification) => notification.userId !== userId)
    )
    setWellnessCheckIns((currentCheckIns) =>
      (currentCheckIns || []).filter((checkIn) => checkIn.trainerId !== userId)
    )
    setRecoveryPlans((currentPlans) =>
      (currentPlans || []).filter((plan) => plan.trainerId !== userId)
    )
    setCheckInSchedules((currentSchedules) =>
      (currentSchedules || []).filter((schedule) => schedule.trainerId !== userId)
    )
    setScheduleTemplates((currentTemplates) =>
      (currentTemplates || [])
        .filter((template) => template.createdBy !== userId)
        .map((template) => ({
          ...template,
          sessions: template.sessions.map((session) => ({
            ...session,
            preferredTrainers: session.preferredTrainers?.filter((trainerId) => trainerId !== userId),
          })),
        }))
    )
    setRiskHistorySnapshots((currentSnapshots) =>
      (currentSnapshots || []).filter((snapshot) => snapshot.trainerId !== userId)
    )
  }, [
    activeUserId,
    activeView,
    safeUsers,
    setSessionUserId,
    setActiveView,
    setAttendanceRecords,
    setAuthPasswords,
    setCheckInSchedules,
    setEnrollments,
    setNavigationPayload,
    setNotifications,
    setRecoveryPlans,
    setRiskHistorySnapshots,
    setScheduleTemplates,
    setSessions,
    setUsers,
    setWellnessCheckIns,
  ])

  useEffect(() => {
    if (import.meta.env.PROD || !import.meta.env.VITEST) {
      return
    }

    const testHooks = globalThis.__ORCHESTRATE_APP_TEST_HOOKS__
    if (!testHooks) {
      return
    }

    testHooks.createFirstAdmin = createFirstAdmin
    testHooks.handleSignIn = handleSignIn
    testHooks.handleAssignRole = async (userId, role) => {
      handleAssignRole(userId, role)
    }
    testHooks.handleDeleteUser = async (userId) => {
      handleDeleteUser(userId)
    }

    return () => {
      if (globalThis.__ORCHESTRATE_APP_TEST_HOOKS__ === testHooks) {
        delete testHooks.createFirstAdmin
        delete testHooks.handleSignIn
        delete testHooks.handleAssignRole
        delete testHooks.handleDeleteUser
      }
    }
  }, [createFirstAdmin, handleAssignRole, handleDeleteUser, handleSignIn])

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

  useEffect(() => {
    if (import.meta.env.PROD || !import.meta.env.VITEST) {
      return
    }

    const testHooks = globalThis.__ORCHESTRATE_APP_TEST_HOOKS__
    if (!testHooks) {
      return
    }

    testHooks.handleMarkNotificationAsRead = async (id) => {
      handleMarkNotificationAsRead(id)
    }

    return () => {
      if (
        !(import.meta.env.PROD || !import.meta.env.VITEST)
        && globalThis.__ORCHESTRATE_APP_TEST_HOOKS__ === testHooks
      ) {
        delete testHooks.handleMarkNotificationAsRead
      }
    }
  }, [handleMarkNotificationAsRead])

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

    try {
      const update = applyScore(score, passScore, enrollment)
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
    } catch (error: unknown) {
      if (error instanceof RangeError) {
        toast.error('Unable to record score', {
          description: error.message,
        })
        return
      }
      throw error
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
              {localPreviewMode && (
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
    if (!hasPersistedUsers && previewMode) {
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
                <form className="space-y-4" noValidate onSubmit={firstAdminForm.handleSubmit(createFirstAdmin)}>
                  <div className="space-y-2">
                    <Label htmlFor="setup-name">Name</Label>
                    <Input
                      id="setup-name"
                      placeholder="Administrator"
                      {...firstAdminForm.register('name')}
                    />
                    {firstAdminForm.formState.errors.name && (
                      <p className="text-sm text-destructive">{firstAdminForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-email">Email</Label>
                    <Input
                      id="setup-email"
                      type="email"
                      placeholder="admin@company.com"
                      {...firstAdminForm.register('email')}
                    />
                    {firstAdminForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{firstAdminForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-password">Password</Label>
                    <Input
                      id="setup-password"
                      type="password"
                      {...firstAdminForm.register('password')}
                    />
                    {firstAdminForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{firstAdminForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full">
                    Create First Admin
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
          <Toaster />
        </div>
      )
    }

    if (!hasPersistedUsers && !previewMode) {
      return (
        <div className="min-h-screen bg-muted/20 p-6">
          <div className="mx-auto w-full max-w-md pt-16">
            <Card>
              <CardHeader>
                <CardTitle>Setup Required</CardTitle>
                <CardDescription>
                  No users have been created in this workspace yet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  User setup is only available during preview mode. Please configure users through your deployment or server setup process.
                </p>
                <Button
                  className="w-full"
                  onClick={handleEnterDemoMode}
                >
                  Enter Demo Mode
                </Button>
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
              <form className="space-y-4" noValidate onSubmit={signInForm.handleSubmit(handleSignIn)}>
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="name@company.com"
                    {...signInForm.register('email')}
                  />
                  {signInForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{signInForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    {...signInForm.register('password')}
                  />
                  {signInForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{signInForm.formState.errors.password.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  Sign In
                </Button>
                {localPreviewMode && (
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
        users={localPreviewMode ? safeUsers : [currentUser]}
        onSwitchUser={localPreviewMode ? handleSwitchUser : undefined}
        onLogout={localPreviewMode ? (demoModeEnabled ? handleSignOut : handleLogout) : undefined}
      >
        {renderView()}
      </Layout>
      <NotificationPermissionBanner />
      <Toaster />
    </>
  )
}

export default App
