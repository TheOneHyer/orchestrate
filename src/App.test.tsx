import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRuntimeEnvOverrides, AppTestHooks } from '@/test-support'

const toastSuccess = vi.fn()
const toastError = vi.fn()

/** Pass score threshold used for the record-score test course. */
const RECORD_SCORE_PASS_THRESHOLD = 80
/** A score strictly above the pass threshold — produces a passing enrollment and completion notification. */
const RECORD_SCORE_ABOVE_PASS = 90
/** A score strictly below the pass threshold — produces a failing enrollment and no notification. */
const RECORD_SCORE_BELOW_PASS = 50

const sendNotificationMock = vi.fn()
const scoringControls = vi.hoisted(() => ({
    applyScoreImpl: null as null | ((score: number, passScore: number, enrollment: unknown) => Record<string, unknown>),
    shouldNotifyCompletionImpl: null as null | ((status: unknown, score: number, passScore: number) => boolean),
}))
let utilizationNotified = false
function createUtilizationNotificationPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        userId: 'admin-1',
        type: 'system',
        title: 'Critical Alert',
        message: 'High-risk condition detected',
        read: false,
        priority: 'critical',
        link: '/trainer-wellness',
        ...overrides,
    }
}

let utilizationNotificationPayload: Record<string, unknown> = createUtilizationNotificationPayload()
const callbackSpies = {
    onCreateSession: vi.fn(),
    onUpdateSession: vi.fn(),
    onCreateCourse: vi.fn(),
    onCreateTemplateSessions: vi.fn(),
    onAddUser: vi.fn(),
    onUpdateUser: vi.fn(),
    onDeleteUser: vi.fn(),
    onAddCertification: vi.fn(),
    onMarkAsRead: vi.fn(),
    onMarkAsUnread: vi.fn(),
    onMarkAllAsRead: vi.fn(),
    onDismissOne: vi.fn(),
    onDismissRead: vi.fn(),
    onDismissAll: vi.fn(),
}
const ensureProfilesMock = vi.fn((users) => users)
const createPreviewSeedDataMock = vi.fn(() => ({
    users: [
        {
            id: 'admin-1',
            name: 'Admin User',
            email: 'admin@example.com',
            role: 'admin',
            department: 'Ops',
            certifications: [],
            hireDate: '2024-01-01T00:00:00.000Z',
        },
        {
            id: 'trainer-1',
            name: 'Trainer One',
            email: 'trainer1@example.com',
            role: 'trainer',
            department: 'Ops',
            certifications: [],
            hireDate: '2024-01-01T00:00:00.000Z',
            trainerProfile: {
                authorizedRoles: [],
                shiftSchedules: [],
                tenure: {
                    hireDate: '2024-01-01T00:00:00.000Z',
                    yearsOfService: 1,
                    monthsOfService: 12,
                },
                specializations: [],
            },
        },
    ],
    sessions: [],
    courses: [],
    enrollments: [],
    notifications: [],
    wellnessCheckIns: [],
    recoveryPlans: [],
    checkInSchedules: [],
    scheduleTemplates: [],
    riskHistorySnapshots: [],
    targetTrainerCoverage: 4,
}))
const getPreviewSeedModeMock = vi.fn(() => 'off')
const isPreviewSeedEnabledMock = vi.fn(() => false)

const kvSeed: Record<string, unknown> = {}
const kvState: Record<string, unknown> = {}

function setAppRuntimeEnv(overrides?: AppRuntimeEnvOverrides) {
    globalThis.__ORCHESTRATE_APP_TEST_ENV__ = overrides
}

function installAppTestHooks() {
    const hooks: AppTestHooks = {}
    globalThis.__ORCHESTRATE_APP_TEST_HOOKS__ = hooks
    return hooks
}

vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => toastSuccess(...args),
        error: (...args: unknown[]) => toastError(...args),
    },
}))

vi.mock('@github/spark/hooks', async () => {
    const React = await import('react')

    return {
        useKV: <T,>(key: string, initialValue: T) => {
            const seeded = Object.prototype.hasOwnProperty.call(kvSeed, key)
                ? (kvSeed[key] as T)
                : initialValue
            const [value, setValue] = React.useState<T>(seeded)

            React.useEffect(() => {
                kvState[key] = value
            }, [key, value])

            const setter = (next: T | ((current: T) => T)) => {
                setValue((current) => {
                    const resolvedValue = typeof next === 'function' ? (next as (current: T) => T)(current) : next
                    kvState[key] = resolvedValue
                    return resolvedValue
                })
            }

            return [value, setter, vi.fn()] as const
        },
    }
})

vi.mock('@/components/ui/sonner', () => ({
    Toaster: () => <div>Toaster Mock</div>,
}))

vi.mock('@/components/NotificationPermissionBanner', () => ({
    NotificationPermissionBanner: () => <div>NotificationPermissionBanner Mock</div>,
}))

vi.mock('@/components/Layout', () => ({
    Layout: ({
        children,
        onNavigate,
        activeView,
        notificationCount,
        currentUser,
        users,
        onSwitchUser,
        onLogout,
    }: {
        children: ReactNode
        onNavigate: (view: string) => void
        activeView: string
        notificationCount: number
        currentUser?: { id: string; name: string; role: string }
        users?: Array<{ id: string; name: string }>
        onSwitchUser?: (userId: string) => void
        onLogout?: () => void
    }) => (
        <div>
            <div>Active View: {activeView}</div>
            <div>Notification Count: {notificationCount}</div>
            <div>Current User: {currentUser?.name ?? 'none'}</div>
            <div>User Options: {users?.length ?? 0}</div>
            <button onClick={() => onNavigate('dashboard')}>Go Dashboard</button>
            <button onClick={() => onNavigate('schedule')}>Go Schedule</button>
            <button onClick={() => onNavigate('schedule-templates')}>Go Schedule Templates</button>
            <button onClick={() => onNavigate('courses')}>Go Courses</button>
            <button onClick={() => onNavigate('people')}>Go People</button>
            <button onClick={() => onNavigate('/people/trainer-1')}>Go People Deep Link</button>
            <button onClick={() => onNavigate('analytics')}>Go Analytics</button>
            <button onClick={() => onNavigate('trainer-availability')}>Go Trainer Availability</button>
            <button onClick={() => onNavigate('burnout-dashboard')}>Go Burnout</button>
            <button onClick={() => onNavigate('certifications')}>Go Certifications</button>
            <button onClick={() => onNavigate('certification-dashboard')}>Go Certification Dashboard</button>
            <button onClick={() => onNavigate('trainer-wellness')}>Go Wellness</button>
            <button onClick={() => onNavigate('notifications')}>Go Notifications</button>
            <button onClick={() => onNavigate('user-guide')}>Go User Guide</button>
            <button onClick={() => onNavigate('settings')}>Go Settings</button>
            <button onClick={() => onNavigate('unknown-view')}>Go Unknown</button>
            <button onClick={() => onNavigate('/')}>Go Root Path</button>
            <button onClick={() => onNavigate('/people/%ZZ')}>Go Malformed Path</button>
            <button onClick={() => onSwitchUser?.('trainer-1')}>Switch To Trainer</button>
            <button onClick={() => onLogout?.()}>Reset Session</button>
            {children}
        </div>
    ),
}))

vi.mock('@/components/views/Dashboard', () => ({
    Dashboard: ({
        onNavigate,
        enrollments,
    }: {
        onNavigate: (view: string) => void
        enrollments?: Array<{ id: string }>
    }) => (
        <div>
            <div>Dashboard View</div>
            <div>Dashboard Enrollments: {enrollments?.length ?? 0}</div>
            {enrollments?.map((enrollment) => (
                <div key={enrollment.id}>Enrollment: {enrollment.id}</div>
            ))}
            <button onClick={() => onNavigate('schedule')}>Dashboard to Schedule</button>
        </div>
    ),
}))

vi.mock('@/components/views/Schedule', () => ({
    Schedule: ({
        sessions,
        attendanceRecords,
        onCreateSession,
        onUpdateSession,
        onDeleteSession,
        onRecordScore,
        onMarkAttendance,
    }: {
        sessions: Array<{ id: string; title: string; status: string }>
        attendanceRecords?: Array<{ id: string; userId: string; status: string; notes?: string }>
        onCreateSession: (session: unknown) => void
        onUpdateSession: (id: string, session: unknown) => void
        onDeleteSession?: (id: string) => void
        onRecordScore?: (enrollmentId: string, score: number) => void
        onMarkAttendance?: (sessionId: string, userId: string, status: 'present' | 'absent') => void
    }) => (
        <div>
            <div>Schedule View</div>
            <div>Session Count: {sessions.length}</div>
            <div>Attendance Count: {attendanceRecords?.length ?? 0}</div>
            <div>Attendance Notes: {attendanceRecords?.[0]?.notes ?? ''}</div>
            {attendanceRecords?.map((record) => (
                <div key={record.id} data-testid={`attendance-record-${record.id}`}>
                    {record.userId}: {record.status}
                </div>
            ))}
            {sessions.map((session) => (
                <div key={session.id}>{session.id}|{session.title} ({session.status})</div>
            ))}
            <button onClick={() => {
                const payload = { title: 'Created Session', trainerId: 'trainer-1', recurrence: { pattern: 'weekly' } }
                callbackSpies.onCreateSession(payload)
                onCreateSession(payload)
            }}>Create Session</button>
            <button onClick={() => {
                const payload = { courseId: 'course-1' }
                onCreateSession(payload)
            }}>Create Minimal Session</button>
            <button onClick={() => {
                const payload = { status: 'completed' }
                callbackSpies.onUpdateSession('session-1', payload)
                onUpdateSession('session-1', payload)
            }}>Update Session</button>
            <button onClick={() => onUpdateSession('session-1', { status: 'completed', updatedAt: 'stale-updated-at' })}>Apply Stale Session Update</button>
            <button onClick={() => {
                const payload = { id: 'custom-session-id', title: 'Session With Custom Id' }
                onCreateSession(payload)
            }}>Create Session With Id</button>
            <button onClick={() => onDeleteSession?.('session-1')}>Delete Session</button>
            <button onClick={() => onMarkAttendance?.('session-2', 'trainer-1', 'present')}>Mark Present</button>
            <button onClick={() => onMarkAttendance?.('session-2', 'trainer-1', 'absent')}>Mark Absent</button>
            <button onClick={() => onRecordScore?.('enrollment-rs-1', RECORD_SCORE_ABOVE_PASS)}>Record Score Pass</button>
            <button onClick={() => onRecordScore?.('enrollment-rs-1', RECORD_SCORE_BELOW_PASS)}>Record Score Fail</button>
            <button onClick={() => onRecordScore?.('enrollment-rs-1', RECORD_SCORE_PASS_THRESHOLD)}>Record Score Notify</button>
            <button onClick={() => onRecordScore?.('unknown-enrollment', RECORD_SCORE_ABOVE_PASS)}>Record Score Unknown</button>
        </div>
    ),
}))

vi.mock('@/components/views/ScheduleTemplates', () => ({
    ScheduleTemplates: ({ onCreateSessions }: { onCreateSessions: (sessions: unknown[]) => void }) => (
        <div>
            <div>Schedule Templates View</div>
            <button onClick={() => {
                const payload = [{ title: 'Template Session', recurrence: { pattern: 'monthly' } }]
                callbackSpies.onCreateTemplateSessions(payload)
                onCreateSessions(payload)
            }}>Create Template Sessions</button>
            <button onClick={() => {
                onCreateSessions([{ courseId: 'course-1' }])
            }}>Create Minimal Template Sessions</button>
            <button onClick={() => {
                onCreateSessions([{ id: 'custom-template-session-id', title: 'Template Session With Custom Id' }])
            }}>Create Template Session With Id</button>
        </div>
    ),
}))

