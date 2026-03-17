import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TrainerWellness } from './TrainerWellness'
import type { CheckInSchedule, RecoveryPlan, Session, User, WellnessCheckIn } from '@/lib/types'

const useKVMock = vi.fn()
const setCheckInsMock = vi.fn()
const setRecoveryPlansMock = vi.fn()
const setSchedulesMock = vi.fn()

const toastInfo = vi.fn()
const toastSuccess = vi.fn()
const toastWarning = vi.fn()

let checkInsState: WellnessCheckIn[] = []
let recoveryPlansState: RecoveryPlan[] = []
let schedulesState: CheckInSchedule[] = []

vi.mock('@github/spark/hooks', () => ({
    useKV: (...args: unknown[]) => useKVMock(...args),
}))

vi.mock('@/hooks/use-check-in-scheduler', () => ({
    useCheckInScheduler: () => ({
        get schedules() {
            return schedulesState
        },
        setSchedules: setSchedulesMock,
    }),
}))

vi.mock('sonner', () => ({
    toast: {
        info: (...args: unknown[]) => toastInfo(...args),
        success: (...args: unknown[]) => toastSuccess(...args),
        warning: (...args: unknown[]) => toastWarning(...args),
    },
}))

vi.mock('@/components/WellnessCheckInDialog', () => ({
    WellnessCheckInDialog: ({ open, trainerId, onSubmit }: { open: boolean; trainerId: string; onSubmit: (data: Omit<WellnessCheckIn, 'id' | 'timestamp'>) => void }) => {
        if (!open) return null
        return (
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
        )
    },
}))

vi.mock('@/components/RecoveryPlanDialog', () => ({
    RecoveryPlanDialog: ({ open, trainerId, currentUser, onSubmit }: { open: boolean; trainerId: string; currentUser: User; onSubmit: (plan: Omit<RecoveryPlan, 'id' | 'createdAt'>) => void }) => {
        if (!open) return null
        return (
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
        )
    },
}))

vi.mock('@/components/CheckInScheduleDialog', () => ({
    CheckInScheduleDialog: ({ open, trainers, currentUserId, existingSchedule, onSubmit }: { open: boolean; trainers: User[]; currentUserId: string; existingSchedule?: CheckInSchedule; onSubmit: (data: Omit<CheckInSchedule, 'id' | 'createdAt' | 'completedCheckIns' | 'missedCheckIns'>) => void }) => {
        if (!open) return null
        return (
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
})
