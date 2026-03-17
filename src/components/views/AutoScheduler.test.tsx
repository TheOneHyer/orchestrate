import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AutoScheduler } from './AutoScheduler'
import type { Course, User } from '@/lib/types'

const useKVMock = vi.fn()
const analyzeFeasibilityMock = vi.fn()
const findAvailableTrainersMock = vi.fn()
const autoScheduleSessionsMock = vi.fn()

const toastSuccess = vi.fn()
const toastWarning = vi.fn()
const toastError = vi.fn()
const toastInfo = vi.fn()

vi.mock('@github/spark/hooks', () => ({
    useKV: (...args: unknown[]) => useKVMock(...args),
}))

vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => toastSuccess(...args),
        warning: (...args: unknown[]) => toastWarning(...args),
        error: (...args: unknown[]) => toastError(...args),
        info: (...args: unknown[]) => toastInfo(...args),
    },
}))

vi.mock('@/lib/scheduler', () => {
    class TrainerScheduler {
        analyzeSchedulingFeasibility(...args: unknown[]) {
            return analyzeFeasibilityMock(...args)
        }

        findAvailableTrainers(...args: unknown[]) {
            return findAvailableTrainersMock(...args)
        }

        autoScheduleSessions(...args: unknown[]) {
            return autoScheduleSessionsMock(...args)
        }
    }

    return { TrainerScheduler }
})

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

const courses: Course[] = [
    {
        id: 'c1',
        title: 'Safety Foundations',
        description: 'Course',
        modules: ['Intro'],
        duration: 60,
        certifications: ['CPR'],
        createdBy: 'admin',
        createdAt: '2026-01-01',
        published: true,
        passScore: 80,
    },
]

const users: User[] = [
    createUser({
        id: 't1',
        name: 'Taylor Trainer',
        role: 'trainer',
        certifications: ['CPR'],
        trainerProfile: {
            authorizedRoles: [],
            shiftSchedules: [{ shiftCode: 'DAY', daysWorked: ['monday'], startTime: '08:00', endTime: '16:00', totalHoursPerWeek: 8 }],
            tenure: { hireDate: '2024-01-01', yearsOfService: 2, monthsOfService: 24 },
            specializations: [],
        },
    }),
]

