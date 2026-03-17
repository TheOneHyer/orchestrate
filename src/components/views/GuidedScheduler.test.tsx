import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GuidedScheduler } from './GuidedScheduler'
import type { Course, User } from '@/lib/types'

const useKVMock = vi.fn()
const findAvailableTrainersMock = vi.fn()
const toastSuccess = vi.fn()
const toastInfo = vi.fn()
const toastError = vi.fn()

const calculateTrainerWorkloadMock = vi.fn()
const calculateBurnoutRiskMock = vi.fn()

vi.mock('@github/spark/hooks', () => ({
    useKV: (...args: unknown[]) => useKVMock(...args),
}))

vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => toastSuccess(...args),
        info: (...args: unknown[]) => toastInfo(...args),
        error: (...args: unknown[]) => toastError(...args),
    },
}))

vi.mock('@/lib/workload-balancer', () => ({
    calculateTrainerWorkload: (...args: unknown[]) => calculateTrainerWorkloadMock(...args),
}))

vi.mock('@/lib/burnout-analytics', () => ({
    calculateBurnoutRisk: (...args: unknown[]) => calculateBurnoutRiskMock(...args),
}))

vi.mock('@/lib/scheduler', () => {
    class TrainerScheduler {
        findAvailableTrainers(...args: unknown[]) {
            return findAvailableTrainersMock(...args)
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
    createUser({
        id: 't2',
        name: 'Uma Trainer',
        role: 'trainer',
        certifications: ['CPR'],
    }),
]

describe('GuidedScheduler', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        useKVMock.mockImplementation((key: string, initialValue: unknown) => {
            if (key === 'sessions') return [[], vi.fn()]
            if (key === 'wellness-check-ins') return [[], vi.fn()]
            if (key === 'recovery-plans') {
                return [[{ trainerId: 't2', status: 'active' }], vi.fn()]
            }
            return [initialValue, vi.fn()]
        })

        findAvailableTrainersMock.mockReturnValue([
            {
                trainer: users[0],
                score: 90,
                matchReasons: ['Best certification match'],
                conflicts: [],
                availability: 'available',
            },
            {
                trainer: users[1],
                score: 75,
                matchReasons: ['Available but monitored'],
                conflicts: ['Active recovery plan'],
                availability: 'partial',
            },
        ])

        calculateTrainerWorkloadMock.mockImplementation((trainer: User) => {
            if (trainer.id === 't1') {
                return { totalHours: 26, utilizationRate: 65 }
            }
            return { totalHours: 36, utilizationRate: 90 }
        })

        calculateBurnoutRiskMock.mockImplementation((trainerId: string) => {
            if (trainerId === 't1') {
                return { risk: 'low', riskScore: 22 }
            }
            return { risk: 'high', riskScore: 82 }
        })
    })

    async function fillParameters(user: ReturnType<typeof userEvent.setup>) {
        await user.click(screen.getByRole('combobox', { name: /course/i }))
        await user.click(screen.getByRole('option', { name: /safety foundations/i }))

        const startDateInput = screen.getByLabelText(/start date/i)
        await user.click(startDateInput)
        await user.clear(startDateInput)
        await user.type(startDateInput, '2026-03-20')
        await user.tab()
    }

    it('prefills start date when prefilledDate is provided', () => {
        render(
            <GuidedScheduler
                users={users}
                courses={courses}
                onSessionsCreated={vi.fn()}
                prefilledDate={new Date('2026-03-20T12:00:00.000Z')}
            />
        )

        expect(screen.getByLabelText(/start date/i)).toHaveValue('2026-03-20')
    })

    it('analyzes and shows ranked trainer recommendations', async () => {
        const user = userEvent.setup()

        render(
            <GuidedScheduler
                users={users}
                courses={courses}
                onSessionsCreated={vi.fn()}
            />
        )

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))

        expect(screen.getByText(/select trainer/i)).toBeInTheDocument()
        expect(screen.getByText(/taylor trainer/i)).toBeInTheDocument()
        expect(screen.getByText(/uma trainer/i)).toBeInTheDocument()
        expect(screen.getByText(/optimal choice/i)).toBeInTheDocument()
        expect(screen.getByText(/not recommended/i)).toBeInTheDocument()
        expect(toastSuccess).toHaveBeenCalledWith('Found optimal trainers for this schedule!')
        expect(calculateTrainerWorkloadMock).toHaveBeenCalledTimes(2)
        expect(calculateTrainerWorkloadMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 't1' }),
            [],
            expect.any(Date),
            expect.any(Date)
        )
        expect(calculateTrainerWorkloadMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 't2' }),
            [],
            expect.any(Date),
            expect.any(Date)
        )
        expect(calculateBurnoutRiskMock).toHaveBeenCalledTimes(2)
        expect(calculateBurnoutRiskMock).toHaveBeenCalledWith('t1', [], expect.any(Array), users, courses)
        expect(calculateBurnoutRiskMock).toHaveBeenCalledWith('t2', [], expect.any(Array), users, courses)
    })

    it('filters out unconfigured trainers when hide toggle is enabled', async () => {
        const user = userEvent.setup()

        render(
            <GuidedScheduler
                users={users}
                courses={courses}
                onSessionsCreated={vi.fn()}
            />
        )

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))

        const hideCheckbox = screen.getByRole('checkbox', { name: /hide trainers without configured schedules/i })
        await user.click(hideCheckbox)

        expect(screen.getByText(/taylor trainer/i)).toBeInTheDocument()
        expect(screen.queryByText(/uma trainer/i)).toBeNull()
    })

    it('completes selection and confirmation flow to create sessions', async () => {
        const user = userEvent.setup()
        const onSessionsCreated = vi.fn()

        render(
            <GuidedScheduler
                users={users}
                courses={courses}
                onSessionsCreated={onSessionsCreated}
            />
        )

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))

        await user.click(screen.getByText(/1\. taylor trainer/i))

        expect(screen.getByText(/confirm schedule/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /confirm & schedule/i }))

        expect(onSessionsCreated).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    trainerId: 't1',
                    courseId: 'c1',
                    status: 'scheduled',
                    startTime: expect.any(String),
                }),
            ])
        )

        const expectedStartDate = new Date('2026-03-20')
        expectedStartDate.setHours(9, 0, 0, 0)
        const expectedIsoDate = expectedStartDate.toISOString().split('T')[0]

        const createdSessions = onSessionsCreated.mock.calls[0][0] as Array<Partial<{ startTime: string }>>
        expect(createdSessions[0].startTime).toEqual(expect.stringMatching(new RegExp(`^${expectedIsoDate}T`)))
        expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/successfully scheduled 1 session/i))
    })

    it('shows error when no trainers are available', async () => {
        const user = userEvent.setup()
        findAvailableTrainersMock.mockReturnValueOnce([])

        render(
            <GuidedScheduler
                users={users}
                courses={courses}
                onSessionsCreated={vi.fn()}
            />
        )

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))

        expect(screen.getByText(/no available trainers/i)).toBeInTheDocument()
        expect(toastError).toHaveBeenCalledWith('No qualified trainers available')
    })
})