vi.mock('@/components/views/Courses', () => ({
    Courses: ({
        courses,
        onCreateCourse,
        onUpdateCourse,
        onDeleteCourse,
    }: {
        courses: Array<{
            id: string
            title: string
            createdBy: string
            duration: number
            passScore: number
            published: boolean
            createdAt: string
        }>
        onCreateCourse?: (course: unknown) => void
        onUpdateCourse?: (id: string, course: unknown) => void
        onDeleteCourse?: (id: string) => void
    }) => (
        <div>
            <div>Courses View</div>
            <div>Courses Count: {courses.length}</div>
            {courses.map((course) => (
                <div key={course.id} data-testid="course-row">
                    {course.id}|{course.title}|{course.createdBy}|{course.duration}|{course.passScore}|{course.published ? 'published' : 'draft'}|{course.createdAt}
                </div>
            ))}
            <button onClick={() => {
                const payload = { title: 'Partial Course' }
                callbackSpies.onCreateCourse(payload)
                onCreateCourse?.(payload)
            }}>Create Minimal Course</button>
            <button onClick={() => {
                const payload = {
                    title: 'Explicit Course',
                    description: 'Explicit description',
                    duration: 90,
                    passScore: 92,
                    modules: ['M1'],
                    certifications: ['C1'],
                    createdBy: 'trainer-1',
                    createdAt: '2024-01-02T00:00:00.000Z',
                    published: true,
                }
                callbackSpies.onCreateCourse(payload)
                onCreateCourse?.(payload)
            }}>Create Explicit Course</button>
            <button onClick={() => {
                const payload = {
                    id: 'custom-course-id',
                    title: 'Course With Id',
                }
                callbackSpies.onCreateCourse(payload)
                onCreateCourse?.(payload)
            }}>Create Course With Id</button>
            <button onClick={() => onCreateCourse?.({})}>Create Empty Course</button>
            <button onClick={() => onUpdateCourse?.(courses[0]?.id ?? 'course-1', { published: true, updatedAt: 'stale-updated-at' })}>Update Course</button>
            <button onClick={() => onDeleteCourse?.(courses[0]?.id ?? 'course-1')}>Delete Course</button>
        </div>
    ),
}))
vi.mock('@/components/views/People', () => ({
    People: ({
        users,
        onAddUser,
        onUpdateUser,
        onDeleteUser,
        navigationPayload,
        onNavigationPayloadConsumed,
    }: {
        users: Array<{ id: string; name: string }>
        onAddUser: (user: unknown) => void
        onUpdateUser: (user: unknown) => void
        onDeleteUser: (userId: string) => void
        navigationPayload?: unknown
        onNavigationPayloadConsumed?: () => void
    }) => (
        <div>
            <div>People View</div>
            {navigationPayload !== undefined && (
                <div data-testid="people-nav-payload">{JSON.stringify(navigationPayload)}</div>
            )}
            <div>Users Count: {users.length}</div>
            {users.map((user) => (
                <div key={user.id}>{user.name}</div>
            ))}
            <button onClick={() => {
                const payload = { id: 'employee-2', role: 'employee', name: 'Added User', email: 'added@example.com', department: 'Ops', certifications: [], hireDate: '2024-01-01T00:00:00.000Z' }
                callbackSpies.onAddUser(payload)
                onAddUser(payload)
            }}>Add User</button>
            <button onClick={() => {
                const payload = { id: 'trainer-1', role: 'trainer', name: 'Updated Trainer', email: 'trainer1@example.com', department: 'Ops', certifications: [], hireDate: '2024-01-01T00:00:00.000Z', trainerProfile: { authorizedRoles: [], shiftSchedules: [], tenure: { hireDate: '2024-01-01T00:00:00.000Z', yearsOfService: 1, monthsOfService: 12 }, specializations: [] } }
                callbackSpies.onUpdateUser(payload)
                onUpdateUser(payload)
            }}>Update User</button>
            <button onClick={() => onUpdateUser({ id: 'trainer-1', role: 'trainer', name: 'Updated Trainer', email: 'trainer1@example.com', department: 'Ops', certifications: [], hireDate: '2024-01-01T00:00:00.000Z', updatedAt: 'stale-updated-at', trainerProfile: { authorizedRoles: [], shiftSchedules: [], tenure: { hireDate: '2024-01-01T00:00:00.000Z', yearsOfService: 1, monthsOfService: 12 }, specializations: [] } })}>Apply Stale User Update</button>
            <button onClick={() => {
                callbackSpies.onDeleteUser('trainer-1')
                onDeleteUser('trainer-1')
            }}>Delete User</button>
            <button onClick={() => onDeleteUser('admin-1')}>Delete Active User</button>
            <button onClick={() => onNavigationPayloadConsumed?.()}>Consume Navigation Payload</button>
        </div>
    ),
}))
vi.mock('@/components/views/Analytics', () => ({ Analytics: () => <div>Analytics View</div> }))
vi.mock('@/components/views/TrainerAvailability', () => ({ TrainerAvailability: () => <div>Trainer Availability View</div> }))
vi.mock('@/components/views/BurnoutDashboard', () => ({ BurnoutDashboard: () => <div>Burnout Dashboard View</div> }))
vi.mock('@/components/views/TrainerWellness', () => ({ TrainerWellness: () => <div>Trainer Wellness View</div> }))
vi.mock('@/components/views/CertificationDashboard', () => ({
    CertificationDashboard: ({
        users,
        onAddCertification,
    }: {
        users: Array<{ id: string; trainerProfile?: { certificationRecords?: Array<{ certificationName: string }> } }>
        onAddCertification: (trainerIds: string[], cert: unknown) => void
    }) => {
        const certificationRecords = users
            .find((user) => user.id === 'trainer-1')
            ?.trainerProfile?.certificationRecords || []

        return (
            <div>
                <div>Certification Dashboard View</div>
                <div>Certification Records: {certificationRecords.length}</div>
                {certificationRecords.map((record) => (
                    <div key={record.certificationName}>{record.certificationName}</div>
                ))}
                <button onClick={() => {
                    const payload = { certificationName: 'CPR', issuedDate: '2026-01-01', expirationDate: '2027-01-01' }
                    callbackSpies.onAddCertification(['trainer-1'], payload)
                    onAddCertification(['trainer-1'], payload)
                }}>Add Certification</button>
            </div>
        )
    },
}))
vi.mock('@/components/views/UserGuide', () => ({ UserGuide: () => <div>User Guide View</div> }))
vi.mock('@/components/views/Notifications', () => ({
    Notifications: ({
        notifications,
        onMarkAsRead,
        onMarkAsUnread,
        onMarkAllAsRead,
        onDismiss,
        onDismissAll,
    }: {
        notifications: Array<{ id: string; read: boolean }>
        onMarkAsRead: (id: string) => void
        onMarkAsUnread: (id: string) => void
        onMarkAllAsRead: () => void
        onDismiss: (id: string) => void
        onDismissAll: (filter?: 'all' | 'read') => void
    }) => {
        const firstNotificationId = notifications[0]?.id ?? 'missing-id'
        const unreadCount = notifications.filter((notification) => !notification.read).length

        return (
            <div>
                <div>Notifications View</div>
                <div>Notifications Total: {notifications.length}</div>
                <div>Notifications Unread: {unreadCount}</div>
                <button onClick={() => {
                    callbackSpies.onMarkAsRead(firstNotificationId)
                    onMarkAsRead(firstNotificationId)
                }}>Mark Read</button>
                <button onClick={() => {
                    callbackSpies.onMarkAsUnread(firstNotificationId)
                    onMarkAsUnread(firstNotificationId)
                }}>Mark Unread</button>
                <button onClick={() => {
                    callbackSpies.onMarkAllAsRead()
                    onMarkAllAsRead()
                }}>Mark All Read</button>
                <button onClick={() => {
                    callbackSpies.onDismissOne(firstNotificationId)
                    onDismiss(firstNotificationId)
                }}>Dismiss One</button>
                <button onClick={() => {
                    callbackSpies.onDismissRead()
                    onDismissAll('read')
                }}>Dismiss Read</button>
                <button onClick={() => {
                    callbackSpies.onDismissAll()
                    onDismissAll('all')
                }}>Dismiss All</button>
            </div>
        )
    },
}))

vi.mock('@/hooks/use-push-notifications', () => ({
    usePushNotifications: () => ({ sendNotification: sendNotificationMock }),
}))

vi.mock('@/hooks/use-certification-notifications', () => ({
    useCertificationNotifications: vi.fn(),
}))

vi.mock('@/hooks/use-utilization-notifications', async () => {
    const React = await import('react')

    return {
        useUtilizationNotifications: (_users: unknown, _sessions: unknown, onCreateNotification: (notif: any) => void) => {
            React.useEffect(() => {
                if (utilizationNotified) {
                    return
                }

                utilizationNotified = true
                onCreateNotification(utilizationNotificationPayload)
            }, [onCreateNotification])
        },
    }
})

vi.mock('@/lib/trainer-profile-generator', () => ({
    ensureAllTrainersHaveProfiles: (users: unknown) => ensureProfilesMock(users),
}))

vi.mock('@/lib/preview-mode', () => ({
    getPreviewSeedMode: () => getPreviewSeedModeMock(),
    isPreviewSeedEnabled: () => isPreviewSeedEnabledMock(),
}))

vi.mock('@/lib/preview-seed-data', () => ({
    PREVIEW_SEED_VERSION: 'preview-seed-v1',
    createPreviewSeedData: () => createPreviewSeedDataMock(),
}))

vi.mock('@/lib/scoring', async () => {
    const actual = await vi.importActual<typeof import('@/lib/scoring')>('@/lib/scoring')

    return {
        ...actual,
        applyScore: (...args: Parameters<typeof actual.applyScore>) => (
            scoringControls.applyScoreImpl ? scoringControls.applyScoreImpl(...args) : actual.applyScore(...args)
        ),
        shouldNotifyCompletion: (...args: Parameters<typeof actual.shouldNotifyCompletion>) => (
            scoringControls.shouldNotifyCompletionImpl
                ? scoringControls.shouldNotifyCompletionImpl(...args)
                : actual.shouldNotifyCompletion(...args)
        ),
    }
})