describe('AutoScheduler', () => {
    let timeoutSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        vi.clearAllMocks()

        timeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback: any) => {
            callback()
            return 0 as any
        })

        useKVMock.mockImplementation((key: string, initialValue: unknown) => {
            if (key === 'sessions') {
                return [[], vi.fn()]
            }
            return [initialValue, vi.fn()]
        })

        analyzeFeasibilityMock.mockReturnValue({ feasible: true })
        findAvailableTrainersMock.mockReturnValue([
            {
                trainer: { ...users[0], shifts: ['day'] },
                score: 92,
                matchReasons: ['Has required certification'],
                conflicts: [],
                availability: 'available',
            },
        ])

        autoScheduleSessionsMock.mockReturnValue({
            success: true,
            sessions: [
                {
                    courseId: 'c1',
                    trainerId: 't1',
                    title: 'Safety Foundations',
                    startTime: '2026-03-20T09:00:00.000Z',
                    endTime: '2026-03-20T10:00:00.000Z',
                    location: 'Room A',
                    capacity: 20,
                    status: 'scheduled',
                    enrolledStudents: [],
                },
            ],
            recommendations: ['Balance workload next week'],
            conflicts: [],
        })
    })

    afterEach(() => {
        timeoutSpy.mockRestore()
    })

    async function selectCourseAndDate() {
        const user = userEvent.setup()
        await user.click(screen.getByRole('combobox', { name: /course/i }))
        await user.click(screen.getByRole('option', { name: /safety foundations/i }))

        // selectCourseAndDate intentionally uses fireEvent.change for date inputs because jsdom date handling is unreliable with userEvent typing.
        fireEvent.change(screen.getByLabelText(/start date/i), {
            target: { value: '2026-03-20' },
        })
    }

    it('renders form and keeps actions disabled until required fields are set', () => {
        render(
            <AutoScheduler users={users} courses={courses} onSessionsCreated={vi.fn()} />
        )

        expect(screen.getByText(/automatic trainer scheduler/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /analyze feasibility/i })).toBeDisabled()
        expect(screen.getByRole('button', { name: /auto-schedule sessions/i })).toBeDisabled()
    })

    it('analyzes feasibility and shows ranked available trainers', async () => {
        render(
            <AutoScheduler users={users} courses={courses} onSessionsCreated={vi.fn()} />
        )

        await selectCourseAndDate()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /analyze feasibility/i }))
        })

        expect(analyzeFeasibilityMock).toHaveBeenCalled()
        expect(findAvailableTrainersMock).toHaveBeenCalled()
        expect(screen.getByText(/available trainers/i)).toBeInTheDocument()
        expect(screen.getByText(/taylor trainer/i)).toBeInTheDocument()
        expect(screen.getByText('92')).toBeInTheDocument()
        expect(toastSuccess).toHaveBeenCalledWith('Schedule is feasible!')
    })

    it('renders partial trainer availability with conflict details', async () => {
        findAvailableTrainersMock.mockReturnValueOnce([
            {
                trainer: { ...users[0], shifts: ['day'] },
                score: 78,
                matchReasons: ['Has required certification'],
                conflicts: ['Already assigned during selected time'],
                availability: 'partial',
            },
        ])

        render(
            <AutoScheduler users={users} courses={courses} onSessionsCreated={vi.fn()} />
        )

        await selectCourseAndDate()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /analyze feasibility/i }))
        })

        expect(screen.getByText(/partial/i)).toBeInTheDocument()
        expect(screen.getByText(/already assigned during selected time/i)).toBeInTheDocument()
    })

    it('shows no available trainers alert when analysis returns none', async () => {
        findAvailableTrainersMock.mockReturnValueOnce([])
        analyzeFeasibilityMock.mockReturnValueOnce({ feasible: false })

        render(
            <AutoScheduler users={users} courses={courses} onSessionsCreated={vi.fn()} />
        )

        await selectCourseAndDate()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /analyze feasibility/i }))
        })

        expect(screen.getByText(/no available trainers/i)).toBeInTheDocument()
        expect(toastWarning).toHaveBeenCalledWith('Some scheduling constraints detected')
    })

    it('auto-schedules sessions successfully and emits recommendations', async () => {
        const onSessionsCreated = vi.fn()

        render(
            <AutoScheduler users={users} courses={courses} onSessionsCreated={onSessionsCreated} />
        )

        await selectCourseAndDate()
        fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: 'Room A' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /auto-schedule sessions/i }))
        })

        expect(autoScheduleSessionsMock).toHaveBeenCalled()
        expect(onSessionsCreated).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ trainerId: 't1' })]))
        expect(screen.getByText(/sessions created successfully/i)).toBeInTheDocument()
        expect(toastSuccess).toHaveBeenCalledWith('Successfully scheduled 1 session(s)!')
        expect(toastInfo).toHaveBeenCalledWith('Balance workload next week', { duration: 5000 })
    })

    it('includes recurrence and date-range constraints in auto-schedule payload and supports null sessions store', async () => {
        useKVMock.mockImplementationOnce((key: string, initialValue: unknown) => {
            if (key === 'sessions') {
                return [null, vi.fn()]
            }
            return [initialValue, vi.fn()]
        })

        render(
            <AutoScheduler users={users} courses={courses} onSessionsCreated={vi.fn()} />
        )

        await selectCourseAndDate()

        fireEvent.change(screen.getByLabelText(/end date/i), {
            target: { value: '2026-03-21' },
        })
        fireEvent.change(screen.getByLabelText(/start time/i), {
            target: { value: '08:30' },
        })
        fireEvent.change(screen.getByLabelText(/end time/i), {
            target: { value: '11:45' },
        })
        fireEvent.change(screen.getByLabelText(/capacity/i), {
            target: { value: '16' },
        })

        const user = userEvent.setup()
        await user.click(screen.getByRole('combobox', { name: /recurrence pattern/i }))
        await user.click(screen.getByRole('option', { name: /^weekly$/i }))

        fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: 'Room C' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /auto-schedule sessions/i }))
        })

        expect(autoScheduleSessionsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                dates: ['2026-03-20', '2026-03-21'],
                startTime: '08:30',
                endTime: '11:45',
                location: 'Room C',
                capacity: 16,
                recurrence: {
                    frequency: 'weekly',
                    endDate: '2026-03-21',
                },
            })
        )
    })

    it('renders scheduling conflicts when auto-schedule fails', async () => {
        autoScheduleSessionsMock.mockReturnValueOnce({
            success: false,
            sessions: [],
            recommendations: [],
            conflicts: [
                { message: 'No trainer available for selected date' },
            ],
        })

        render(
            <AutoScheduler users={users} courses={courses} onSessionsCreated={vi.fn()} />
        )

        await selectCourseAndDate()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /auto-schedule sessions/i }))
        })

        expect(screen.getByText(/scheduling issues detected/i)).toBeInTheDocument()
        expect(screen.getByText(/no trainer available for selected date/i)).toBeInTheDocument()
        expect(toastError).toHaveBeenCalledWith('Could not schedule sessions')
    })
})
