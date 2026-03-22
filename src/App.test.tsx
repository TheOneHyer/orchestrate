import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const toastSuccess = vi.fn()
const toastError = vi.fn()

const sendNotificationMock = vi.fn()
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

            const setter = (next: T | ((current: T) => T)) => {
                setValue((current) => (typeof next === 'function' ? (next as (current: T) => T)(current) : next))
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
    Layout: ({ children, onNavigate, activeView, notificationCount }: { children: ReactNode; onNavigate: (view: string) => void; activeView: string; notificationCount: number }) => (
        <div>
            <div>Active View: {activeView}</div>
            <div>Notification Count: {notificationCount}</div>
            <button onClick={() => onNavigate('dashboard')}>Go Dashboard</button>
            <button onClick={() => onNavigate('schedule')}>Go Schedule</button>
            <button onClick={() => onNavigate('schedule-templates')}>Go Schedule Templates</button>
            <button onClick={() => onNavigate('courses')}>Go Courses</button>
            <button onClick={() => onNavigate('people')}>Go People</button>
            <button onClick={() => onNavigate('analytics')}>Go Analytics</button>
            <button onClick={() => onNavigate('trainer-availability')}>Go Trainer Availability</button>
            <button onClick={() => onNavigate('burnout-dashboard')}>Go Burnout</button>
            <button onClick={() => onNavigate('certifications')}>Go Certifications</button>
            <button onClick={() => onNavigate('trainer-wellness')}>Go Wellness</button>
            <button onClick={() => onNavigate('notifications')}>Go Notifications</button>
            <button onClick={() => onNavigate('user-guide')}>Go User Guide</button>
            <button onClick={() => onNavigate('settings')}>Go Settings</button>
            <button onClick={() => onNavigate('unknown-view')}>Go Unknown</button>
            <button onClick={() => onNavigate('/')}>Go Root Path</button>
            <button onClick={() => onNavigate('/people/%ZZ')}>Go Malformed Path</button>
            {children}
        </div>
    ),
}))

vi.mock('@/components/views/Dashboard', () => ({
    Dashboard: ({ onNavigate }: { onNavigate: (view: string) => void }) => (
        <div>
            <div>Dashboard View</div>
            <button onClick={() => onNavigate('schedule')}>Dashboard to Schedule</button>
        </div>
    ),
}))

vi.mock('@/components/views/Schedule', () => ({
    Schedule: ({
        sessions,
        onCreateSession,
        onUpdateSession,
    }: {
        sessions: Array<{ id: string; title: string; status: string }>
        onCreateSession: (session: unknown) => void
        onUpdateSession: (id: string, session: unknown) => void
    }) => (
        <div>
            <div>Schedule View</div>
            <div>Session Count: {sessions.length}</div>
            {sessions.map((session) => (
                <div key={session.id}>{session.title} ({session.status})</div>
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
        </div>
    ),
}))

vi.mock('@/components/views/Courses', () => ({
    Courses: ({
        courses,
        onCreateCourse,
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
        </div>
    ),
}))
vi.mock('@/components/views/People', () => ({
    People: ({
        users,
        onAddUser,
        onUpdateUser,
        onDeleteUser,
    }: {
        users: Array<{ id: string; name: string }>
        onAddUser: (user: unknown) => void
        onUpdateUser: (user: unknown) => void
        onDeleteUser: (userId: string) => void
    }) => (
        <div>
            <div>People View</div>
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
            <button onClick={() => {
                callbackSpies.onDeleteUser('trainer-1')
                onDeleteUser('trainer-1')
            }}>Delete User</button>
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

import App from './App'

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        utilizationNotified = false
        utilizationNotificationPayload = createUtilizationNotificationPayload()
        getPreviewSeedModeMock.mockReturnValue('off')
        isPreviewSeedEnabledMock.mockReturnValue(false)
        Object.keys(kvSeed).forEach((key) => delete kvSeed[key])
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
        vi.stubGlobal('confirm', vi.fn(() => true))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        localStorage.clear()
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

        await user.click(screen.getByRole('button', { name: /^go analytics$/i }))
        expect(screen.getByText(/analytics view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go trainer availability$/i }))
        expect(screen.getByText(/trainer availability view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go burnout$/i }))
        expect(screen.getByText(/burnout dashboard view/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go certifications$/i }))
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
        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
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
        const { unmount } = render(<App />)

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

        const { unmount } = render(<App />)

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

    it('runs callback actions exposed by child views', async () => {
        const user = userEvent.setup()

        render(<App />)

        await waitFor(() => {
            expect(screen.getByText(/notification count:\s*1/i)).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/session count:\s*2/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /create session/i }))
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

    it('does not load preview seed data when overwrite is cancelled', async () => {
        const user = userEvent.setup()
        vi.stubGlobal('confirm', vi.fn(() => false))

        const { unmount } = render(<App />)

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
        kvSeed['notifications'] = undefined

        render(<App />)

        expect(screen.getByText(/dashboard view/i)).toBeInTheDocument()
        expect(screen.getByText(/notification count:\s*0/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        expect(screen.getByText(/session count:\s*0/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /update session/i }))
        await user.click(screen.getByRole('button', { name: /create session/i }))

        await user.click(screen.getByRole('button', { name: /^go schedule templates$/i }))
        await user.click(screen.getByRole('button', { name: /create template sessions/i }))

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        expect(screen.getByText(/users count:\s*0/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /update user/i }))
        await user.click(screen.getByRole('button', { name: /add user/i }))
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

        expect(screen.getByText(/users count:\s*1/i)).toBeInTheDocument()
        expect(screen.getByText('Added User')).toBeInTheDocument()
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

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go settings$/i }))
        await user.click(screen.getByRole('button', { name: /reset preview data/i }))

        expect(localStorage.getItem('reminder-schedule-1-2099-01-01T09:00:00.000Z')).toBeNull()
        expect(localStorage.getItem('unrelated-key')).toBe('keep')
    })
})
