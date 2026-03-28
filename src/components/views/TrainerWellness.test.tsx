import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TrainerWellness } from './TrainerWellness'
import type { CheckInSchedule, RecoveryPlan, Session, User, WellnessCheckIn } from '@/lib/types'
import * as wellnessAnalytics from '@/lib/wellness-analytics'

const useKVMock = vi.fn()
const setCheckInsMock = vi.fn()
const setRecoveryPlansMock = vi.fn()
const setSchedulesMock = vi.fn()

const toastInfo = vi.fn()
const toastSuccess = vi.fn()
const toastWarning = vi.fn()
let triggerCheckInFromScheduler: ((trainerId: string, trainerName: string) => void) | null = null

let checkInsState: WellnessCheckIn[] = []
let recoveryPlansState: RecoveryPlan[] = []
let schedulesState: CheckInSchedule[] = []

type ArrayStateUpdater<T> = T[] | ((current: T[] | undefined) => T[])

function resolveArrayStateUpdate<T>(
    current: T[] | undefined,
    updater: ArrayStateUpdater<T>
): T[] {
    return typeof updater === 'function'
        ? updater(current)
        : updater
}

setCheckInsMock.mockImplementation((updater: ArrayStateUpdater<WellnessCheckIn>) => {
    checkInsState = resolveArrayStateUpdate(checkInsState, updater)
})

setRecoveryPlansMock.mockImplementation((updater: ArrayStateUpdater<RecoveryPlan>) => {
    recoveryPlansState = resolveArrayStateUpdate(recoveryPlansState, updater)
})

setSchedulesMock.mockImplementation((updater: ArrayStateUpdater<CheckInSchedule>) => {
    schedulesState = resolveArrayStateUpdate(schedulesState, updater)
})

vi.mock('@github/spark/hooks', () => ({
    useKV: (...args: unknown[]) => useKVMock(...args),
}))

vi.mock('@/hooks/use-check-in-scheduler', () => ({
    useCheckInScheduler: (...args: unknown[]) => {
        triggerCheckInFromScheduler = args[2] as ((trainerId: string, trainerName: string) => void) | null
        return {
            get schedules() {
                return schedulesState
            },
            setSchedules: setSchedulesMock,
        }
    },
}))

vi.mock('sonner', () => ({
    toast: {
        info: (...args: unknown[]) => toastInfo(...args),
        success: (...args: unknown[]) => toastSuccess(...args),
        warning: (...args: unknown[]) => toastWarning(...args),
    },
}))

vi.mock('@/components/WellnessCheckInDialog', () => ({
    WellnessCheckInDialog: ({ open, trainerId, trainerName, onSubmit, onClose }: { open: boolean; trainerId: string; trainerName?: string; onSubmit: (data: Omit<WellnessCheckIn, 'id' | 'timestamp'>) => void; onClose: () => void }) => {
        if (!open) return null
        return (
            <>
                <p>{`Mock Check-In Props: ${trainerId}|${trainerName || ''}`}</p>
                <button
                    onClick={() =>
                        onSubmit({
                            trainerId,
                            mood: 3,
                            stress: 'moderate',
                            energy: 'neutral',
                            workloadSatisfaction: 3,
                            sleepQuality: 3,
                            physicalWellbeing: 3,
                            mentalClarity: 3,
                            followUpRequired: false,
                        })
                    }
                >
                    Mock Submit Check-In
                </button>
                <button onClick={onClose}>Mock Close Check-In</button>
            </>
        )
    },
}))

vi.mock('@/components/RecoveryPlanDialog', () => ({
    RecoveryPlanDialog: ({ open, trainerId, currentUser, onSubmit, onClose }: { open: boolean; trainerId: string; currentUser: User; onSubmit: (plan: Omit<RecoveryPlan, 'id' | 'createdAt'>) => void; onClose: () => void }) => {
        if (!open) return null
        return (
            <>
                <button
                    onClick={() =>
                        onSubmit({
                            trainerId,
                            createdBy: currentUser.id,
                            status: 'active',
                            triggerReason: 'High stress trend',
                            targetUtilization: 60,
                            currentUtilization: 85,
                            startDate: '2026-03-16T00:00:00.000Z',
                            targetCompletionDate: '2026-04-16T00:00:00.000Z',
                            actions: [],
                            checkIns: [],
                        })
                    }
                >
                    Mock Submit Recovery Plan
                </button>
                <button onClick={onClose}>Mock Close Recovery Plan</button>
            </>
        )
    },
}))

