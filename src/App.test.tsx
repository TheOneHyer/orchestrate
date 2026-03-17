import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const toastSuccess = vi.fn()
const toastError = vi.fn()

const sendNotificationMock = vi.fn()
let utilizationNotified = false
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
            const seeded = (kvSeed[key] as T | undefined) ?? initialValue
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
    Layout: ({ children, onNavigate, activeView, notificationCount }: { children: any; onNavigate: (view: string) => void; activeView: string; notificationCount: number }) => (
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
    Schedule: ({ onCreateSession, onUpdateSession }: { onCreateSession: (session: unknown) => void; onUpdateSession: (id: string, session: unknown) => void }) => (
        <div>
            <div>Schedule View</div>
            <button onClick={() => onCreateSession({ title: 'Created Session', trainerId: 'trainer-1', recurrence: { pattern: 'weekly' } })}>Create Session</button>
            <button onClick={() => onUpdateSession('session-1', { status: 'completed' })}>Update Session</button>
        </div>
    ),
}))

vi.mock('@/components/views/ScheduleTemplates', () => ({
    ScheduleTemplates: ({ onCreateSessions }: { onCreateSessions: (sessions: unknown[]) => void }) => (
        <div>
            <div>Schedule Templates View</div>
            <button onClick={() => onCreateSessions([{ title: 'Template Session', recurrence: { pattern: 'monthly' } }])}>Create Template Sessions</button>
        </div>
    ),
}))

vi.mock('@/components/views/Courses', () => ({ Courses: () => <div>Courses View</div> }))
vi.mock('@/components/views/People', () => ({
    People: ({ onAddUser, onUpdateUser, onDeleteUser }: { onAddUser: (user: unknown) => void; onUpdateUser: (user: unknown) => void; onDeleteUser: (userId: string) => void }) => (
        <div>
            <div>People View</div>
            <button onClick={() => onAddUser({ id: 'employee-2', role: 'employee', name: 'Added User', email: 'added@example.com', department: 'Ops', certifications: [], hireDate: '2024-01-01T00:00:00.000Z' })}>Add User</button>
            <button onClick={() => onUpdateUser({ id: 'trainer-1', role: 'trainer', name: 'Updated Trainer', email: 'trainer1@example.com', department: 'Ops', certifications: [], hireDate: '2024-01-01T00:00:00.000Z', trainerProfile: { authorizedRoles: [], shiftSchedules: [], tenure: { hireDate: '2024-01-01T00:00:00.000Z', yearsOfService: 1, monthsOfService: 12 }, specializations: [] } })}>Update User</button>
            <button onClick={() => onDeleteUser('trainer-1')}>Delete User</button>
        </div>
    ),
}))
vi.mock('@/components/views/Analytics', () => ({ Analytics: () => <div>Analytics View</div> }))
vi.mock('@/components/views/TrainerAvailability', () => ({ TrainerAvailability: () => <div>Trainer Availability View</div> }))
vi.mock('@/components/views/BurnoutDashboard', () => ({ BurnoutDashboard: () => <div>Burnout Dashboard View</div> }))
vi.mock('@/components/views/TrainerWellness', () => ({ TrainerWellness: () => <div>Trainer Wellness View</div> }))
vi.mock('@/components/views/CertificationDashboard', () => ({
    CertificationDashboard: ({ onAddCertification }: { onAddCertification: (trainerIds: string[], cert: unknown) => void }) => (
        <div>
            <div>Certification Dashboard View</div>
            <button onClick={() => onAddCertification(['trainer-1'], { certificationName: 'CPR', issuedDate: '2026-01-01', expirationDate: '2027-01-01' })}>Add Certification</button>
        </div>
    ),
}))
vi.mock('@/components/views/UserGuide', () => ({ UserGuide: () => <div>User Guide View</div> }))
vi.mock('@/components/views/Notifications', () => ({
    Notifications: ({
        onMarkAsRead,
        onMarkAsUnread,
        onMarkAllAsRead,
        onDismiss,
        onDismissAll,
    }: {
        onMarkAsRead: (id: string) => void
        onMarkAsUnread: (id: string) => void
        onMarkAllAsRead: () => void
        onDismiss: (id: string) => void
        onDismissAll: (filter?: 'all' | 'read') => void
    }) => (
        <div>
            <div>Notifications View</div>
            <button onClick={() => onMarkAsRead('notif-1')}>Mark Read</button>
            <button onClick={() => onMarkAsUnread('notif-1')}>Mark Unread</button>
            <button onClick={() => onMarkAllAsRead()}>Mark All Read</button>
            <button onClick={() => onDismiss('notif-1')}>Dismiss One</button>
            <button onClick={() => onDismissAll('read')}>Dismiss Read</button>
            <button onClick={() => onDismissAll('all')}>Dismiss All</button>
        </div>
    ),
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
                onCreateNotification({
                    userId: 'admin-1',
                    type: 'system',
                    title: 'Critical Alert',
                    message: 'High-risk condition detected',
                    read: false,
                    priority: 'critical',
                    link: '/trainer-wellness',
                })
            }, [onCreateNotification])
        },
    }
})

vi.mock('@/lib/trainer-profile-generator', () => ({
    ensureAllTrainersHaveProfiles: (users: unknown) => ensureProfilesMock(users),
}))

vi.mock('@/lib/preview-mode', () => ({
    getPreviewSeedMode: () => 'off',
    isPreviewSeedEnabled: () => false,
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

    it('runs callback actions exposed by child views', async () => {
        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: /^go schedule$/i }))
        await user.click(screen.getByRole('button', { name: /create session/i }))
        await user.click(screen.getByRole('button', { name: /update session/i }))

        await user.click(screen.getByRole('button', { name: /^go schedule templates$/i }))
        await user.click(screen.getByRole('button', { name: /create template sessions/i }))

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        await user.click(screen.getByRole('button', { name: /add user/i }))
        await user.click(screen.getByRole('button', { name: /update user/i }))

        await user.click(screen.getByRole('button', { name: /^go certifications$/i }))
        await user.click(screen.getByRole('button', { name: /add certification/i }))

        await user.click(screen.getByRole('button', { name: /^go people$/i }))
        await user.click(screen.getByRole('button', { name: /delete user/i }))

        await user.click(screen.getByRole('button', { name: /^go notifications$/i }))
        await user.click(screen.getByRole('button', { name: /mark read/i }))
        await user.click(screen.getByRole('button', { name: /mark unread/i }))
        await user.click(screen.getByRole('button', { name: /mark all read/i }))
        await user.click(screen.getByRole('button', { name: /dismiss one/i }))
        await user.click(screen.getByRole('button', { name: /dismiss read/i }))
        await user.click(screen.getByRole('button', { name: /dismiss all/i }))

        expect(screen.getByText(/notificationpermissionbanner mock/i)).toBeInTheDocument()
        expect(screen.getByText(/toaster mock/i)).toBeInTheDocument()
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
})