import App from './App'

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        utilizationNotified = false
        utilizationNotificationPayload = createUtilizationNotificationPayload()
        scoringControls.applyScoreImpl = null
        scoringControls.shouldNotifyCompletionImpl = null
        getPreviewSeedModeMock.mockReturnValue('off')
        isPreviewSeedEnabledMock.mockReturnValue(false)
        Object.keys(kvSeed).forEach((key) => delete kvSeed[key])
        Object.keys(kvState).forEach((key) => delete kvState[key])
        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
            {
                id: 'trainer-1',
                name: 'Trainer One',
                email: 'trainer1@example.com',
                role: 'trainer',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
                trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [],
                    tenure: {
                        hireDate: '2024-01-01T00:00:00.000Z',
                        yearsOfService: 1,
                        monthsOfService: 12,
                    },
                    specializations: [],
                },
            },
        ]
        kvSeed['sessions'] = [
            {
                id: 'session-1',
                courseId: 'course-1',
                trainerId: 'trainer-1',
                title: 'Upcoming Session A',
                startTime: '2099-01-01T09:00:00.000Z',
                endTime: '2099-01-01T10:00:00.000Z',
                location: 'Room A',
                capacity: 10,
                enrolledStudents: [],
                status: 'scheduled',
            },
            {
                id: 'session-2',
                courseId: 'course-1',
                trainerId: 'trainer-2',
                title: 'Upcoming Session B',
                startTime: '2099-01-01T11:00:00.000Z',
                endTime: '2099-01-01T12:00:00.000Z',
                location: 'Room B',
                capacity: 10,
                enrolledStudents: ['trainer-1'],
                status: 'scheduled',
            },
        ]
        kvSeed['active-user-id'] = 'admin-1'
        kvSeed['auth-passwords'] = {
            'admin-1': 'password123',
            'trainer-1': 'password123',
        }
        vi.stubGlobal('confirm', vi.fn(() => true))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        setAppRuntimeEnv(undefined)
        globalThis.__ORCHESTRATE_APP_TEST_HOOKS__ = undefined
        localStorage.clear()
        sessionStorage.clear()
    })

    it('renders dashboard by default and supports navigation across views', async () => {
        const user = userEvent.setup()

        render(<App />)

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/schedule view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go schedule templates$/i }))
        expect(screen.getByText(/schedule templates view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go courses$/i }))
        expect(screen.getByText(/courses view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        expect(screen.getByText(/people view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go people deep link$/i }))
        expect(screen.getByText(/people view/i)).toBeInTheDocument()
        expect(screen.getByTestId('people-nav-payload')).toHaveTextContent(JSON.stringify({ userId: 'trainer-1' }))

        await user.click(screen.getByRole('button', { name: /^go analytics$/i }))
        expect(screen.getByText(/analytics view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go trainer availability$/i }))
        expect(screen.getByText(/trainer availability view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go burnout$/i }))
        expect(screen.getByText(/burnout dashboard view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go certifications$/i }))
        expect(screen.getByText(/certification dashboard view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go certification dashboard$/i }))
        expect(screen.getByText(/certification dashboard view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go wellness$/i }))
        expect(screen.getByText(/trainer wellness view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go notifications$/i }))
        expect(screen.getByText(/notifications view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go user guide$/i }))
        expect(screen.getByText(/user guide view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        expect(screen.getByText(/preview test data/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go unknown$/i }))
        expect(screen.getByText(/preview test data/i)).toBeInTheDocument()
    })

    it('warns and ignores navigation when normalizeNavigationValue returns null', async () => {
        const user = userEvent.setup()
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

        render(<App />)

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go root path$/i }))

        expect(warnSpy).toHaveBeenCalledWith(
            '[handleNavigate] Ignoring navigation because normalizeNavigationValue returned null',
            { view: '/' }
        )
        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()

        warnSpy.mockRestore()
    })

    it('warns and ignores navigation when normalizeNavigationValue throws on malformed path', async () => {
        const user = userEvent.setup()
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

        render(<App />)

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go malformed path$/i }))

        expect(warnSpy).toHaveBeenCalledWith(
            '[handleNavigate] Ignoring navigation because normalizeNavigationValue threw',
            expect.objectContaining({ view: '/people/%ZZ', error: expect.any(URIError) })
        )
        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()

        warnSpy.mockRestore()
    })

    it('handles notification creation and routes on notification click action', async () => {
        render(<App />)

        await waitFor(() => {
            expect(sendNotificationMock).toHaveBeenCalledWith(
                'Critical Alert',
                expect.objectContaining({ priority: 'critical' })
            )
        })

        expect(toastError).toHaveBeenCalled()

        const sendCall = sendNotificationMock.mock.calls[0]
        const options = sendCall[1]
        act(() => {
            options.onClick()
        })

        expect(await screen.findByText(/trainer wellness view/i)).toBeInTheDocument()
    })

    it('loads and resets preview data from settings actions', async () => {
        const user = userEvent.setup()
        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))

        await user.click(screen.getByRole('button', { name: /load seed data/i }))
        expect(globalThis.confirm).toHaveBeenCalled()
        expect(createPreviewSeedDataMock).toHaveBeenCalled()
        expect(toastSuccess).toHaveBeenCalledWith(
            'Preview test data loaded',
            expect.objectContaining({ description: expect.stringMatching(/seeded/i) })
        )

        await user.click(screen.getByRole('button', { name: /reset preview data/i }))
        expect(toastSuccess).toHaveBeenCalledWith(
            'Preview data reset complete',
            expect.objectContaining({ description: expect.stringMatching(/cleared/i) })
        )
    })

    it('requires sign in when there is no active session and allows valid login', async () => {
        const user = userEvent.setup()
        kvSeed['active-user-id'] = ''

        render(<App />)

        expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()

        await user.type(screen.getByLabelText(/email/i), 'admin@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))

        expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()
    })

    it('lets a newly added user sign in with the default local password', async () => {
        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        await user.click(screen.getByRole('button', { name: /add user/i }))
        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        await user.click(screen.getByRole('button', { name: /^sign out$/i }))

        expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()

        await user.type(screen.getByLabelText(/email/i), 'added@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))

        expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()
        expect(screen.getByText(/current user:\s*added user/i)).toBeInTheDocument()
    })

    it('tracks attendance as first-class session data', async () => {
        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/attendance count:\s*0/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^mark present$/i }))
        expect(screen.getByText(/attendance count:\s*1/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^mark absent$/i }))
        expect(screen.getByText(/attendance count:\s*1/i)).toBeInTheDocument()
    })

    it('shows a warning toast when a stale course update is applied', async () => {
        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go courses$/i }))
        await user.click(screen.getByRole('button', { name: /create minimal course/i }))

        toastError.mockClear()
        await user.click(screen.getByRole('button', { name: /update course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Concurrent edit warning',
            expect.objectContaining({ description: expect.stringMatching(/last-write-wins/i) })
        )
    })

    it('runs callback actions exposed by child views', async () => {
        const user = userEvent.setup()

        render(<App />)

        await waitFor(() => {
            expect(screen.getByText(/notification count:\s*1/i)).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/session count:\s*2/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^create session$/i }))
        expect(screen.getByText(/session count:\s*3/i)).toBeInTheDocument()
        expect(screen.getByText(/created session \(scheduled\)/i)).toBeInTheDocument()
        expect(callbackSpies.onCreateSession).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Created Session', trainerId: 'trainer-1' })
        )

        await user.click(screen.getByRole('button', { name: /update session/i }))
        expect(screen.getByText(/upcoming session a \(completed\)/i)).toBeInTheDocument()
        expect(callbackSpies.onUpdateSession).toHaveBeenCalledWith(
            'session-1',
            expect.objectContaining({ status: 'completed' })
        )

        await user.click(screen.getByRole('button', { name: /^go schedule templates$/i }))
        await user.click(screen.getByRole('button', { name: /create template sessions/i }))
        expect(callbackSpies.onCreateTemplateSessions).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ title: 'Template Session' })])
        )

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/session count:\s*4/i)).toBeInTheDocument()
        expect(screen.getByText(/template session \(scheduled\)/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /create session with id/i }))
        expect(screen.getByText(/session count:\s*5/i)).toBeInTheDocument()
        expect(screen.getByText(/custom-session-id\|session with custom id \(scheduled\)/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go schedule templates$/i }))
        await user.click(screen.getByRole('button', { name: /create template session with id/i }))

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/session count:\s*6/i)).toBeInTheDocument()
        expect(screen.getByText(/custom-template-session-id\|template session with custom id \(scheduled\)/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go courses$/i }))
        expect(screen.getByText(/courses count:\s*0/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /create minimal course/i }))
        expect(callbackSpies.onCreateCourse).toHaveBeenCalledWith(expect.objectContaining({ title: 'Partial Course' }))
        expect(screen.getByText(/courses count:\s*1/i)).toBeInTheDocument()
        expect(screen.getByText(/partial course\|admin-1\|60\|80\|draft/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /create explicit course/i }))
        expect(callbackSpies.onCreateCourse).toHaveBeenCalledWith(expect.objectContaining({ title: 'Explicit Course' }))
        expect(screen.getByText(/courses count:\s*2/i)).toBeInTheDocument()
        expect(screen.getByText(/explicit course\|trainer-1\|90\|92\|published\|2024-01-02t00:00:00.000z/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /create course with id/i }))
        expect(callbackSpies.onCreateCourse).toHaveBeenCalledWith(expect.objectContaining({ id: 'custom-course-id' }))
        expect(screen.getByText(/courses count:\s*3/i)).toBeInTheDocument()
        expect(screen.getByText(/custom-course-id\|course with id\|admin-1\|60\|80\|draft/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /update course/i }))
        expect(screen.getAllByTestId('course-row')[0]).toHaveTextContent(/published/i)

        await user.click(screen.getByRole('button', { name: /delete course/i }))
        expect(screen.getByText(/courses count:\s*2/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        await user.click(screen.getByRole('button', { name: /delete session/i }))
        expect(screen.getByText(/session count:\s*5/i)).toBeInTheDocument()
        expect(screen.queryByText(/upcoming session a \(completed\)/i)).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /switch to trainer/i }))
        expect(screen.getByText(/current user:\s*trainer one/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /reset session/i }))
        expect(screen.getByText(/current user:\s*admin user/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        expect(screen.getByText(/users count:\s*2/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /add user/i }))
        expect(screen.getByText(/users count:\s*3/i)).toBeInTheDocument()
        expect(screen.getByText('Added User')).toBeInTheDocument()
        expect(callbackSpies.onAddUser).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'employee-2', name: 'Added User' })
        )

        await user.click(screen.getByRole('button', { name: /update user/i }))
        expect(screen.getByText('Updated Trainer')).toBeInTheDocument()
        expect(screen.queryByText('Trainer One')).not.toBeInTheDocument()
        expect(callbackSpies.onUpdateUser).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'trainer-1', name: 'Updated Trainer' })
        )

        await user.click(screen.getByRole('button', { name: /^go certifications$/i }))
        expect(screen.getByText(/certification records:\s*0/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /add certification/i }))
        expect(screen.getByText(/certification records:\s*1/i)).toBeInTheDocument()
        expect(screen.getByText('CPR')).toBeInTheDocument()
        expect(callbackSpies.onAddCertification).toHaveBeenCalledWith(
            ['trainer-1'],
            expect.objectContaining({ certificationName: 'CPR' })
        )

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        await user.click(screen.getByRole('button', { name: /delete user/i }))
        expect(screen.queryByText('Updated Trainer')).not.toBeInTheDocument()
        expect(screen.getByText(/users count:\s*2/i)).toBeInTheDocument()
        expect(callbackSpies.onDeleteUser).toHaveBeenCalledWith('trainer-1')

        await user.click(screen.getByRole('button', { name: /^go notifications$/i }))
        expect(screen.getByText(/notifications total:\s*1/i)).toBeInTheDocument()
        expect(screen.getByText(/notifications unread:\s*1/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /mark read/i }))
        expect(screen.getByText(/notifications unread:\s*0/i)).toBeInTheDocument()
        expect(callbackSpies.onMarkAsRead).toHaveBeenCalledWith(expect.any(String))

        await user.click(screen.getByRole('button', { name: /mark unread/i }))
        expect(screen.getByText(/notifications unread:\s*1/i)).toBeInTheDocument()
        expect(callbackSpies.onMarkAsUnread).toHaveBeenCalledWith(expect.any(String))

        await user.click(screen.getByRole('button', { name: /mark all read/i }))
        expect(screen.getByText(/notifications unread:\s*0/i)).toBeInTheDocument()
        expect(callbackSpies.onMarkAllAsRead).toHaveBeenCalledOnce()

        await user.click(screen.getByRole('button', { name: /dismiss one/i }))
        expect(screen.getByText(/notifications total:\s*0/i)).toBeInTheDocument()
        expect(callbackSpies.onDismissOne).toHaveBeenCalledWith(expect.any(String))

        await user.click(screen.getByRole('button', { name: /dismiss read/i }))
        expect(screen.getByText(/notifications total:\s*0/i)).toBeInTheDocument()
        expect(callbackSpies.onDismissRead).toHaveBeenCalledOnce()

        await user.click(screen.getByRole('button', { name: /dismiss all/i }))
        expect(screen.getByText(/notifications total:\s*0/i)).toBeInTheDocument()
        expect(callbackSpies.onDismissAll).toHaveBeenCalledOnce()

        expect(screen.getByText(/notificationpermissionbanner mock/i)).toBeInTheDocument()
        expect(screen.getByText(/toaster mock/i)).toBeInTheDocument()
    })

    it('switches roles from settings and blocks restricted navigation for trainers', async () => {
        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        expect(screen.getByText(/local session/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /switch to trainer one/i }))
        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
        expect(screen.getByText(/current user:\s*trainer one/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        expect(toastError).toHaveBeenCalledWith(
            'Access restricted',
            expect.objectContaining({ description: expect.stringMatching(/not available for the active role/i) })
        )
        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /reset session/i }))
        expect(screen.getByText(/current user:\s*admin user/i)).toBeInTheDocument()
    })

    it('falls back to the first remaining user when the active user is deleted', async () => {
        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: /switch to trainer/i }))
        expect(screen.getByText(/current user:\s*trainer one/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        await user.click(screen.getByRole('button', { name: /delete user/i }))

        await waitFor(() => {
            expect(screen.getByText(/current user:\s*admin user/i)).toBeInTheDocument()
        })
    })

    it('reverts to a permitted view and prunes user-owned data when deleting the active user', async () => {
        const user = userEvent.setup()

        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
            {
                id: 'trainer-1',
                name: 'Trainer One',
                email: 'trainer1@example.com',
                role: 'trainer',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
                trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [],
                    tenure: {
                        hireDate: '2024-01-01T00:00:00.000Z',
                        yearsOfService: 1,
                        monthsOfService: 12,
                    },
                    specializations: [],
                },
            },
        ]
        kvSeed['active-user-id'] = 'admin-1'
        kvSeed['auth-passwords'] = {
            'admin-1': 'admin-secret',
            'trainer-1': 'trainer-secret',
        }
        kvSeed['sessions'] = [
            {
                id: 'session-1',
                courseId: 'course-1',
                trainerId: 'admin-1',
                title: 'Admin-led Session',
                startTime: '2026-03-20T09:00:00.000Z',
                endTime: '2026-03-20T11:00:00.000Z',
                location: 'Room A',
                capacity: 10,
                enrolledStudents: ['admin-1', 'trainer-1'],
                status: 'scheduled',
            },
        ]
        kvSeed['enrollments'] = [
            {
                id: 'enrollment-1',
                userId: 'admin-1',
                courseId: 'course-1',
                status: 'enrolled',
                progress: 25,
                enrolledAt: '2026-03-01T00:00:00.000Z',
            },
            {
                id: 'enrollment-2',
                userId: 'trainer-1',
                courseId: 'course-1',
                status: 'enrolled',
                progress: 50,
                enrolledAt: '2026-03-01T00:00:00.000Z',
            },
        ]
        kvSeed['attendance-records'] = [
            {
                id: 'attendance-1',
                sessionId: 'session-1',
                userId: 'admin-1',
                status: 'present',
                markedBy: 'trainer-1',
                markedAt: '2026-03-20T09:05:00.000Z',
            },
            {
                id: 'attendance-2',
                sessionId: 'session-1',
                userId: 'trainer-1',
                status: 'present',
                markedBy: 'admin-1',
                markedAt: '2026-03-20T09:05:00.000Z',
            },
        ]
        kvSeed['notifications'] = [
            {
                id: 'notification-1',
                userId: 'admin-1',
                type: 'system',
                title: 'Admin notice',
                message: 'Message',
                read: false,
                createdAt: '2026-03-20T08:00:00.000Z',
            },
            {
                id: 'notification-2',
                userId: 'trainer-1',
                type: 'system',
                title: 'Trainer notice',
                message: 'Message',
                read: false,
                createdAt: '2026-03-20T08:00:00.000Z',
            },
        ]
        kvSeed['wellness-check-ins'] = [
            {
                id: 'checkin-1',
                trainerId: 'admin-1',
                timestamp: '2026-03-18T10:00:00.000Z',
                mood: 3,
                stress: 'moderate',
                energy: 'neutral',
                workloadSatisfaction: 3,
                sleepQuality: 3,
                physicalWellbeing: 3,
                mentalClarity: 3,
                followUpRequired: false,
            },
        ]
        kvSeed['recovery-plans'] = [
            {
                id: 'plan-1',
                trainerId: 'admin-1',
                createdBy: 'trainer-1',
                createdAt: '2026-03-18T00:00:00.000Z',
                status: 'active',
                triggerReason: 'Load',
                targetUtilization: 60,
                currentUtilization: 85,
                startDate: '2026-03-18',
                targetCompletionDate: '2026-04-18',
                actions: [],
                checkIns: ['checkin-1'],
            },
        ]
        kvSeed['check-in-schedules'] = [
            {
                id: 'schedule-1',
                trainerId: 'admin-1',
                frequency: 'weekly',
                startDate: '2026-03-20T00:00:00.000Z',
                nextScheduledDate: '2026-03-27T00:00:00.000Z',
                status: 'active',
                notificationEnabled: true,
                autoReminders: true,
                reminderHoursBefore: 24,
                createdBy: 'trainer-1',
                createdAt: '2026-03-19T00:00:00.000Z',
                completedCheckIns: 0,
                missedCheckIns: 0,
            },
        ]
        kvSeed['schedule-templates'] = [
            {
                id: 'template-1',
                name: 'Admin Template',
                description: 'Owned by admin',
                category: 'general',
                recurrenceType: 'weekly',
                sessions: [
                    {
                        dayOfWeek: 1,
                        time: '09:00',
                        duration: 60,
                        capacity: 10,
                        requiresCertifications: [],
                    },
                ],
                autoAssignTrainers: true,
                notifyParticipants: true,
                createdBy: 'admin-1',
                createdAt: '2026-03-19T00:00:00.000Z',
                usageCount: 0,
                tags: [],
                isActive: true,
            },
            {
                id: 'template-2',
                name: 'Shared Template',
                description: 'Keeps other trainers',
                category: 'general',
                recurrenceType: 'weekly',
                sessions: [
                    {
                        dayOfWeek: 2,
                        time: '10:00',
                        duration: 90,
                        capacity: 8,
                        requiresCertifications: [],
                        preferredTrainers: ['admin-1', 'trainer-1'],
                    },
                ],
                autoAssignTrainers: true,
                notifyParticipants: true,
                createdBy: 'trainer-1',
                createdAt: '2026-03-19T00:00:00.000Z',
                usageCount: 0,
                tags: [],
                isActive: true,
            },
        ]
        kvSeed['risk-history-snapshots'] = [
            {
                id: 'snapshot-1',
                trainerId: 'admin-1',
                timestamp: '2026-03-20T00:00:00.000Z',
                riskScore: 70,
                riskLevel: 'critical',
                utilizationRate: 90,
                hoursScheduled: 40,
                sessionCount: 4,
                consecutiveDays: 5,
                factorCount: 3,
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        expect(screen.getByText(/local session/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        await user.click(screen.getByRole('button', { name: /^delete active user$/i }))

        await waitFor(() => {
            expect(screen.getByText(/current user:\s*trainer one/i)).toBeInTheDocument()
            expect(screen.getByText(/active view:\s*people/i)).toBeInTheDocument()
        })

        expect(kvState['auth-passwords']).toEqual({ 'trainer-1': 'trainer-secret' })
        expect(kvState['enrollments']).toEqual([
            expect.objectContaining({ id: 'enrollment-2', userId: 'trainer-1' }),
        ])
        expect(kvState['attendance-records']).toEqual([
            expect.objectContaining({ id: 'attendance-2', userId: 'trainer-1' }),
        ])
        expect(kvState['notifications']).toEqual([
            expect.objectContaining({ id: 'notification-2', userId: 'trainer-1' }),
        ])
        expect(kvState['wellness-check-ins']).toEqual([])
        expect(kvState['recovery-plans']).toEqual([])
        expect(kvState['check-in-schedules']).toEqual([])
        expect(kvState['risk-history-snapshots']).toEqual([])
        expect(kvState['sessions']).toEqual([
            expect.objectContaining({
                id: 'session-1',
                trainerId: '',
                enrolledStudents: ['trainer-1'],
                status: 'scheduled',
            }),
        ])
        expect(kvState['schedule-templates']).toEqual([
            expect.objectContaining({
                id: 'template-2',
                sessions: [
                    expect.objectContaining({ preferredTrainers: ['trainer-1'] }),
                ],
            }),
        ])
    })

    it('removes deleted students from session rosters even when they have no stored password entry', async () => {
        const user = userEvent.setup()

        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
            {
                id: 'trainer-1',
                name: 'Trainer One',
                email: 'trainer1@example.com',
                role: 'trainer',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
                trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [],
                    tenure: {
                        hireDate: '2024-01-01T00:00:00.000Z',
                        yearsOfService: 1,
                        monthsOfService: 12,
                    },
                    specializations: [],
                },
            },
        ]
        kvSeed['auth-passwords'] = { 'admin-1': 'admin-secret' }
        kvSeed['sessions'] = [
            {
                id: 'session-1',
                courseId: 'course-1',
                trainerId: 'admin-1',
                title: 'Roster Cleanup Session',
                startTime: '2026-03-20T09:00:00.000Z',
                endTime: '2026-03-20T11:00:00.000Z',
                location: 'Room A',
                capacity: 10,
                enrolledStudents: ['trainer-1'],
                status: 'scheduled',
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        await user.click(screen.getByRole('button', { name: /^delete user$/i }))

        await waitFor(() => {
            expect(kvState['sessions']).toEqual([
                expect.objectContaining({
                    id: 'session-1',
                    trainerId: 'admin-1',
                    enrolledStudents: [],
                }),
            ])
        })

        expect(kvState['auth-passwords']).toEqual({ 'admin-1': 'admin-secret' })
    })

    it('clears one-time people deep-link payload after consumption callback', async () => {
        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go people deep link$/i }))
        expect(screen.getByTestId('people-nav-payload')).toHaveTextContent(JSON.stringify({ userId: 'trainer-1' }))

        await user.click(screen.getByRole('button', { name: /consume navigation payload/i }))
        expect(screen.getByTestId('people-nav-payload')).toHaveTextContent('null')
    })

    it('filters visible data for employee sessions, courses, and notifications', async () => {
        const user = userEvent.setup()

        kvSeed['users'] = [
            ...(kvSeed['users'] as Array<Record<string, unknown>>),
            {
                id: 'employee-1',
                name: 'Employee One',
                email: 'employee1@example.com',
                role: 'employee',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
        ]
        kvSeed['courses'] = [
            {
                id: 'course-published',
                title: 'Published Course',
                description: 'Visible to employees',
                duration: 60,
                passScore: 80,
                modules: [],
                certifications: [],
                createdBy: 'admin-1',
                createdAt: '2024-01-01T00:00:00.000Z',
                published: true,
            },
            {
                id: 'course-draft-enrolled',
                title: 'Draft Enrolled Course',
                description: 'Visible because of enrollment',
                duration: 75,
                passScore: 85,
                modules: [],
                certifications: [],
                createdBy: 'trainer-1',
                createdAt: '2024-01-02T00:00:00.000Z',
                published: false,
            },
            {
                id: 'course-hidden',
                title: 'Hidden Draft Course',
                description: 'Should stay hidden',
                duration: 90,
                passScore: 90,
                modules: [],
                certifications: [],
                createdBy: 'trainer-1',
                createdAt: '2024-01-03T00:00:00.000Z',
                published: false,
            },
        ]
        kvSeed['sessions'] = [
            {
                id: 'session-employee-visible',
                courseId: 'course-draft-enrolled',
                trainerId: 'trainer-1',
                title: 'Employee Visible Session',
                startTime: '2099-01-01T09:00:00.000Z',
                endTime: '2099-01-01T10:00:00.000Z',
                location: 'Room A',
                capacity: 10,
                enrolledStudents: ['employee-1'],
                status: 'scheduled',
            },
            {
                id: 'session-hidden',
                courseId: 'course-hidden',
                trainerId: 'trainer-1',
                title: 'Hidden Session',
                startTime: '2099-01-01T11:00:00.000Z',
                endTime: '2099-01-01T12:00:00.000Z',
                location: 'Room B',
                capacity: 10,
                enrolledStudents: [],
                status: 'scheduled',
            },
        ]
        kvSeed['enrollments'] = [
            {
                id: 'enrollment-1',
                userId: 'employee-1',
                courseId: 'course-draft-enrolled',
                sessionId: 'session-employee-visible',
                progress: 40,
                status: 'in-progress',
                enrolledAt: '2024-01-04T00:00:00.000Z',
            },
        ]
        kvSeed['notifications'] = [
            {
                id: 'notification-employee',
                userId: 'employee-1',
                type: 'training',
                title: 'Employee Notification',
                message: 'Visible to employee',
                read: false,
                priority: 'medium',
                createdAt: '2024-01-05T00:00:00.000Z',
            },
            {
                id: 'notification-admin',
                userId: 'admin-1',
                type: 'system',
                title: 'Admin Notification',
                message: 'Should stay hidden',
                read: false,
                priority: 'high',
                createdAt: '2024-01-06T00:00:00.000Z',
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        await user.click(screen.getByRole('button', { name: /switch to employee one/i }))
        expect(screen.getByText(/current user:\s*employee one/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go courses$/i }))
        expect(screen.getByText(/courses count:\s*2/i)).toBeInTheDocument()
        expect(screen.getByText(/course-published\|published course/i)).toBeInTheDocument()
        expect(screen.getByText(/course-draft-enrolled\|draft enrolled course/i)).toBeInTheDocument()
        expect(screen.queryByText(/course-hidden\|hidden draft course/i)).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/session count:\s*1/i)).toBeInTheDocument()
        expect(screen.getByText(/session-employee-visible\|employee visible session/i)).toBeInTheDocument()
        expect(screen.queryByText(/session-hidden\|hidden session/i)).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go notifications$/i }))
        expect(screen.getByText(/notifications total:\s*1/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        expect(toastError).toHaveBeenCalledWith(
            'Access restricted',
            expect.objectContaining({ description: expect.stringMatching(/not available for the active role/i) })
        )
        expect(screen.getByText(/notifications view/i)).toBeInTheDocument()
    })

    it('excludes trainer enrollments when both course and session visibility checks fail', async () => {
        const user = userEvent.setup()

        kvSeed['courses'] = [
            {
                id: 'course-trainer-visible',
                title: 'Trainer Visible Course',
                description: 'Created by trainer',
                duration: 60,
                passScore: 80,
                modules: [],
                certifications: [],
                createdBy: 'trainer-1',
                createdAt: '2024-01-01T00:00:00.000Z',
                published: false,
            },
            {
                id: 'course-hidden',
                title: 'Hidden Course',
                description: 'Not visible to trainer',
                duration: 60,
                passScore: 80,
                modules: [],
                certifications: [],
                createdBy: 'admin-1',
                createdAt: '2024-01-01T00:00:00.000Z',
                published: false,
            },
        ]
        kvSeed['enrollments'] = [
            {
                id: 'enrollment-visible-by-course',
                userId: 'employee-1',
                courseId: 'course-trainer-visible',
                progress: 25,
                status: 'in-progress',
                enrolledAt: '2024-01-02T00:00:00.000Z',
            },
            {
                id: 'enrollment-hidden-no-session',
                userId: 'employee-2',
                courseId: 'course-hidden',
                progress: 10,
                status: 'in-progress',
                enrolledAt: '2024-01-03T00:00:00.000Z',
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /switch to trainer/i }))
        expect(screen.getByText(/current user:\s*trainer one/i)).toBeInTheDocument()
        expect(screen.getByText(/dashboard enrollments:\s*1/i)).toBeInTheDocument()
        expect(screen.getByText(/enrollment:\s*enrollment-visible-by-course/i)).toBeInTheDocument()
        expect(screen.queryByText(/enrollment:\s*enrollment-hidden-no-session/i)).not.toBeInTheDocument()
    })

    it('does not load preview seed data when overwrite is cancelled', async () => {
        const user = userEvent.setup()
        vi.stubGlobal('confirm', vi.fn(() => false))

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        await user.click(screen.getByRole('button', { name: /load seed data/i }))

        expect(globalThis.confirm).toHaveBeenCalled()
        expect(createPreviewSeedDataMock).not.toHaveBeenCalled()
    })

    it('loads preview seed data without overwrite confirmation when no core data exists', async () => {
        const user = userEvent.setup()
        const confirmSpy = vi.fn(() => true)
        vi.stubGlobal('confirm', confirmSpy)
        kvSeed['users'] = []
        kvSeed['sessions'] = []
        kvSeed['courses'] = []
        kvSeed['enrollments'] = []

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        await user.click(screen.getByRole('button', { name: /load seed data/i }))

        expect(confirmSpy).not.toHaveBeenCalled()
        expect(createPreviewSeedDataMock).toHaveBeenCalledOnce()
    })

    it('does not reset preview data when confirmation is cancelled', async () => {
        const user = userEvent.setup()
        vi.stubGlobal('confirm', vi.fn(() => false))

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        await user.click(screen.getByRole('button', { name: /reset preview data/i }))

        expect(globalThis.confirm).toHaveBeenCalled()
        expect(toastSuccess).not.toHaveBeenCalledWith(
            'Preview data reset complete',
            expect.objectContaining({ description: expect.stringMatching(/cleared/i) })
        )
    })

    it('auto-seeds preview data in empty mode when enabled', async () => {
        getPreviewSeedModeMock.mockReturnValue('empty')
        isPreviewSeedEnabledMock.mockReturnValue(true)
        kvSeed['users'] = []
        kvSeed['sessions'] = []
        kvSeed['courses'] = []
        kvSeed['enrollments'] = []
        kvSeed['preview-seed-version'] = ''

        render(<App />)

        await waitFor(() => {
            expect(createPreviewSeedDataMock).toHaveBeenCalled()
            expect(toastSuccess).toHaveBeenCalledWith(
                'Preview test data loaded',
                expect.objectContaining({ description: expect.stringMatching(/seeded/i) })
            )
        })
    })

    it('skips auto-seeding in full mode when core data already exists', async () => {
        getPreviewSeedModeMock.mockReturnValue('full')
        isPreviewSeedEnabledMock.mockReturnValue(true)
        kvSeed['preview-seed-version'] = ''

        render(<App />)

        await waitFor(() => {
            expect(createPreviewSeedDataMock).not.toHaveBeenCalled()
        })
    })

    it('skips auto-seeding when current mode is already seeded', async () => {
        getPreviewSeedModeMock.mockReturnValue('empty')
        isPreviewSeedEnabledMock.mockReturnValue(true)
        kvSeed['users'] = []
        kvSeed['sessions'] = []
        kvSeed['courses'] = []
        kvSeed['enrollments'] = []
        kvSeed['preview-seed-version'] = 'preview-seed-v1:empty'

        render(<App />)

        await waitFor(() => {
            expect(createPreviewSeedDataMock).not.toHaveBeenCalled()
        })
    })

    it('calls auto-seed path with off mode and exits before creating preview seed data', () => {
        getPreviewSeedModeMock.mockReturnValue('off')
        isPreviewSeedEnabledMock.mockReturnValue(true)
        kvSeed['preview-seed-version'] = ''

        render(<App />)

        // applyPreviewSeedData runs with mode "off" and returns early.
        expect(createPreviewSeedDataMock).not.toHaveBeenCalled()
        expect(toastSuccess).not.toHaveBeenCalledWith(
            'Preview test data loaded',
            expect.anything()
        )
    })

    it('initializes missing trainer profiles during startup', () => {
        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
            {
                id: 'trainer-missing-profile',
                name: 'Trainer Missing Profile',
                email: 'trainer-missing@example.com',
                role: 'trainer',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
        ]

        render(<App />)

        expect(ensureProfilesMock).toHaveBeenCalled()
    })

    it('handles notification actions when multiple notifications exist', async () => {
        const user = userEvent.setup()
        utilizationNotified = true
        kvSeed['notifications'] = [
            {
                id: 'notif-1',
                userId: 'trainer-1',
                type: 'system',
                title: 'One',
                message: 'First',
                read: false,
                priority: 'medium',
                createdAt: '2026-03-16T00:00:00.000Z',
            },
            {
                id: 'notif-2',
                userId: 'trainer-1',
                type: 'system',
                title: 'Two',
                message: 'Second',
                read: true,
                priority: 'low',
                createdAt: '2026-03-16T00:01:00.000Z',
            },
        ]

        const { unmount } = render(<App />)

        await user.click(screen.getByRole('button', { name: /^go notifications$/i }))
        expect(screen.getByText(/notifications total:\s*2/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /mark read/i }))
        await user.click(screen.getByRole('button', { name: /mark unread/i }))
        await user.click(screen.getByRole('button', { name: /mark all read/i }))
        expect(screen.getByText(/notifications unread:\s*0/i)).toBeInTheDocument()

        // Dismiss one while there are two notifications to cover both filter outcomes.
        await user.click(screen.getByRole('button', { name: /dismiss one/i }))
        expect(screen.getByText(/notifications total:\s*1/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /dismiss read/i }))
        expect(screen.getByText(/notifications total:\s*0/i)).toBeInTheDocument()
        unmount()

        // Re-render the view state from scratch to hit the non-read filter branch too.
        kvSeed['notifications'] = [
            {
                id: 'notif-3',
                userId: 'trainer-1',
                type: 'system',
                title: 'Three',
                message: 'Third',
                read: false,
                priority: 'low',
                createdAt: '2026-03-16T00:02:00.000Z',
            },
        ]

        render(<App />)
        await user.click(screen.getByRole('button', { name: /^go notifications$/i }))
        await user.click(screen.getByRole('button', { name: /dismiss one/i }))
        await user.click(screen.getByRole('button', { name: /dismiss all/i }))

        expect(screen.getByText(/notifications total:\s*0/i)).toBeInTheDocument()
    })

    it('handles high-priority notifications with unknown link and keeps current view on click', async () => {
        utilizationNotificationPayload = createUtilizationNotificationPayload({
            title: 'High Alert',
            message: 'Action required',
            priority: 'high',
            link: '/unknown-route',
        })

        render(<App />)

        await waitFor(() => {
            expect(sendNotificationMock).toHaveBeenCalledWith(
                'High Alert',
                expect.objectContaining({ priority: 'high' })
            )
        })

        const sendCall = sendNotificationMock.mock.calls[0]
        const options = sendCall[1]
        act(() => {
            options.onClick()
        })

        expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()
        expect(toastError).toHaveBeenCalledWith(
            '⚠️ High Alert',
            expect.objectContaining({ duration: 8000 })
        )
    })

    it('ignores notification click when link normalizes to null', async () => {
        utilizationNotificationPayload = createUtilizationNotificationPayload({
            title: 'Root Link Alert',
            message: 'Root navigation should be ignored',
            priority: 'high',
            link: '/',
        })

        render(<App />)

        await waitFor(() => {
            expect(sendNotificationMock).toHaveBeenCalledWith(
                'Root Link Alert',
                expect.objectContaining({ priority: 'high' })
            )
        })

        const sendCall = sendNotificationMock.mock.calls[0]
        const options = sendCall[1]
        act(() => {
            options.onClick()
        })

        expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()
        expect(toastError).toHaveBeenCalledWith(
            '⚠️ Root Link Alert',
            expect.objectContaining({ duration: 8000 })
        )
    })

    it('ignores notification click when link is malformed and logs a warning', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
        utilizationNotificationPayload = createUtilizationNotificationPayload({
            title: 'Malformed Link Alert',
            message: 'Malformed percent-encoding should be silently ignored',
            priority: 'high',
            link: '/people/%ZZ',
        })

        render(<App />)

        await waitFor(() => {
            expect(sendNotificationMock).toHaveBeenCalledWith(
                'Malformed Link Alert',
                expect.objectContaining({ priority: 'high' })
            )
        })

        const sendCall = sendNotificationMock.mock.calls[0]
        const options = sendCall[1]
        act(() => {
            options.onClick()
        })

        expect(warnSpy).toHaveBeenCalledWith(
            '[sendPushNotification] Ignoring malformed notification link',
            expect.objectContaining({ link: '/people/%ZZ', error: expect.any(URIError) })
        )
        expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()

        warnSpy.mockRestore()
    })

    it('uses medium priority by default and omits click handler when notification link is missing', async () => {
        utilizationNotificationPayload = createUtilizationNotificationPayload({
            title: 'Heads Up',
            message: 'No explicit priority',
            priority: undefined,
            link: undefined,
        })

        render(<App />)

        await waitFor(() => {
            expect(sendNotificationMock).toHaveBeenCalledWith(
                'Heads Up',
                expect.objectContaining({ priority: 'medium', onClick: undefined })
            )
        })

        expect(toastError).not.toHaveBeenCalled()
    })

    it('handles undefined kv state by using fallback arrays in action handlers', async () => {
        const user = userEvent.setup()
        utilizationNotified = true
        kvSeed['users'] = undefined
        kvSeed['sessions'] = undefined
        kvSeed['courses'] = undefined
        kvSeed['enrollments'] = undefined
        kvSeed['attendance-records'] = undefined
        kvSeed['notifications'] = undefined

        render(<App />)

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
        expect(screen.getByText(/notification count:\s*0/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/session count:\s*0/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /update session/i }))
        await user.click(screen.getByRole('button', { name: /^delete session$/i }))
        await user.click(screen.getByRole('button', { name: /^mark present$/i }))
        await user.click(screen.getByRole('button', { name: /^go schedule templates$/i }))
        await user.click(screen.getByRole('button', { name: /create template sessions/i }))

        await user.click(screen.getByRole('button', { name: /^go courses$/i }))
        await user.click(screen.getByRole('button', { name: /create minimal course/i }))
        await user.click(screen.getByRole('button', { name: /^update course$/i }))
        await user.click(screen.getByRole('button', { name: /^delete course$/i }))

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        expect(screen.getByText(/users count:\s*0/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /update user/i }))
        await user.click(screen.getByRole('button', { name: /delete user/i }))

        await user.click(screen.getByRole('button', { name: /^go certifications$/i }))
        await user.click(screen.getByRole('button', { name: /add certification/i }))

        await user.click(screen.getByRole('button', { name: /^go notifications$/i }))
        expect(screen.getByText(/notifications total:\s*0/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /mark read/i }))
        await user.click(screen.getByRole('button', { name: /mark unread/i }))
        await user.click(screen.getByRole('button', { name: /mark all read/i }))
        await user.click(screen.getByRole('button', { name: /dismiss one/i }))
        await user.click(screen.getByRole('button', { name: /dismiss read/i }))
        await user.click(screen.getByRole('button', { name: /dismiss all/i }))
        expect(screen.getByText(/notifications total:\s*0/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        expect(screen.getByText(/users count:\s*0/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /^reset session$/i }))

        expect(screen.getByRole('button', { name: /^create first admin$/i })).toBeInTheDocument()
    })

    it('sets an empty active user id when deleting the currently active last user', async () => {
        const user = userEvent.setup()
        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
        ]
        kvSeed['active-user-id'] = 'admin-1'

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        await user.click(screen.getByRole('button', { name: /^delete active user$/i }))

        expect(screen.getByRole('button', { name: /^create first admin$/i })).toBeInTheDocument()
    })

    it('blocks notification deep-link navigation when the active role lacks access', async () => {
        const user = userEvent.setup()
        utilizationNotificationPayload = createUtilizationNotificationPayload({
            title: 'Restricted Destination',
            link: '/certifications',
            priority: 'high',
        })

        render(<App />)
        await user.click(screen.getByRole('button', { name: /^switch to trainer$/i }))

        const sendCall = sendNotificationMock.mock.calls[0]
        const options = sendCall?.[1]
        act(() => {
            options.onClick()
        })

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
    })

    it('ignores notification deep-link clicks when the active trainer cannot access the destination view', () => {
        kvSeed['active-user-id'] = 'trainer-1'
        utilizationNotificationPayload = createUtilizationNotificationPayload({
            title: 'Restricted Destination From Trainer Context',
            link: '/settings',
            priority: 'high',
        })

        render(<App />)

        const sendCall = sendNotificationMock.mock.calls.at(-1)
        const options = sendCall?.[1]
        act(() => {
            options.onClick()
        })

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
    })

    it('includes enrollments visible via session visibility even when course visibility is restricted', async () => {
        const user = userEvent.setup()
        kvSeed['users'] = [
            {
                id: 'trainer-1',
                name: 'Trainer One',
                email: 'trainer1@example.com',
                role: 'trainer',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
                trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [],
                    tenure: {
                        hireDate: '2024-01-01T00:00:00.000Z',
                        yearsOfService: 1,
                        monthsOfService: 12,
                    },
                    specializations: [],
                },
            },
        ]
        kvSeed['active-user-id'] = 'trainer-1'
        kvSeed['courses'] = [
            {
                id: 'course-hidden',
                title: 'Hidden Course',
                description: 'not published and not creator-owned',
                duration: 45,
                passScore: 80,
                modules: [],
                certifications: [],
                createdBy: 'admin-1',
                createdAt: '2024-01-01T00:00:00.000Z',
                published: false,
            },
        ]
        kvSeed['sessions'] = [
            {
                id: 'session-visible',
                courseId: 'course-hidden',
                trainerId: 'trainer-1',
                title: 'Trainer-Owned Session',
                startTime: '2099-01-01T09:00:00.000Z',
                endTime: '2099-01-01T10:00:00.000Z',
                location: 'Room A',
                capacity: 10,
                enrolledStudents: ['trainer-1'],
                status: 'scheduled',
            },
        ]
        kvSeed['enrollments'] = [
            {
                id: 'enroll-visible-via-session',
                userId: 'trainer-1',
                courseId: 'course-hidden',
                sessionId: 'session-visible',
                status: 'in-progress',
                progress: 20,
                enrolledAt: '2024-01-01T00:00:00.000Z',
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go dashboard$/i }))
        expect(screen.getByText(/dashboard enrollments:\s*1/i)).toBeInTheDocument()
    })

    it('updates only the matched attendance record when multiple records exist', async () => {
        const user = userEvent.setup()
        kvSeed['attendance-records'] = [
            {
                id: 'attendance-1',
                sessionId: 'session-2',
                userId: 'trainer-1',
                status: 'absent',
                markedAt: '2024-01-01T00:00:00.000Z',
                markedBy: 'admin-1',
            },
            {
                id: 'attendance-2',
                sessionId: 'session-2',
                userId: 'someone-else',
                status: 'present',
                markedAt: '2024-01-01T00:00:00.000Z',
                markedBy: 'admin-1',
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        await user.click(screen.getByRole('button', { name: /^mark present$/i }))

        expect(screen.getByText(/attendance count:\s*2/i)).toBeInTheDocument()
        expect(screen.getByTestId('attendance-record-attendance-1')).toHaveTextContent('trainer-1: present')
        expect(screen.getByTestId('attendance-record-attendance-2')).toHaveTextContent('someone-else: present')
    })

    it('preserves existing attendance notes when status is updated without notes', async () => {
        const user = userEvent.setup()
        kvSeed['attendance-records'] = [
            {
                id: 'attendance-1',
                sessionId: 'session-2',
                userId: 'trainer-1',
                status: 'absent',
                notes: 'Arrived late due to traffic',
                markedAt: '2024-01-01T00:00:00.000Z',
                markedBy: 'admin-1',
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/attendance notes:\s*arrived late due to traffic/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^mark present$/i }))
        expect(screen.getByText(/attendance notes:\s*arrived late due to traffic/i)).toBeInTheDocument()
    })

    it('handles course update and delete when course/session/enrollment stores are undefined', async () => {
        const user = userEvent.setup()
        kvSeed['courses'] = undefined
        kvSeed['sessions'] = undefined
        kvSeed['enrollments'] = undefined

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go courses$/i }))
        await user.click(screen.getByRole('button', { name: /^update course$/i }))
        await user.click(screen.getByRole('button', { name: /^delete course$/i }))

        expect(screen.getByText(/courses count:\s*0/i)).toBeInTheDocument()
    })

    it('handles deleting a session when sessions store is undefined', async () => {
        const user = userEvent.setup()
        kvSeed['sessions'] = undefined

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        await user.click(screen.getByRole('button', { name: /^delete session$/i }))

        expect(screen.getByText(/session count:\s*0/i)).toBeInTheDocument()
    })

    it('assigns default preview passwords when preview mode is enabled and auth map is empty', async () => {
        const user = userEvent.setup()
        getPreviewSeedModeMock.mockReturnValue('empty')
        isPreviewSeedEnabledMock.mockReturnValue(true)
        kvSeed['auth-passwords'] = undefined

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        await user.click(screen.getByRole('button', { name: /^sign out$/i }))

        await user.type(screen.getByLabelText(/email/i), 'trainer1@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))

        expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()
    })

    it('creates a notification when notification state is initially undefined', async () => {
        kvSeed['notifications'] = undefined

        render(<App />)

        await waitFor(() => {
            expect(sendNotificationMock).toHaveBeenCalledWith(
                'Critical Alert',
                expect.objectContaining({ priority: 'critical' })
            )
        })

        await waitFor(() => {
            expect(screen.getByText(/notification count:\s*1/i)).toBeInTheDocument()
        })
    })

    it('creates a minimal session with fallback defaults when sessions are undefined', async () => {
        const user = userEvent.setup()
        utilizationNotified = true
        kvSeed['sessions'] = undefined

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/session count:\s*0/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /create minimal session/i }))

        expect(screen.getByText(/session count:\s*1/i)).toBeInTheDocument()
        expect(screen.getByText(/untitled session \(scheduled\)/i)).toBeInTheDocument()
    })

    it('creates minimal template sessions with fallback defaults when sessions are undefined', async () => {
        const user = userEvent.setup()
        utilizationNotified = true
        kvSeed['sessions'] = undefined

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go schedule templates$/i }))
        await user.click(screen.getByRole('button', { name: /create minimal template sessions/i }))
        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))

        expect(screen.getByText(/session count:\s*1/i)).toBeInTheDocument()
        expect(screen.getByText(/untitled session \(scheduled\)/i)).toBeInTheDocument()
    })

    it('handles deleting users when users and sessions are undefined', async () => {
        const user = userEvent.setup()
        utilizationNotified = true
        kvSeed['users'] = undefined
        kvSeed['sessions'] = undefined

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        expect(screen.getByText(/users count:\s*0/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /delete user/i }))

        expect(screen.getByText(/users count:\s*0/i)).toBeInTheDocument()
    })

    it('uses the fallback empty users array when adding a user from undefined state', async () => {
        const user = userEvent.setup()
        utilizationNotified = true
        kvSeed['users'] = undefined

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        expect(screen.getByText(/users count:\s*0/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /add user/i }))

        expect(callbackSpies.onAddUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Added User' }))
        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
    })

    it('uses the fallback empty users array when adding certifications from undefined state', async () => {
        const user = userEvent.setup()
        utilizationNotified = true
        kvSeed['users'] = undefined

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go certifications$/i }))
        expect(screen.getByText(/certification records:\s*0/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /add certification/i }))

        expect(screen.getByText(/certification records:\s*0/i)).toBeInTheDocument()
    })

    it('uses fallback notification arrays for individual actions when notifications are undefined', async () => {
        const user = userEvent.setup()
        utilizationNotified = true

        // Each iteration mounts/unmounts a fresh component instance to isolate actions:
        // renderWithUndefinedNotifications resets kvSeed['notifications'] to undefined before render,
        // ensuring each action test starts with clean state and preventing kvSeed changes from leaking between steps.
        const renderWithUndefinedNotifications = () => {
            kvSeed['notifications'] = undefined
            return render(<App />)
        }

        let view = renderWithUndefinedNotifications()
        await user.click(screen.getByRole('button', { name: /^go notifications$/i }))
        await user.click(screen.getByRole('button', { name: /mark unread/i }))
        expect(screen.getByText(/notifications total:\s*0/i)).toBeInTheDocument()
        view.unmount()

        view = renderWithUndefinedNotifications()
        await user.click(screen.getByRole('button', { name: /^go notifications$/i }))
        await user.click(screen.getByRole('button', { name: /mark all read/i }))
        expect(screen.getByText(/notifications total:\s*0/i)).toBeInTheDocument()
        view.unmount()

        view = renderWithUndefinedNotifications()
        await user.click(screen.getByRole('button', { name: /^go notifications$/i }))
        await user.click(screen.getByRole('button', { name: /dismiss one/i }))
        expect(screen.getByText(/notifications total:\s*0/i)).toBeInTheDocument()
        view.unmount()

        view = renderWithUndefinedNotifications()
        await user.click(screen.getByRole('button', { name: /^go notifications$/i }))
        await user.click(screen.getByRole('button', { name: /dismiss read/i }))
        expect(screen.getByText(/notifications total:\s*0/i)).toBeInTheDocument()
        view.unmount()
    })

    it('removes reminder-* localStorage keys when resetting preview data', async () => {
        const user = userEvent.setup()
        localStorage.setItem('reminder-schedule-1-2099-01-01T09:00:00.000Z', 'true')
        localStorage.setItem('unrelated-key', 'keep')
        kvSeed['auth-passwords'] = { 'admin-1': 'stale-password' }

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        await user.click(screen.getByRole('button', { name: /reset preview data/i }))

        expect(localStorage.getItem('reminder-schedule-1-2099-01-01T09:00:00.000Z')).toBeNull()
        expect(localStorage.getItem('unrelated-key')).toBe('keep')
        expect(kvState['auth-passwords']).toEqual({})
    })

    it('shows sign-in errors for missing credentials, unknown users, and wrong passwords', async () => {
        const user = userEvent.setup()
        kvSeed['active-user-id'] = ''

        render(<App />)
        toastError.mockClear()

        await user.click(screen.getByRole('button', { name: /^sign in$/i }))
        expect(screen.getByText('Email is required')).toBeInTheDocument()
        expect(screen.getByText('Password is required')).toBeInTheDocument()

        await user.type(screen.getByLabelText(/email/i), 'nobody@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))
        expect(toastError).toHaveBeenCalledWith(
            'Sign-in failed',
            expect.objectContaining({ description: 'No account matches that email address.' }),
        )

        await user.clear(screen.getByLabelText(/email/i))
        await user.clear(screen.getByLabelText(/password/i))
        await user.type(screen.getByLabelText(/email/i), 'admin@example.com')
        await user.type(screen.getByLabelText(/password/i), 'wrong-password')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))
        expect(toastError).toHaveBeenCalledWith(
            'Sign-in failed',
            expect.objectContaining({ description: 'Incorrect password.' }),
        )
    })

    it('shows an incorrect-password error when a local account has no stored password', async () => {
        const user = userEvent.setup()
        kvSeed['active-user-id'] = ''
        kvSeed['auth-passwords'] = {}
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })

        render(<App />)
        toastError.mockClear()

        await user.type(screen.getByLabelText(/email/i), 'admin@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Sign-in failed',
            expect.objectContaining({ description: 'Incorrect password.' }),
        )
    })

    it('shows the first-admin setup form when there are no users and creates an admin account', async () => {
        const user = userEvent.setup()
        kvSeed['users'] = []
        kvSeed['active-user-id'] = ''

        render(<App />)

        expect(screen.getByRole('button', { name: /^create first admin$/i })).toBeInTheDocument()

        await user.type(screen.getByLabelText(/^name$/i), 'First Admin')
        await user.type(screen.getByLabelText(/^email$/i), 'first@example.com')
        await user.type(screen.getByLabelText(/^password$/i), 'securepass123')

        await user.click(screen.getByRole('button', { name: /^create first admin$/i }))

        expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()
        expect(toastSuccess).toHaveBeenCalledWith(
            'First admin created',
            expect.objectContaining({ description: expect.stringContaining('First Admin') }),
        )
    })

    it('shows a setup-incomplete error when creating the first admin with empty fields', async () => {
        const user = userEvent.setup()
        kvSeed['users'] = []
        kvSeed['active-user-id'] = ''

        render(<App />)
        toastError.mockClear()

        await user.click(screen.getByRole('button', { name: /^create first admin$/i }))
        expect(screen.getByText('Name is required')).toBeInTheDocument()
        expect(screen.getByText('Email is required')).toBeInTheDocument()
        expect(screen.getByText('Password is required')).toBeInTheDocument()
    })

    it('shows setup-required messaging and enters demo mode from non-preview runtime', async () => {
        const user = userEvent.setup()
        kvSeed['users'] = []
        kvSeed['active-user-id'] = ''
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })

        const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
        window.history.replaceState({}, '', `${window.location.pathname}?demoMode=true${window.location.hash}`)

        try {
            render(<App />)

            expect(screen.getByText(/setup required/i)).toBeInTheDocument()
            expect(screen.getByText(/no users have been created in this workspace yet/i)).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: /^create first admin$/i })).toBeNull()

            await user.click(screen.getByRole('button', { name: /^enter demo mode$/i }))

            expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()
            expect(kvState['active-user-id']).toBe('')
            expect(window.confirm).toHaveBeenCalledWith(
                'This will overwrite existing local data in preview storage. Continue?'
            )
            expect(createPreviewSeedDataMock).toHaveBeenCalledTimes(1)
            expect(sessionStorage.getItem('orchestrate-demo-mode-active')).toBe('true')
            expect(localStorage.getItem('orchestrate-demo-mode-seeded')).toBe('true')
        } finally {
            window.history.replaceState({}, '', originalUrl)
        }
    })

    it('does not enter demo mode when overwrite confirmation is cancelled', async () => {
        const user = userEvent.setup()
        kvSeed['users'] = []
        kvSeed['active-user-id'] = ''
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })

        vi.stubGlobal('confirm', vi.fn(() => false))

        const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
        window.history.replaceState({}, '', `${window.location.pathname}?demoMode=true${window.location.hash}`)

        try {
            render(<App />)

            await user.click(screen.getByRole('button', { name: /^enter demo mode$/i }))

            expect(createPreviewSeedDataMock).not.toHaveBeenCalled()
            expect(screen.getByText(/setup required/i)).toBeInTheDocument()
            expect(sessionStorage.getItem('orchestrate-demo-mode-active')).toBeNull()
        } finally {
            window.history.replaceState({}, '', originalUrl)
        }
    })

    it('restores demo mode from session storage on a same-tab reload', async () => {
        kvSeed['active-user-id'] = ''
        kvSeed['preview-seed-version'] = 'preview-seed-v1:manual'
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })
        sessionStorage.setItem('orchestrate-demo-mode-active', 'true')
        sessionStorage.setItem('orchestrate-demo-mode-user-id', 'trainer-1')
        localStorage.setItem('orchestrate-demo-mode-seeded', 'true')

        render(<App />)

        expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()
        expect(screen.getByText(/current user:\s*trainer one/i)).toBeInTheDocument()
        expect(kvState['active-user-id']).toBe('')
    })

    it('does not clear stale demo seed data in tabs that did not seed demo mode', async () => {
        kvSeed['active-user-id'] = ''
        kvSeed['preview-seed-version'] = 'preview-seed-v1:manual'
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })
        localStorage.setItem('orchestrate-demo-mode-seeded', 'true')
        localStorage.setItem(
            'orchestrate-demo-seed-lease',
            JSON.stringify({
                expiresAtMs: Date.now() + 60_000,
                demoModeEnabled: true,
                demoSessionUserId: 'admin-1',
            }),
        )

        render(<App />)

        expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()

        expect(kvState['users']).toEqual(kvSeed['users'])
        expect(kvState['auth-passwords']).toEqual(kvSeed['auth-passwords'])
        expect(kvState['preview-seed-version']).toBe('preview-seed-v1:manual')
        expect(localStorage.getItem('orchestrate-demo-mode-seeded')).toBe('true')
    })

    it('clears stale demo seed data when the lease expires after tab close', async () => {
        kvSeed['active-user-id'] = ''
        kvSeed['preview-seed-version'] = 'preview-seed-v1:manual'
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })
        localStorage.setItem('orchestrate-demo-mode-seeded', 'true')
        localStorage.setItem(
            'orchestrate-demo-seed-lease',
            JSON.stringify({
                expiresAtMs: Date.now() - 60_000,
                demoModeEnabled: true,
                demoSessionUserId: 'admin-1',
            }),
        )

        render(<App />)

        expect(await screen.findByText(/setup required/i)).toBeInTheDocument()

        await waitFor(() => {
            expect(kvState['users']).toEqual([])
            expect(kvState['auth-passwords']).toEqual({})
            expect(kvState['preview-seed-version']).toBe('')
        })

        expect(localStorage.getItem('orchestrate-demo-mode-seeded')).toBeNull()
        expect(localStorage.getItem('orchestrate-demo-seed-lease')).toBeNull()
    })

    it('clears stale demo seed data in the tab that seeded demo mode', async () => {
        kvSeed['active-user-id'] = ''
        kvSeed['preview-seed-version'] = 'preview-seed-v1:manual'
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })
        localStorage.setItem('orchestrate-demo-mode-seeded', 'true')
        localStorage.setItem(
            'orchestrate-demo-seed-lease',
            JSON.stringify({
                expiresAtMs: Date.now() - 60_000,
                demoModeEnabled: true,
                demoSessionUserId: 'admin-1',
            }),
        )
        sessionStorage.setItem('orchestrate-demo-seeded-in-tab', 'true')

        render(<App />)

        expect(await screen.findByText(/setup required/i)).toBeInTheDocument()

        await waitFor(() => {
            expect(kvState['users']).toEqual([])
            expect(kvState['auth-passwords']).toEqual({})
            expect(kvState['preview-seed-version']).toBe('')
        })

        expect(localStorage.getItem('orchestrate-demo-mode-seeded')).toBeNull()
        expect(localStorage.getItem('orchestrate-demo-seed-lease')).toBeNull()
    })

    it('renews the demo lease while demo mode remains active', async () => {
        const user = userEvent.setup()

        kvSeed['users'] = []
        kvSeed['active-user-id'] = ''
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })

        const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
        window.history.replaceState({}, '', `${window.location.pathname}?demoMode=true${window.location.hash}`)

        try {
            render(<App />)

            await user.click(screen.getByRole('button', { name: /^enter demo mode$/i }))
            await screen.findByText(/dashboard view/i)

            const initialLease = JSON.parse(localStorage.getItem('orchestrate-demo-seed-lease') || '{}')
            expect(initialLease).toMatchObject({
                demoModeEnabled: true,
                demoSessionUserId: 'admin-1',
            })

            const initialExpiresAtMs = Number(initialLease.expiresAtMs)

            await new Promise((resolve) => setTimeout(resolve, 1))
            window.dispatchEvent(new Event('focus'))

            await waitFor(() => {
                const renewedLease = JSON.parse(localStorage.getItem('orchestrate-demo-seed-lease') || '{}')
                expect(Number(renewedLease.expiresAtMs)).toBeGreaterThan(initialExpiresAtMs)
            })
        } finally {
            window.history.replaceState({}, '', originalUrl)
        }
    })

    it('keeps transient demo session state when auto-seeding runs in demo mode', async () => {
        kvSeed['active-user-id'] = ''
        kvSeed['preview-seed-version'] = ''
        kvSeed['users'] = []
        kvSeed['auth-passwords'] = {}
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })
        getPreviewSeedModeMock.mockReturnValue('empty')
        isPreviewSeedEnabledMock.mockReturnValue(true)
        sessionStorage.setItem('orchestrate-demo-mode-active', 'true')

        render(<App />)

        expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()
        expect(kvState['active-user-id']).toBe('')
        expect(sessionStorage.getItem('orchestrate-demo-mode-active')).toBe('true')
        expect(sessionStorage.getItem('orchestrate-demo-mode-user-id')).toBe('admin-1')
    })

    it('does not create a first admin through the test hook when users already exist', async () => {
        const hooks = installAppTestHooks()

        render(<App />)

        await waitFor(() => {
            expect(hooks.createFirstAdmin).toBeTypeOf('function')
        })

        act(() => {
            hooks.createFirstAdmin?.({
                name: 'Ignored Admin',
                email: 'ignored@example.com',
                password: 'password123',
            })
        })

        expect(kvState['users']).toHaveLength(2)
        expect(toastSuccess).not.toHaveBeenCalledWith(
            'First admin created',
            expect.anything(),
        )
    })

    it('shows setup unavailable when the first-admin hook is used outside preview mode', async () => {
        const hooks = installAppTestHooks()
        kvSeed['users'] = []
        kvSeed['active-user-id'] = ''
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })

        render(<App />)

        await waitFor(() => {
            expect(hooks.createFirstAdmin).toBeTypeOf('function')
        })

        act(() => {
            hooks.createFirstAdmin?.({
                name: 'Blocked Admin',
                email: 'blocked@example.com',
                password: 'password123',
            })
        })

        expect(toastError).toHaveBeenCalledWith(
            'Setup unavailable',
            expect.objectContaining({ description: 'Initial admin bootstrap in this client flow is preview-only.' }),
        )
    })

    it('shows setup incomplete when the first-admin hook is invoked with blank fields', async () => {
        const hooks = installAppTestHooks()
        kvSeed['users'] = []
        kvSeed['active-user-id'] = ''
        setAppRuntimeEnv({ previewMode: true, useServerAuth: false })

        render(<App />)

        await waitFor(() => {
            expect(hooks.createFirstAdmin).toBeTypeOf('function')
        })

        act(() => {
            hooks.createFirstAdmin?.({
                name: '   ',
                email: '   ',
                password: '',
            })
        })

        expect(toastError).toHaveBeenCalledWith(
            'Setup incomplete',
            expect.objectContaining({ description: 'Enter name, email, and password to create the first admin.' }),
        )
    })

    it('shows sign-in failed when the sign-in hook is invoked with blank credentials', async () => {
        const hooks = installAppTestHooks()
        kvSeed['active-user-id'] = ''

        render(<App />)

        await waitFor(() => {
            expect(hooks.handleSignIn).toBeTypeOf('function')
        })

        await act(async () => {
            await hooks.handleSignIn?.({
                email: '   ',
                password: '',
            })
        })

        expect(toastError).toHaveBeenCalledWith(
            'Sign-in failed',
            expect.objectContaining({ description: 'Enter an email and password to continue.' }),
        )
    })

    it('marks a notification as read through the test hook', async () => {
        const hooks = installAppTestHooks()
        kvSeed['notifications'] = [
            {
                id: 'hook-notification',
                userId: 'admin-1',
                type: 'system',
                title: 'Hook Notification',
                message: 'mark me as read',
                read: false,
                priority: 'medium',
            },
        ]

        render(<App />)

        await waitFor(() => {
            expect(hooks.handleMarkNotificationAsRead).toBeTypeOf('function')
        })

        await act(async () => {
            await hooks.handleMarkNotificationAsRead?.('hook-notification')
        })

        const notifications = kvState['notifications'] as Array<{ id: string; read: boolean }>
        expect(notifications.find((notification) => notification.id === 'hook-notification')?.read).toBe(true)
    })

    it('handles mark-as-read hook calls when notifications are undefined', async () => {
        const hooks = installAppTestHooks()
        kvSeed['notifications'] = undefined
        utilizationNotified = true

        render(<App />)

        await waitFor(() => {
            expect(hooks.handleMarkNotificationAsRead).toBeTypeOf('function')
        })

        await act(async () => {
            await hooks.handleMarkNotificationAsRead?.('missing-notification')
        })

        expect(kvState['notifications']).toEqual([])
    })

    it('ignores role assignment for a missing user through the test hook', async () => {
        const hooks = installAppTestHooks()

        render(<App />)

        await waitFor(() => {
            expect(hooks.handleAssignRole).toBeTypeOf('function')
        })

        await act(async () => {
            await hooks.handleAssignRole?.('missing-user', 'trainer')
        })

        expect(kvState['users']).toEqual(kvSeed['users'])
    })

    it('no-ops role assignment when the user disappears before state update applies', async () => {
        const hooks = installAppTestHooks()

        render(<App />)

        await waitFor(() => {
            expect(hooks.handleAssignRole).toBeTypeOf('function')
            expect(hooks.handleDeleteUser).toBeTypeOf('function')
        })

        await act(async () => {
            await hooks.handleDeleteUser?.('trainer-1')
            await hooks.handleAssignRole?.('trainer-1', 'employee')
        })

        const persistedUsers = kvState['users'] as Array<{ id: string }>
        expect(persistedUsers.find((user) => user.id === 'trainer-1')).toBeUndefined()
    })

    it('falls back to dashboard when deleting the active user from an inaccessible hooked view', async () => {
        const hooks = installAppTestHooks()
        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
            {
                id: 'trainer-1',
                name: 'Trainer One',
                email: 'trainer1@example.com',
                role: 'trainer',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
                trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [],
                    tenure: {
                        hireDate: '2024-01-01T00:00:00.000Z',
                        yearsOfService: 1,
                        monthsOfService: 12,
                    },
                    specializations: [],
                },
            },
        ]
        setAppRuntimeEnv({ initialActiveView: 'settings' })

        render(<App />)

        await waitFor(() => {
            expect(hooks.handleDeleteUser).toBeTypeOf('function')
        })

        await act(async () => {
            await hooks.handleDeleteUser?.('admin-1')
        })

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
        expect(screen.getByText(/current user:\s*trainer one/i)).toBeInTheDocument()
    })

    it('removes risk-history snapshots for a deleted trainer through the test hook', async () => {
        const hooks = installAppTestHooks()
        kvSeed['risk-history-snapshots'] = [
            { trainerId: 'trainer-1', timestamp: '2024-01-01T00:00:00.000Z', riskScore: 80 },
            { trainerId: 'admin-1', timestamp: '2024-01-02T00:00:00.000Z', riskScore: 20 },
        ]

        render(<App />)

        await waitFor(() => {
            expect(hooks.handleDeleteUser).toBeTypeOf('function')
        })

        await act(async () => {
            await hooks.handleDeleteUser?.('trainer-1')
        })

        expect(kvState['risk-history-snapshots']).toEqual([
            { trainerId: 'admin-1', timestamp: '2024-01-02T00:00:00.000Z', riskScore: 20 },
        ])
    })

    it('handles deleting a user when risk-history snapshots are undefined', async () => {
        const hooks = installAppTestHooks()
        kvSeed['risk-history-snapshots'] = undefined

        render(<App />)

        await waitFor(() => {
            expect(hooks.handleDeleteUser).toBeTypeOf('function')
        })

        await act(async () => {
            await hooks.handleDeleteUser?.('trainer-1')
        })

        expect(kvState['risk-history-snapshots']).toEqual([])
    })

    it('removes deleted creators and preferred trainers from schedule templates', async () => {
        const hooks = installAppTestHooks()
        kvSeed['schedule-templates'] = [
            {
                id: 'template-1',
                createdBy: 'trainer-1',
                sessions: [
                    {
                        id: 'template-session-1',
                        preferredTrainers: ['trainer-1', 'admin-1'],
                    },
                ],
            },
            {
                id: 'template-2',
                createdBy: 'admin-1',
                sessions: [
                    {
                        id: 'template-session-2',
                        preferredTrainers: ['trainer-1'],
                    },
                ],
            },
        ]

        render(<App />)

        await waitFor(() => {
            expect(hooks.handleDeleteUser).toBeTypeOf('function')
        })

        await act(async () => {
            await hooks.handleDeleteUser?.('trainer-1')
        })

        expect(kvState['schedule-templates']).toEqual([
            {
                id: 'template-2',
                createdBy: 'admin-1',
                sessions: [
                    {
                        id: 'template-session-2',
                        preferredTrainers: [],
                    },
                ],
            },
        ])
    })

    it('handles deleting a user when schedule templates are undefined', async () => {
        const hooks = installAppTestHooks()
        kvSeed['schedule-templates'] = undefined

        render(<App />)

        await waitFor(() => {
            expect(hooks.handleDeleteUser).toBeTypeOf('function')
        })

        await act(async () => {
            await hooks.handleDeleteUser?.('trainer-1')
        })

        expect(kvState['schedule-templates']).toEqual([])
    })

    it('shows a server-auth credential error when the server rejects sign-in', async () => {
        const user = userEvent.setup()
        kvSeed['active-user-id'] = ''
        setAppRuntimeEnv({ previewMode: false, useServerAuth: true })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

        render(<App />)

        await user.type(screen.getByLabelText(/email/i), 'admin@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Authentication failed',
            expect.objectContaining({ description: 'Verify your credentials and try again.' }),
        )
    })

    it('signs in through server auth when the response omits userId but the workspace user matches by email', async () => {
        const user = userEvent.setup()
        kvSeed['active-user-id'] = ''
        setAppRuntimeEnv({ previewMode: false, useServerAuth: true })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({}),
        }))

        render(<App />)

        await user.type(screen.getByLabelText(/email/i), 'admin@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))

        expect(await screen.findByText(/dashboard view/i)).toBeInTheDocument()
        expect(toastSuccess).toHaveBeenCalledWith(
            'Signed in',
            expect.objectContaining({ description: expect.stringContaining('Admin User') }),
        )
    })

    it('shows a server-auth workspace-user error when no matching account can be resolved', async () => {
        const user = userEvent.setup()
        kvSeed['active-user-id'] = ''
        setAppRuntimeEnv({ previewMode: false, useServerAuth: true })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ userId: 'missing-user' }),
        }))

        render(<App />)

        await user.type(screen.getByLabelText(/email/i), 'admin@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Sign-in failed',
            expect.objectContaining({ description: 'Authentication succeeded but no user account is available in this workspace.' }),
        )
    })

    it('shows a server-auth service error when the request throws', async () => {
        const user = userEvent.setup()
        kvSeed['active-user-id'] = ''
        setAppRuntimeEnv({ previewMode: false, useServerAuth: true })
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

        render(<App />)

        await user.type(screen.getByLabelText(/email/i), 'admin@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Authentication failed',
            expect.objectContaining({ description: 'Unable to reach the authentication service.' }),
        )
    })

    it('shows a server-auth workspace-user error when response parsing fails and no matching email exists', async () => {
        const user = userEvent.setup()
        kvSeed['active-user-id'] = ''
        setAppRuntimeEnv({ previewMode: false, useServerAuth: true })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockRejectedValue(new Error('invalid json')),
        }))

        render(<App />)

        await user.type(screen.getByLabelText(/email/i), 'nobody@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Sign-in failed',
            expect.objectContaining({ description: 'Authentication succeeded but no user account is available in this workspace.' }),
        )
    })

    it('renders the dashboard fallback when the initial active view is unknown', () => {
        setAppRuntimeEnv({ initialActiveView: 'unrecognized-view' })

        render(<App />)

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
        expect(screen.getByText(/active view:\s*unrecognized-view/i)).toBeInTheDocument()
    })

    it('falls back to dashboard when an invalid active user is restored into an inaccessible initial view', () => {
        kvSeed['users'] = [
            {
                id: 'trainer-1',
                name: 'Trainer One',
                email: 'trainer1@example.com',
                role: 'trainer',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
                trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [],
                    tenure: {
                        hireDate: '2024-01-01T00:00:00.000Z',
                        yearsOfService: 1,
                        monthsOfService: 12,
                    },
                    specializations: [],
                },
            },
        ]
        kvSeed['active-user-id'] = 'missing-user'
        setAppRuntimeEnv({ initialActiveView: 'settings' })

        render(<App />)

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
        expect(screen.getByText(/current user:\s*trainer one/i)).toBeInTheDocument()
    })

    it('restores the first available user without changing an already accessible view', () => {
        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
        ]
        kvSeed['active-user-id'] = 'missing-user'
        setAppRuntimeEnv({ initialActiveView: 'dashboard' })

        render(<App />)

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
        expect(screen.getByText(/active view:\s*dashboard/i)).toBeInTheDocument()
        expect(screen.getByText(/current user:\s*admin user/i)).toBeInTheDocument()
    })

    it('does not add a default preview password when adding a user outside preview mode', async () => {
        const user = userEvent.setup()
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        await user.click(screen.getByRole('button', { name: /add user/i }))

        expect(kvState['auth-passwords']).toEqual({
            'admin-1': 'password123',
            'trainer-1': 'password123',
        })
    })

    it('loads seed data with an empty user list and clears the active user id', async () => {
        const user = userEvent.setup()
        createPreviewSeedDataMock.mockReturnValueOnce({
            users: [],
            sessions: [],
            courses: [],
            enrollments: [],
            notifications: [],
            wellnessCheckIns: [],
            recoveryPlans: [],
            checkInSchedules: [],
            scheduleTemplates: [],
            riskHistorySnapshots: [],
            targetTrainerCoverage: 4,
        })

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        await user.click(screen.getByRole('button', { name: /load seed data/i }))

        expect(kvState['active-user-id']).toBe('')
    })

    it('demotes the active admin into an inaccessible role and returns to dashboard', async () => {
        const user = userEvent.setup()
        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
            {
                id: 'admin-2',
                name: 'Backup Admin',
                email: 'backup@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        const trainerButtons = screen.getAllByRole('button', { name: /^trainer$/i })
        await user.click(trainerButtons[0])

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
        const persistedUsers = kvState['users'] as Array<{ id: string; role: string; trainerProfile?: object }>
        expect(persistedUsers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'admin-1', role: 'trainer', trainerProfile: expect.any(Object) }),
            ]),
        )
    })

    it('deletes the active user when passwords are undefined and the replacement user can keep the current view', async () => {
        const user = userEvent.setup()
        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
            {
                id: 'admin-2',
                name: 'Backup Admin',
                email: 'backup@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
        ]
        kvSeed['auth-passwords'] = undefined
        setAppRuntimeEnv({ previewMode: false, useServerAuth: false })

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        await user.click(screen.getByRole('button', { name: /delete active user/i }))

        expect(screen.getByText(/people view/i)).toBeInTheDocument()
        expect(screen.getByText(/current user:\s*backup admin/i)).toBeInTheDocument()
        expect(kvState['auth-passwords']).toEqual({})
    })

    it('keeps user state unchanged when the same role is assigned again', async () => {
        const user = userEvent.setup()

        render(<App />)
        await user.click(screen.getByRole('button', { name: /^go settings$/i }))

        const adminButtons = screen.getAllByRole('button', { name: /^admin$/i })
        await user.click(adminButtons[0])

        const persistedUsers = kvState['users'] as Array<{ id: string; role: string }>
        expect(persistedUsers[0]).toEqual(expect.objectContaining({ id: 'admin-1', role: 'admin' }))
    })

    it('assigns a new role from the settings role assignment card', async () => {
        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))

        // trainer-1 (second user) is promoted to admin
        const adminButtons = screen.getAllByRole('button', { name: /^admin$/i })
        await user.click(adminButtons[1])

        expect(toastSuccess).toHaveBeenCalledWith(
            'Role updated',
            expect.objectContaining({ description: expect.stringMatching(/admin/i) }),
        )

        const persistedUsers = kvState['users'] as Array<{ id: string; role: string }>
        expect(persistedUsers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'trainer-1', role: 'admin' }),
            ])
        )
    })

    it('prevents removing the last admin via the settings role assignment card', async () => {
        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))

        // admin-1 (first user) is the only admin; changing to Employee should be blocked
        const employeeButtons = screen.getAllByRole('button', { name: /^employee$/i })
        await user.click(employeeButtons[0])

        expect(toastError).toHaveBeenCalledWith(
            'Cannot remove the last admin',
            expect.objectContaining({ description: expect.stringMatching(/another user as admin/i) }),
        )

        const persistedUsers = kvState['users'] as Array<{ id: string; role: string }>
        expect(persistedUsers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'admin-1', role: 'admin' }),
            ])
        )
    })

    it('warns when stale session and stale user updates are submitted', async () => {
        const user = userEvent.setup()
        kvSeed['sessions'] = [
            {
                id: 'session-1',
                courseId: 'course-1',
                trainerId: 'trainer-1',
                title: 'Stale Session',
                startTime: '2099-01-01T09:00:00.000Z',
                endTime: '2099-01-01T10:00:00.000Z',
                location: 'Room A',
                capacity: 10,
                enrolledStudents: [],
                status: 'scheduled',
                updatedAt: '2026-01-01T00:00:00.000Z',
            },
        ]
        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
            {
                id: 'trainer-1',
                name: 'Trainer One',
                email: 'trainer1@example.com',
                role: 'trainer',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [],
                    tenure: {
                        hireDate: '2024-01-01T00:00:00.000Z',
                        yearsOfService: 1,
                        monthsOfService: 12,
                    },
                    specializations: [],
                },
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        await user.click(screen.getByRole('button', { name: /apply stale session update/i }))

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        await user.click(screen.getByRole('button', { name: /apply stale user update/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Concurrent edit warning',
            expect.objectContaining({ description: expect.stringMatching(/session changed/i) }),
        )
        expect(toastError).toHaveBeenCalledWith(
            'Concurrent edit warning',
            expect.objectContaining({ description: expect.stringMatching(/profile changed/i) }),
        )
    })

    it('keeps warning on repeated stale user updates after the stored timestamp is refreshed', async () => {
        const user = userEvent.setup()
        kvSeed['users'] = [
            {
                id: 'admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
            {
                id: 'trainer-1',
                name: 'Trainer One',
                email: 'trainer1@example.com',
                role: 'trainer',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [],
                    tenure: {
                        hireDate: '2024-01-01T00:00:00.000Z',
                        yearsOfService: 1,
                        monthsOfService: 12,
                    },
                    specializations: [],
                },
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        toastError.mockClear()

        await user.click(screen.getByRole('button', { name: /apply stale user update/i }))
        await user.click(screen.getByRole('button', { name: /apply stale user update/i }))

        expect(
            toastError.mock.calls.filter(
                ([title, options]) =>
                    title === 'Concurrent edit warning' &&
                    typeof options === 'object' &&
                    options !== null &&
                    'description' in options &&
                    /profile changed/i.test(String(options.description)),
            ),
        ).toHaveLength(2)
    })

    it('deletes session-linked enrollments when a session is deleted', async () => {
        const user = userEvent.setup()
        kvSeed['enrollments'] = [
            {
                id: 'enroll-delete-session',
                userId: 'trainer-1',
                courseId: 'course-1',
                sessionId: 'session-1',
                status: 'in-progress',
                progress: 40,
                enrolledAt: '2024-01-01T00:00:00.000Z',
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go dashboard$/i }))
        expect(screen.getByText(/dashboard enrollments:\s*1/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        await user.click(screen.getByRole('button', { name: /^delete session$/i }))

        await user.click(screen.getByRole('button', { name: /^go dashboard$/i }))
        expect(screen.getByText(/dashboard enrollments:\s*0/i)).toBeInTheDocument()
    })

    it('deletes course-linked sessions and enrollments when a course is deleted', async () => {
        const user = userEvent.setup()
        kvSeed['courses'] = [
            {
                id: 'course-1',
                title: 'Delete Me Course',
                description: 'For delete-path testing',
                duration: 60,
                passScore: 80,
                modules: [],
                certifications: [],
                createdBy: 'admin-1',
                createdAt: '2024-01-01T00:00:00.000Z',
                published: true,
            },
        ]
        kvSeed['sessions'] = [
            {
                id: 'session-1',
                courseId: 'course-1',
                trainerId: 'trainer-1',
                title: 'Delete Session With Course',
                startTime: '2099-01-01T09:00:00.000Z',
                endTime: '2099-01-01T10:00:00.000Z',
                location: 'Room A',
                capacity: 10,
                enrolledStudents: [],
                status: 'scheduled',
            },
        ]
        kvSeed['enrollments'] = [
            {
                id: 'enroll-delete-course',
                userId: 'trainer-1',
                courseId: 'course-1',
                sessionId: 'session-1',
                status: 'in-progress',
                progress: 40,
                enrolledAt: '2024-01-01T00:00:00.000Z',
            },
        ]

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go courses$/i }))
        await user.click(screen.getByRole('button', { name: /^delete course$/i }))

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/session count:\s*0/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /^go dashboard$/i }))
        expect(screen.getByText(/dashboard enrollments:\s*0/i)).toBeInTheDocument()
    })

    it('uses untitled course fallback when creating an empty course payload', async () => {
        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go courses$/i }))
        await user.click(screen.getByRole('button', { name: /^create empty course$/i }))

        expect(screen.getByText(/untitled course/i)).toBeInTheDocument()
    })

    describe('handleRecordScore', () => {
        beforeEach(() => {
            kvSeed['courses'] = [
                {
                    id: 'course-rs',
                    title: 'Record Score Course',
                    description: 'For testing',
                    duration: 60,
                    passScore: RECORD_SCORE_PASS_THRESHOLD,
                    modules: [],
                    certifications: [],
                    createdBy: 'admin-1',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    published: true,
                },
            ]
            kvSeed['enrollments'] = [
                {
                    id: 'enrollment-rs-1',
                    userId: 'admin-1',
                    courseId: 'course-rs',
                    sessionId: 'session-1',
                    status: 'in-progress',
                    progress: 50,
                    enrolledAt: '2024-01-01T00:00:00.000Z',
                },
            ]
        })

        it('fires a completion notification when a passing score is submitted', async () => {
            const user = userEvent.setup()

            render(<App />)

            await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
            expect(screen.getByText(/notification count:\s*1/i)).toBeInTheDocument()

            await user.click(screen.getByRole('button', { name: /record score pass/i }))
            expect(screen.getByText(/notification count:\s*2/i)).toBeInTheDocument()
        })

        it('does not fire a notification when a failing score is submitted', async () => {
            const user = userEvent.setup()

            render(<App />)

            await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
            await user.click(screen.getByRole('button', { name: /record score fail/i }))
            expect(screen.getByText(/notification count:\s*1/i)).toBeInTheDocument()
        })

        it('is a no-op when the enrollment ID is not found', async () => {
            const user = userEvent.setup()

            render(<App />)

            await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
            await user.click(screen.getByRole('button', { name: /record score unknown/i }))
            expect(screen.getByText(/notification count:\s*1/i)).toBeInTheDocument()
        })

        it('does not send a duplicate notification when enrollment is already completed', async () => {
            kvSeed['enrollments'] = [
                {
                    id: 'enrollment-rs-1',
                    userId: 'admin-1',
                    courseId: 'course-rs',
                    sessionId: 'session-1',
                    status: 'completed',
                    progress: 100,
                    enrolledAt: '2024-01-01T00:00:00.000Z',
                },
            ]
            const user = userEvent.setup()

            render(<App />)

            await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
            await user.click(screen.getByRole('button', { name: /record score notify/i }))
            expect(screen.getByText(/notification count:\s*1/i)).toBeInTheDocument()
        })

        it('uses default pass score of 80 and does not fire notification when course is not found', async () => {
            // Override enrollments to have a courseId that has no matching course
            kvSeed['enrollments'] = [
                {
                    id: 'enrollment-rs-1',
                    userId: 'admin-1',
                    courseId: 'course-nonexistent',
                    sessionId: 'session-1',
                    status: 'in-progress',
                    progress: 50,
                    enrolledAt: '2024-01-01T00:00:00.000Z',
                },
            ]
            const user = userEvent.setup()

            render(<App />)

            await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
            // Score 90 >= default passScore 80, so notify=true, but course is undefined → no notification
            await user.click(screen.getByRole('button', { name: /record score pass/i }))
            expect(screen.getByText(/notification count:\s*1/i)).toBeInTheDocument()
        })

        it('uses fallback student label in completion message when the student record is missing', async () => {
            kvSeed['enrollments'] = [
                {
                    id: 'enrollment-rs-1',
                    userId: 'missing-user',
                    courseId: 'course-rs',
                    sessionId: 'session-1',
                    status: 'in-progress',
                    progress: 50,
                    enrolledAt: '2024-01-01T00:00:00.000Z',
                },
            ]
            const user = userEvent.setup()

            render(<App />)

            await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
            await user.click(screen.getByRole('button', { name: /record score pass/i }))

            expect(sendNotificationMock).toHaveBeenCalledWith(
                'Course Completed — Record Score Course',
                expect.objectContaining({ body: expect.stringContaining('A student completed') }),
            )
        })

        it('updates only the targeted enrollment when recording a score', async () => {
            kvSeed['enrollments'] = [
                {
                    id: 'enrollment-rs-1',
                    userId: 'admin-1',
                    courseId: 'course-rs',
                    sessionId: 'session-1',
                    status: 'in-progress',
                    progress: 50,
                    enrolledAt: '2024-01-01T00:00:00.000Z',
                },
                {
                    id: 'enrollment-rs-2',
                    userId: 'admin-1',
                    courseId: 'course-rs',
                    sessionId: 'session-2',
                    status: 'in-progress',
                    progress: 10,
                    enrolledAt: '2024-01-02T00:00:00.000Z',
                },
            ]
            const user = userEvent.setup()

            render(<App />)

            await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
            await user.click(screen.getByRole('button', { name: /record score pass/i }))
            await user.click(screen.getByRole('button', { name: /^go dashboard$/i }))

            const persistedEnrollments = kvState['enrollments'] as Array<{
                id: string
                status: string
                progress: number
                score?: number
            }>
            const updatedEnrollment = persistedEnrollments.find((enrollment) => enrollment.id === 'enrollment-rs-1')
            const untouchedEnrollment = persistedEnrollments.find((enrollment) => enrollment.id === 'enrollment-rs-2')

            expect(updatedEnrollment).toEqual(
                expect.objectContaining({
                    id: 'enrollment-rs-1',
                    status: 'completed',
                    progress: 100,
                    score: 90,
                }),
            )
            expect(untouchedEnrollment).toEqual(
                expect.objectContaining({
                    id: 'enrollment-rs-2',
                    status: 'in-progress',
                    progress: 10,
                }),
            )

            expect(screen.getByText(/dashboard enrollments:\s*2/i)).toBeInTheDocument()
            expect(screen.getByText(/enrollment: enrollment-rs-2/i)).toBeInTheDocument()
        })

        it('shows a toast when scoring throws a range error', async () => {
            const user = userEvent.setup()
            scoringControls.applyScoreImpl = () => {
                throw new RangeError('Score must remain within range.')
            }

            render(<App />)

            await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
            await user.click(screen.getByRole('button', { name: /record score pass/i }))

            expect(toastError).toHaveBeenCalledWith(
                'Unable to record score',
                expect.objectContaining({ description: 'Score must remain within range.' }),
            )
        })

        it('rethrows unexpected scoring errors', async () => {
            const user = userEvent.setup()
            const errorHandler = vi.fn((event: ErrorEvent) => {
                event.preventDefault()
            })
            scoringControls.applyScoreImpl = () => {
                throw new Error('unexpected scoring failure')
            }

            window.addEventListener('error', errorHandler)

            try {
                render(<App />)

                await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
                fireEvent.click(screen.getByRole('button', { name: /record score pass/i }))

                await waitFor(() => {
                    expect(errorHandler).toHaveBeenCalled()
                })
            } finally {
                window.removeEventListener('error', errorHandler)
            }
        })
    })
})