vi.mock('@/components/CheckInScheduleDialog', () => ({
    CheckInScheduleDialog: ({ open, trainers, currentUserId, existingSchedule, onSubmit, onClose }: { open: boolean; trainers: User[]; currentUserId: string; existingSchedule?: CheckInSchedule; onSubmit: (data: Omit<CheckInSchedule, 'id' | 'createdAt' | 'completedCheckIns' | 'missedCheckIns'>) => void; onClose: () => void }) => {
        if (!open) return null
        return (
            <>
                <button
                    onClick={() =>
                        onSubmit({
                            trainerId: existingSchedule?.trainerId || trainers[0]?.id,
                            frequency: 'weekly',
                            startDate: '2026-03-16T00:00:00.000Z',
                            nextScheduledDate: '2026-03-20T00:00:00.000Z',
                            status: 'active',
                            notificationEnabled: true,
                            autoReminders: true,
                            reminderHoursBefore: 24,
                            createdBy: currentUserId,
                        })
                    }
                >
                    Mock Submit Schedule
                </button>
                <button onClick={onClose}>Mock Close Schedule</button>
            </>
        )
    },
}))

function createUser(overrides: Partial<User> = {}): User {
    return {
        id: 'u-default',
        name: 'Default User',
        email: 'default@example.com',
        role: 'employee',
        department: 'Operations',
        certifications: [],
        hireDate: '2024-01-01',
        ...overrides,
    }
}

const users: User[] = [
    createUser({
        id: 'admin-1',
        name: 'Admin User',
        role: 'admin',
        email: 'admin@example.com',
    }),
    createUser({
        id: 't1',
        name: 'Taylor Trainer',
        role: 'trainer',
        email: 'taylor@example.com',
    }),
    createUser({
        id: 't2',
        name: 'Uma Trainer',
        role: 'trainer',
        email: 'uma@example.com',
    }),
]

const sessions: Session[] = [
    {
        id: 's1',
        courseId: 'c1',
        trainerId: 't1',
        title: 'Session 1',
        startTime: '2026-03-17T09:00:00.000Z',
        endTime: '2026-03-17T10:00:00.000Z',
        location: 'Room A',
        capacity: 10,
        enrolledStudents: [],
        status: 'scheduled',
    },
]

function renderTrainerWellness(currentUser: User) {
    return render(
        <TrainerWellness
            users={users}
            sessions={sessions}
            currentUser={currentUser}
            onNavigate={vi.fn()}
        />
    )
}

