import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GuidedScheduler } from './GuidedScheduler'
import type { Course, User, WellnessCheckIn } from '@/lib/types'

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

function renderGuidedScheduler(overrides: Partial<React.ComponentProps<typeof GuidedScheduler>> = {}) {
    const defaultProps: React.ComponentProps<typeof GuidedScheduler> = {
        users,
        courses,
        onSessionsCreated: vi.fn(),
    }

    return render(<GuidedScheduler {...defaultProps} {...overrides} />)
}

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
        renderGuidedScheduler({ prefilledDate: new Date('2026-03-20T12:00:00.000Z') })

        expect(screen.getByLabelText(/start date/i)).toHaveValue('2026-03-20')
    })

    it('analyzes and shows ranked trainer recommendations', async () => {
        const user = userEvent.setup()

        renderGuidedScheduler()

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

        renderGuidedScheduler()

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

        renderGuidedScheduler({ onSessionsCreated })

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

        const createdSessions = onSessionsCreated.mock.calls[0][0] as Array<Partial<{ startTime: string }>>
        const createdStartDate = new Date(createdSessions[0].startTime as string)
        const expectedIsoDate = `${createdStartDate.getUTCFullYear()}-${String(createdStartDate.getUTCMonth() + 1).padStart(2, '0')}-${String(createdStartDate.getUTCDate()).padStart(2, '0')}`
        expect(createdSessions[0].startTime).toEqual(expect.stringMatching(new RegExp(`^${expectedIsoDate}T`)))
        expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/successfully scheduled 1 session/i))
    })

    it('shows error when no trainers are available', async () => {
        const user = userEvent.setup()
        findAvailableTrainersMock.mockReturnValueOnce([])

        renderGuidedScheduler()

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))

        expect(screen.getByText(/no available trainers/i)).toBeInTheDocument()
        expect(toastError).toHaveBeenCalledWith('No qualified trainers available')
    })

    it('shows info toast when available trainers are non-optimal', async () => {
        const user = userEvent.setup()

        findAvailableTrainersMock.mockReturnValueOnce([
            {
                trainer: users[0],
                score: 74,
                matchReasons: ['Qualified trainer'],
                conflicts: ['Higher utilization'],
                availability: 'partial',
            },
        ])

        calculateTrainerWorkloadMock.mockReturnValueOnce({ totalHours: 34, utilizationRate: 82 })
        calculateBurnoutRiskMock.mockReturnValueOnce({ risk: 'moderate', riskScore: 58 })

        renderGuidedScheduler()

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))

        expect(screen.getByText(/use with caution/i)).toBeInTheDocument()
        expect(toastInfo).toHaveBeenCalledWith('Review trainer recommendations carefully')
    })

    it('shows all-filtered-out alert when hide toggle removes all recommendations', async () => {
        const user = userEvent.setup()

        const noScheduleUsers = [
            { ...users[0], trainerProfile: undefined },
            users[1],
        ]

        findAvailableTrainersMock.mockReturnValueOnce([
            {
                trainer: noScheduleUsers[0],
                score: 90,
                matchReasons: ['Strong match'],
                conflicts: [],
                availability: 'available',
            },
            {
                trainer: noScheduleUsers[1],
                score: 80,
                matchReasons: ['Qualified'],
                conflicts: [],
                availability: 'available',
            },
        ])

        renderGuidedScheduler({ users: noScheduleUsers })

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))
        await user.click(screen.getByRole('checkbox', { name: /hide trainers without configured schedules/i }))

        expect(screen.getByText(/all trainers filtered out/i)).toBeInTheDocument()
    })

    it('creates recurring sessions and allows back navigation between steps', async () => {
        const user = userEvent.setup()
        const onSessionsCreated = vi.fn()

        renderGuidedScheduler({ onSessionsCreated })

        await fillParameters(user)

        const endDateInput = screen.getByLabelText(/end date/i)
        await user.click(endDateInput)
        await user.clear(endDateInput)
        await user.type(endDateInput, '2026-03-22')
        await user.tab()

        await user.click(screen.getByRole('combobox', { name: /recurrence pattern/i }))
        await user.click(screen.getByRole('option', { name: /daily/i }))

        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))

        await user.click(screen.getByRole('button', { name: /back to parameters/i }))
        expect(screen.getByText(/session parameters/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))
        await user.click(screen.getByText(/1\. taylor trainer/i))
        await user.click(screen.getByRole('button', { name: /back to trainers/i }))
        expect(screen.getByText(/select trainer/i)).toBeInTheDocument()

        await user.click(screen.getByText(/1\. taylor trainer/i))
        await user.click(screen.getByRole('button', { name: /confirm & schedule/i }))

        const createdSessions = onSessionsCreated.mock.calls[0][0] as Array<Partial<{ recurrence: { frequency: string; endDate: string } }>>
        expect(createdSessions).toHaveLength(3)
        expect(createdSessions[0].recurrence).toEqual(
            expect.objectContaining({ frequency: 'daily', endDate: '2026-03-22' })
        )
    })

    it('renders good recommendations with low utilization, unavailable status, and fallback kv arrays', async () => {
        const user = userEvent.setup()

        useKVMock.mockImplementation((key: string) => {
            if (key === 'sessions') return [undefined, vi.fn()]
            if (key === 'wellness-check-ins') return [undefined, vi.fn()]
            if (key === 'recovery-plans') return [undefined, vi.fn()]
            return ['', vi.fn()]
        })

        findAvailableTrainersMock.mockReturnValueOnce([
            {
                trainer: users[0],
                score: 70,
                matchReasons: ['Steady schedule coverage'],
                conflicts: [],
                availability: 'unavailable',
            },
        ])

        calculateTrainerWorkloadMock.mockReturnValueOnce({ totalHours: 18, utilizationRate: 45 })
        calculateBurnoutRiskMock.mockReturnValueOnce({ risk: 'low', riskScore: 18 })

        renderGuidedScheduler()

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))

        expect(screen.getByText(/good choice/i)).toBeInTheDocument()
        expect(screen.getByText(/^unavailable$/i)).toBeInTheDocument()
        expect(screen.getByText(/^45%$/i)).toHaveClass('text-blue-600')
        expect(calculateTrainerWorkloadMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 't1' }),
            [],
            expect.any(Date),
            expect.any(Date)
        )
        expect(calculateBurnoutRiskMock).toHaveBeenCalledWith('t1', [], [], users, courses)
    })

    it('uses recent wellness check-ins to compute trainer insights', async () => {
        const user = userEvent.setup()
        const wellnessCheckIns: WellnessCheckIn[] = [
            {
                id: 'check-1',
                trainerId: 't1',
                timestamp: '2026-03-19T10:00:00.000Z',
                mood: 5,
                stress: '2',
                workloadSatisfaction: 4,
                notes: 'Feeling solid',
            },
        ]

        useKVMock.mockImplementation((key: string, initialValue: unknown) => {
            if (key === 'sessions') return [[], vi.fn()]
            if (key === 'wellness-check-ins') return [wellnessCheckIns, vi.fn()]
            if (key === 'recovery-plans') return [[], vi.fn()]
            return [initialValue, vi.fn()]
        })

        renderGuidedScheduler()

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))

        expect(calculateBurnoutRiskMock).toHaveBeenCalledWith(
            't1',
            [],
            [expect.objectContaining({ id: 'check-1', stress: '2' })],
            users,
            courses
        )
    })

    it('handles recent wellness check-ins without a stress value', async () => {
        const user = userEvent.setup()
        const wellnessCheckIns: WellnessCheckIn[] = [
            {
                id: 'check-no-stress',
                trainerId: 't1',
                timestamp: '2026-03-19T12:00:00.000Z',
                mood: 4,
                workloadSatisfaction: 5,
                notes: 'No stress score submitted',
            },
        ]

        useKVMock.mockImplementation((key: string, initialValue: unknown) => {
            if (key === 'sessions') return [[], vi.fn()]
            if (key === 'wellness-check-ins') return [wellnessCheckIns, vi.fn()]
            if (key === 'recovery-plans') return [[], vi.fn()]
            return [initialValue, vi.fn()]
        })

        renderGuidedScheduler()

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))

        expect(screen.getByText(/taylor trainer/i)).toBeInTheDocument()
        expect(calculateBurnoutRiskMock).toHaveBeenCalledWith(
            't1',
            [],
            [expect.objectContaining({ id: 'check-no-stress' })],
            users,
            courses
        )
    })

    it('shows overflow date badges when more than five sessions will be created', async () => {
        const user = userEvent.setup()

        renderGuidedScheduler()

        await fillParameters(user)

        const endDateInput = screen.getByLabelText(/end date/i)
        await user.click(endDateInput)
        await user.clear(endDateInput)
        await user.type(endDateInput, '2026-03-26')
        await user.tab()

        await user.click(screen.getByRole('combobox', { name: /recurrence pattern/i }))
        await user.click(screen.getByRole('option', { name: /daily/i }))
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))
        await user.click(screen.getByText(/1\. taylor trainer/i))

        expect(screen.getByText(/7 session\(s\)/i)).toBeInTheDocument()
        expect(screen.getByText('+2 more')).toBeInTheDocument()
    })

    it('shows a success toast even when the selected trainer is no longer resolvable', async () => {
        const user = userEvent.setup()
        const onSessionsCreated = vi.fn()
        const truncatedUsers = [users[0]]

        findAvailableTrainersMock.mockReturnValueOnce([
            {
                trainer: users[1],
                score: 72,
                matchReasons: ['Fallback match'],
                conflicts: [],
                availability: 'available',
            },
        ])

        renderGuidedScheduler({ users: truncatedUsers, onSessionsCreated })

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))
        await user.click(screen.getByText(/1\. uma trainer/i))
        await user.click(screen.getByRole('button', { name: /confirm & schedule/i }))

        expect(onSessionsCreated).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ trainerId: 't2' })])
        )
        expect(toastSuccess).toHaveBeenCalledWith('Successfully scheduled 1 session(s) with undefined!')
    })

    it('renders confirmation details for the selected trainer', async () => {
        const user = userEvent.setup()

        renderGuidedScheduler()

        await fillParameters(user)
        await user.click(screen.getByRole('button', { name: /find & compare trainers/i }))
        await user.click(screen.getByText(/1\. taylor trainer/i))

        const confirmationCard = screen.getByText(/confirm schedule/i).closest('[data-slot="card"]')
        if (!(confirmationCard instanceof HTMLElement)) {
            throw new Error('Unable to locate confirmation card')
        }

        expect(within(confirmationCard).getByText((_, element) => element?.textContent === 'Match Score:90/100')).toBeInTheDocument()
        expect(within(confirmationCard).getByText(/90\/100/i)).toBeInTheDocument()
        expect(within(confirmationCard).getByText(/26\.0h/i)).toBeInTheDocument()
    })
})