describe('TrainerWellness', () => {
    beforeEach(() => {
        triggerCheckInFromScheduler = null
        setCheckInsMock.mockClear()
        setRecoveryPlansMock.mockClear()
        setSchedulesMock.mockClear()
        checkInsState = [
            {
                id: 'checkin-1',
                trainerId: 't1',
                timestamp: '2026-03-15T10:00:00.000Z',
                mood: 2,
                stress: 'high',
                energy: 'tired',
                workloadSatisfaction: 2,
                sleepQuality: 2,
                physicalWellbeing: 3,
                mentalClarity: 2,
                followUpRequired: true,
                followUpCompleted: false,
            },
            {
                id: 'checkin-2',
                trainerId: 't2',
                timestamp: '2026-03-14T10:00:00.000Z',
                mood: 4,
                stress: 'low',
                energy: 'energized',
                workloadSatisfaction: 4,
                sleepQuality: 4,
                physicalWellbeing: 4,
                mentalClarity: 4,
                followUpRequired: false,
            },
        ]

        recoveryPlansState = [
            {
                id: 'recovery-1',
                trainerId: 't1',
                createdBy: 'admin-1',
                createdAt: '2026-03-10T00:00:00.000Z',
                status: 'active',
                triggerReason: 'Sustained stress trend',
                targetUtilization: 65,
                currentUtilization: 82,
                startDate: '2026-03-10T00:00:00.000Z',
                targetCompletionDate: '2026-04-10T00:00:00.000Z',
                actions: [],
                checkIns: [],
            },
        ]

        schedulesState = [
            {
                id: 'schedule-1',
                trainerId: 't1',
                frequency: 'weekly',
                startDate: '2026-03-01T00:00:00.000Z',
                nextScheduledDate: '2026-03-18T00:00:00.000Z',
                status: 'active',
                notificationEnabled: true,
                autoReminders: true,
                reminderHoursBefore: 24,
                createdBy: 'admin-1',
                createdAt: '2026-03-01T00:00:00.000Z',
                completedCheckIns: 3,
                missedCheckIns: 1,
            },
        ]

        vi.clearAllMocks()
        useKVMock.mockImplementation((key: string, initial: unknown[]) => {
            if (key === 'wellness-check-ins') {
                return [checkInsState, setCheckInsMock]
            }
            if (key === 'recovery-plans') {
                return [recoveryPlansState, setRecoveryPlansMock]
            }
            return [initial, vi.fn()]
        })

        vi.stubGlobal('confirm', vi.fn(() => true))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('renders overview cards and trainer wellness rows', () => {
        renderTrainerWellness(users[0])

        expect(screen.getByText(/trainer wellness & recovery/i)).toBeInTheDocument()
        expect(screen.getByText(/average wellness/i)).toBeInTheDocument()
        expect(screen.getByText(/critical status/i)).toBeInTheDocument()
        expect(screen.getByText('Taylor Trainer')).toBeInTheDocument()
        expect(screen.getByText('Uma Trainer')).toBeInTheDocument()
    })

    it('allows admin to create a new check-in', async () => {
        const user = userEvent.setup()
        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('button', { name: /new check-in/i }))
        await user.click(screen.getByRole('button', { name: /mock submit check-in/i }))

        expect(setCheckInsMock).toHaveBeenCalled()
        expect(toastSuccess).toHaveBeenCalledWith(
            'Check-in Recorded',
            expect.objectContaining({ description: expect.stringMatching(/has been recorded successfully/i) })
        )
    })

    it('shows schedule controls and handles pause and delete actions for admin', async () => {
        const user = userEvent.setup()

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))

        expect(screen.getByText('Taylor Trainer')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /pause/i }))
        expect(setSchedulesMock).toHaveBeenCalled()

        await user.click(screen.getByRole('button', { name: /delete/i }))
        expect(globalThis.confirm).toHaveBeenCalled()
        expect(setSchedulesMock).toHaveBeenCalledTimes(2)
        expect(toastSuccess).toHaveBeenCalledWith(
            'Schedule Deleted',
            expect.objectContaining({ description: expect.stringMatching(/has been removed/i) })
        )
    })

    it('hides admin-only controls for non-admin users', async () => {
        const user = userEvent.setup()

        renderTrainerWellness(createUser({ id: 'e1', role: 'employee', name: 'Employee User' }))

        expect(screen.queryByRole('button', { name: /new check-in/i })).not.toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))

        expect(screen.queryByRole('button', { name: /new schedule/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument()
    })

    it('renders check-in history empty state when there are no check-ins', async () => {
        const user = userEvent.setup()

        useKVMock.mockImplementation((key: string, initial: unknown[]) => {
            if (key === 'wellness-check-ins') {
                return [[], setCheckInsMock]
            }
            if (key === 'recovery-plans') {
                return [recoveryPlansState, setRecoveryPlansMock]
            }
            return [initial, vi.fn()]
        })

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /check-in history/i }))

        expect(screen.getByText(/no check-ins recorded yet/i)).toBeInTheDocument()
        expect(screen.getByText(/start tracking wellness by creating a check-in/i)).toBeInTheDocument()
    })

    it('shows empty schedule state and creates first schedule', async () => {
        const user = userEvent.setup()
        schedulesState = []

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))
        expect(screen.getByText(/no automated schedules created yet/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /create first schedule/i }))
        await user.click(screen.getByRole('button', { name: /mock submit schedule/i }))

        expect(setSchedulesMock).toHaveBeenCalled()
        expect(toastSuccess).toHaveBeenCalledWith(
            'Schedule Created',
            expect.objectContaining({ description: expect.stringMatching(/has been created successfully/i) })
        )
    })

    it('opens schedule edit flow and saves updates', async () => {
        const user = userEvent.setup()

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))
        await user.click(screen.getByRole('button', { name: /edit/i }))
        await user.click(screen.getByRole('button', { name: /mock submit schedule/i }))

        expect(setSchedulesMock).toHaveBeenCalled()
        expect(toastSuccess).toHaveBeenCalledWith(
            'Schedule Updated',
            expect.objectContaining({ description: expect.stringMatching(/has been updated/i) })
        )
    })

    it('shows resume action for paused schedules and toggles status', async () => {
        const user = userEvent.setup()
        schedulesState = [
            {
                ...schedulesState[0],
                status: 'paused',
            },
        ]

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))
        await user.click(screen.getByRole('button', { name: /resume/i }))

        expect(setSchedulesMock).toHaveBeenCalled()
    })

    it('shows plural critical alert copy when multiple trainers need support', () => {
        const statusSpy = vi.spyOn(wellnessAnalytics, 'getWellnessStatus').mockReturnValue('critical')

        renderTrainerWellness(users[0])

        expect(screen.getByText(/2 trainers need immediate support/i)).toBeInTheDocument()
        statusSpy.mockRestore()
    })

    it('renders recovery empty state when no plans exist', async () => {
        const user = userEvent.setup()
        recoveryPlansState = []

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /recovery plans/i }))

        expect(screen.getByText(/no recovery plans created yet/i)).toBeInTheDocument()
    })

    it('shows follow-up completed label in check-in history', async () => {
        const user = userEvent.setup()
        checkInsState = [
            {
                ...checkInsState[0],
                id: 'checkin-completed',
                followUpRequired: true,
                followUpCompleted: true,
                timestamp: '2026-03-16T10:00:00.000Z',
            },
        ]

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /check-in history/i }))

        expect(screen.getByText(/follow-up completed/i)).toBeInTheDocument()
    })

    it('renders frequency labels and schedule metadata variants', async () => {
        const user = userEvent.setup()
        const now = new Date()
        const tomorrow = new Date(now)
        tomorrow.setDate(now.getDate() + 1)

        schedulesState = [
            {
                ...schedulesState[0],
                id: 'schedule-daily',
                frequency: 'daily',
                nextScheduledDate: tomorrow.toISOString(),
                completedCheckIns: 0,
                missedCheckIns: 0,
                notificationEnabled: false,
                autoReminders: false,
                lastCheckInDate: '2026-03-10T00:00:00.000Z',
                endDate: '2026-04-10T00:00:00.000Z',
                notes: 'Daily coaching cadence',
            },
            {
                ...schedulesState[0],
                id: 'schedule-biweekly',
                frequency: 'biweekly',
                nextScheduledDate: tomorrow.toISOString(),
                autoReminders: false,
            },
            {
                ...schedulesState[0],
                id: 'schedule-monthly',
                frequency: 'monthly',
                nextScheduledDate: tomorrow.toISOString(),
                autoReminders: false,
            },
            {
                ...schedulesState[0],
                id: 'schedule-custom',
                frequency: 'custom',
                customDays: 10,
                nextScheduledDate: tomorrow.toISOString(),
                autoReminders: false,
            },
            {
                ...schedulesState[0],
                id: 'schedule-unknown',
                frequency: 'quarterly' as CheckInSchedule['frequency'],
                nextScheduledDate: tomorrow.toISOString(),
                autoReminders: false,
            },
        ]

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))

        expect(screen.getByText(/daily check-ins/i)).toBeInTheDocument()
        expect(screen.getByText(/bi-weekly check-ins/i)).toBeInTheDocument()
        expect(screen.getByText(/monthly check-ins/i)).toBeInTheDocument()
        expect(screen.getByText(/every 10 days check-ins/i)).toBeInTheDocument()
        expect(screen.getByText(/quarterly check-ins/i)).toBeInTheDocument()
        expect(screen.getByText(/n\/a/i)).toBeInTheDocument()
        expect(screen.getByText(/last check-in:/i)).toBeInTheDocument()
        expect(screen.getByText(/ends:/i)).toBeInTheDocument()
        expect(screen.getByText(/daily coaching cadence/i)).toBeInTheDocument()
        expect(screen.queryByText(/automatic reminders/i)).not.toBeInTheDocument()
    })

    it('renders overdue and due-soon schedule indicators', async () => {
        const user = userEvent.setup()
        const now = new Date()
        const yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)

        schedulesState = [
            {
                ...schedulesState[0],
                id: 'schedule-overdue',
                nextScheduledDate: yesterday.toISOString(),
                status: 'active',
            },
            {
                ...schedulesState[0],
                id: 'schedule-due-soon',
                nextScheduledDate: now.toISOString(),
                status: 'paused',
            },
        ]

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))

        expect(screen.getByText(/^overdue$/i)).toBeInTheDocument()
        expect(screen.getByText(/due soon/i)).toBeInTheDocument()
        expect(screen.getByText(/today/i)).toBeInTheDocument()
    })

    it('shows non-urgent next-date text for schedules outside due-soon window', async () => {
        const user = userEvent.setup()
        const now = new Date()
        const inFiveDays = new Date(now)
        inFiveDays.setDate(now.getDate() + 5)

        schedulesState = [
            {
                ...schedulesState[0],
                id: 'schedule-future',
                nextScheduledDate: inFiveDays.toISOString(),
                status: 'active',
            },
        ]

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))

        expect(screen.queryByText(/^overdue$/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/due soon/i)).not.toBeInTheDocument()
        expect(screen.getByText(/^\d+ days$/i)).toBeInTheDocument()
    })

    it('filters check-in history by selected trainer', async () => {
        const user = userEvent.setup()

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /check-in history/i }))
        const checkInPanel = screen.getByRole('tabpanel', { name: /check-in history/i })
        await user.click(within(checkInPanel).getByRole('combobox'))
        await user.click(screen.getByRole('option', { name: /uma trainer/i }))

        expect(within(checkInPanel).getAllByText('Uma Trainer').length).toBeGreaterThan(0)
        expect(within(checkInPanel).queryByText(/^Taylor Trainer$/)).not.toBeInTheDocument()
    })

    it('resets check-in history filter back to all trainers', async () => {
        const user = userEvent.setup()

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /check-in history/i }))
        const checkInPanel = screen.getByRole('tabpanel', { name: /check-in history/i })

        await user.click(within(checkInPanel).getByRole('combobox'))
        await user.click(screen.getByRole('option', { name: /uma trainer/i }))
        expect(within(checkInPanel).queryByText(/^Taylor Trainer$/)).not.toBeInTheDocument()

        await user.click(within(checkInPanel).getByRole('combobox'))
        await user.click(screen.getByRole('option', { name: /all trainers/i }))

        expect(within(checkInPanel).getByText(/^Taylor Trainer$/)).toBeInTheDocument()
        expect(within(checkInPanel).getByText(/^Uma Trainer$/)).toBeInTheDocument()
    })

    it('handles scheduled check-in trigger callback and action flow', async () => {
        renderTrainerWellness(users[0])

        expect(triggerCheckInFromScheduler).toBeTypeOf('function')
        triggerCheckInFromScheduler?.('t1', 'Taylor Trainer')

        expect(toastInfo).toHaveBeenCalledWith(
            'Wellness Check-In Due',
            expect.objectContaining({
                description: expect.stringMatching(/scheduled wellness check-in due now/i),
                action: expect.objectContaining({ label: 'Open Check-In' }),
            })
        )

        const action = toastInfo.mock.calls[0]?.[1]?.action
        expect(action).toBeDefined()
        await act(async () => {
            await action.onClick()
        })

        expect(await screen.findByRole('button', { name: /mock submit check-in/i })).toBeInTheDocument()
    })

    it('renders concerns and comments when present in check-in history', async () => {
        const user = userEvent.setup()
        checkInsState = [
            {
                ...checkInsState[0],
                id: 'checkin-comments',
                concerns: ['Fatigue', 'Workload'],
                comments: 'Need lighter assignment next week',
            },
        ]

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /check-in history/i }))

        expect(screen.getByText(/concerns:/i)).toBeInTheDocument()
        expect(screen.getByText('Fatigue')).toBeInTheDocument()
        expect(screen.getAllByText('Workload')).toHaveLength(2)
        expect(screen.getByText(/comments:/i)).toBeInTheDocument()
        expect(screen.getByText(/need lighter assignment next week/i)).toBeInTheDocument()
    })

    it('renders recovery progress and notes when actions exist', async () => {
        const user = userEvent.setup()
        recoveryPlansState = [
            {
                ...recoveryPlansState[0],
                id: 'recovery-with-actions',
                status: 'completed',
                actions: [
                    {
                        id: 'action-1',
                        type: 'time-off',
                        description: 'Take two days off',
                        targetDate: '2026-03-20T00:00:00.000Z',
                        completed: true,
                        completedDate: '2026-03-21T00:00:00.000Z',
                    },
                    {
                        id: 'action-2',
                        type: 'schedule-adjustment',
                        description: 'Reduce evening sessions',
                        targetDate: '2026-03-25T00:00:00.000Z',
                        completed: false,
                    },
                ],
                notes: 'Recovery plan completed successfully',
            },
        ]

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /recovery plans/i }))

        expect(screen.getByText(/1 of 2 actions completed/i)).toBeInTheDocument()
        expect(screen.getByText(/recovery plan completed successfully/i)).toBeInTheDocument()
        expect(screen.getByText(/^completed$/i)).toBeInTheDocument()
    })

    it('shows recovery recommendation warning after a check-in trigger', async () => {
        const user = userEvent.setup()
        const triggerSpy = vi
            .spyOn(wellnessAnalytics, 'shouldTriggerRecoveryPlan')
            .mockReturnValue({ shouldTrigger: true, reasons: ['High stress trend'] })

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('button', { name: /new check-in/i }))
        await user.click(screen.getByRole('button', { name: /mock submit check-in/i }))

        expect(toastWarning).toHaveBeenCalledWith(
            'Recovery Plan Recommended',
            expect.objectContaining({ description: expect.stringMatching(/recommended for/i) })
        )

        const action = toastWarning.mock.calls[0]?.[1]?.action
        expect(action).toBeDefined()

        await act(async () => {
            await action.onClick()
        })

        expect(await screen.findByRole('button', { name: /mock submit recovery plan/i })).toBeInTheDocument()

        triggerSpy.mockRestore()
    })

    it('changes the time range filter and updates the selected value', async () => {
        const user = userEvent.setup()

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('combobox'))
        await user.click(screen.getByRole('option', { name: /last 90 days/i }))

        expect(screen.getByRole('combobox')).toHaveTextContent(/last 90 days/i)
    })

    it('opens the manual check-in action from automated schedules', async () => {
        const user = userEvent.setup()

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))
        await user.click(screen.getByRole('button', { name: /manual check-in/i }))

        expect(await screen.findByRole('button', { name: /mock submit check-in/i })).toBeInTheDocument()
    })

    it('closes check-in and schedule dialogs via onClose callbacks', async () => {
        const user = userEvent.setup()

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('button', { name: /new check-in/i }))
        expect(screen.getByRole('button', { name: /mock submit check-in/i })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /mock close check-in/i }))
        expect(screen.queryByRole('button', { name: /mock submit check-in/i })).not.toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))
        await user.click(screen.getByRole('button', { name: /new schedule/i }))
        expect(screen.getByRole('button', { name: /mock submit schedule/i })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /mock close schedule/i }))
        expect(screen.queryByRole('button', { name: /mock submit schedule/i })).not.toBeInTheDocument()
    })

    it('renders status badge variants including excellent, fair, and unknown', () => {
        const statusSpy = vi
            .spyOn(wellnessAnalytics, 'getWellnessStatus')
            .mockImplementationOnce(() => 'excellent')
            .mockImplementationOnce(() => 'fair')
            .mockImplementation(() => 'unknown' as any)

        renderTrainerWellness(users[0])

        expect(screen.getByText(/^excellent$/i)).toBeInTheDocument()
        expect(screen.getByText(/^fair$/i)).toBeInTheDocument()

        statusSpy.mockRestore()
    })

    it('shows plural active recovery plan copy for a trainer with multiple active plans', () => {
        recoveryPlansState = [
            recoveryPlansState[0],
            {
                ...recoveryPlansState[0],
                id: 'recovery-2',
                createdAt: '2026-03-11T00:00:00.000Z',
            },
        ]

        renderTrainerWellness(users[0])

        expect(screen.getByText(/2 active recovery plans/i)).toBeInTheDocument()
    })

    it('creates a recovery plan from the recovery tab action', async () => {
        const user = userEvent.setup()

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /recovery plans/i }))
        await user.click(screen.getByRole('button', { name: /create recovery plan/i }))
        await user.click(screen.getByRole('button', { name: /mock submit recovery plan/i }))

        expect(setRecoveryPlansMock).toHaveBeenCalled()
        expect(toastSuccess).toHaveBeenCalledWith(
            'Recovery Plan Created',
            expect.objectContaining({ description: expect.stringMatching(/created successfully/i) })
        )
    })

    it('renders insights with action-needed and multi-severity recommendations', async () => {
        const user = userEvent.setup()

        const triggerSpy = vi
            .spyOn(wellnessAnalytics, 'shouldTriggerRecoveryPlan')
            .mockImplementation((_checkIns, trainerId) =>
                trainerId === 't1'
                    ? { shouldTrigger: true, reasons: ['Sustained stress trend'] }
                    : { shouldTrigger: false, reasons: [] }
            )

        const insightsSpy = vi
            .spyOn(wellnessAnalytics, 'getWellnessInsights')
            .mockImplementation((_checkIns, trainerId) =>
                trainerId === 't1'
                    ? [
                        { severity: 'critical', insight: 'Immediate schedule reduction needed' },
                        { severity: 'warning', insight: 'Fatigue trend increasing this week' },
                        { severity: 'info', insight: 'Sleep quality improved recently' },
                    ]
                    : [{ severity: 'info', insight: 'Stable wellbeing profile' }]
            )

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /insights/i }))

        expect(screen.getByText(/action needed/i)).toBeInTheDocument()
        expect(screen.getByText(/recovery plan recommended/i)).toBeInTheDocument()
        expect(screen.getByText(/sustained stress trend/i)).toBeInTheDocument()
        expect(screen.getByText(/immediate schedule reduction needed/i)).toBeInTheDocument()
        expect(screen.getByText(/fatigue trend increasing this week/i)).toBeInTheDocument()
        expect(screen.getByText(/sleep quality improved recently/i)).toBeInTheDocument()

        triggerSpy.mockRestore()
        insightsSpy.mockRestore()
    })

    it('does not delete a schedule when confirmation is cancelled', async () => {
        const user = userEvent.setup()
        vi.stubGlobal('confirm', vi.fn(() => false))

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))
        await user.click(screen.getByRole('button', { name: /delete/i }))

        expect(setSchedulesMock).not.toHaveBeenCalled()
        expect(toastSuccess).not.toHaveBeenCalledWith(
            'Schedule Deleted',
            expect.objectContaining({ description: expect.stringMatching(/removed/i) })
        )
    })

    it('handles undefined persisted check-ins and recovery plans safely', () => {
        useKVMock.mockImplementation((key: string, initial: unknown[]) => {
            if (key === 'wellness-check-ins') {
                return [undefined, setCheckInsMock]
            }
            if (key === 'recovery-plans') {
                return [undefined, setRecoveryPlansMock]
            }
            return [initial, vi.fn()]
        })

        expect(() => renderTrainerWellness(users[0])).not.toThrow()
        expect(screen.getByText(/trainer wellness & recovery/i)).toBeInTheDocument()
    })

    it('uses muted status bar color for unknown wellness status values', () => {
        const statusSpy = vi.spyOn(wellnessAnalytics, 'getWellnessStatus').mockReturnValue('mystery' as never)

        renderTrainerWellness(users[0])

        const statusBars = screen.getAllByTestId('wellness-status-bar')
        expect(statusBars.length).toBeGreaterThan(0)
        expect(statusBars[0].className).toContain('bg-muted')

        statusSpy.mockRestore()
    })

    it('prioritizes active schedules and ignores schedules for missing trainers', async () => {
        const user = userEvent.setup()
        schedulesState = [
            {
                ...schedulesState[0],
                id: 'schedule-paused',
                trainerId: 't1',
                status: 'paused',
                nextScheduledDate: '2026-03-17T00:00:00.000Z',
            },
            {
                ...schedulesState[0],
                id: 'schedule-active',
                trainerId: 't2',
                status: 'active',
                nextScheduledDate: '2026-03-25T00:00:00.000Z',
            },
            {
                ...schedulesState[0],
                id: 'schedule-missing-trainer',
                trainerId: 'missing-trainer-id',
                status: 'active',
            },
        ]

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /automated schedules/i }))

        const trainerNames = screen.getAllByText(/trainer$/i)
        expect(trainerNames[0]).toHaveTextContent('Uma Trainer')
        expect(screen.queryByText(/missing-trainer-id/i)).not.toBeInTheDocument()
    })

    it('prioritizes active recovery plans above non-active plans', async () => {
        const user = userEvent.setup()
        recoveryPlansState = [
            {
                ...recoveryPlansState[0],
                id: 'recovery-completed',
                trainerId: 't1',
                status: 'completed',
                createdAt: '2026-03-11T00:00:00.000Z',
            },
            {
                ...recoveryPlansState[0],
                id: 'recovery-active',
                trainerId: 't2',
                status: 'active',
                createdAt: '2026-03-01T00:00:00.000Z',
            },
        ]

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /recovery plans/i }))

        const planTitles = screen.getAllByText(/- Recovery Plan$/i)
        expect(planTitles[0]).toHaveTextContent(/^Uma Trainer/i)
    })

    it('passes empty trainer fallback props to check-in dialog when no trainers exist', async () => {
        const user = userEvent.setup()
        const adminOnly: User = {
            id: 'admin-only',
            name: 'Admin Only',
            email: 'admin-only@example.com',
            role: 'admin',
            department: 'Operations',
            certifications: [],
            hireDate: '2024-01-01',
        }

        render(
            <TrainerWellness
                users={[adminOnly]}
                sessions={[]}
                currentUser={adminOnly}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: /new check-in/i }))

        expect(screen.getByText('Mock Check-In Props: |')).toBeInTheDocument()
    })

    it('executes the recovery plan dialog onClose callback when the dialog is dismissed', async () => {
        const user = userEvent.setup()
        recoveryPlansState = []

        renderTrainerWellness(users[0])

        await user.click(screen.getByRole('tab', { name: /recovery plans/i }))
        await user.click(screen.getByRole('button', { name: /create recovery plan/i }))

        expect(screen.getByRole('button', { name: /mock close recovery plan/i })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /mock close recovery plan/i }))

        expect(screen.queryByRole('button', { name: /mock close recovery plan/i })).not.toBeInTheDocument()
    })
})
