import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { TrainerAvailability } from './TrainerAvailability'
import type { Course, Session, User } from '@/lib/types'
import type { WorkloadRecommendation } from '@/lib/workload-balancer'

vi.mock('@/components/WorkloadRecommendations', () => ({
    WorkloadRecommendations: ({
        onViewTrainer,
        onApplyRecommendation,
    }: {
        onViewTrainer: (trainerId: string) => void
        onApplyRecommendation?: (recommendation: WorkloadRecommendation) => void
    }) => (
        <div>
            <p>WorkloadRecommendations Mock</p>
            <button onClick={() => onViewTrainer('t1')}>Mock View Trainer</button>
            <button onClick={() => onViewTrainer('missing-trainer')}>Mock Missing Trainer</button>
            <button
                onClick={() => onApplyRecommendation?.({
                    type: 'redistribute',
                    priority: 'high',
                    title: 'Redistribute high load',
                    description: 'Move sessions from overloaded trainer to available trainer.',
                    affectedTrainers: ['t1'],
                    actionable: true,
                    potentialSavings: 6,
                })}
            >
                Mock Apply Recommendation
            </button>
        </div>
    ),
}))

vi.mock('@/components/TrainerCoverageHeatmap', () => ({
    TrainerCoverageHeatmap: () => <div>TrainerCoverageHeatmap Mock</div>,
}))

vi.mock('@/components/UnconfiguredScheduleAlert', () => ({
    UnconfiguredScheduleAlert: ({ user }: { user: User }) => <div>UnconfiguredScheduleAlert {user.name}</div>,
}))

vi.mock('@/components/ui/sheet', () => ({
    Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => <div>{open ? children : null}</div>,
    SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
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

const courses: Course[] = [
    {
        id: 'c1',
        title: 'Safety Foundations',
        description: 'Course',
        modules: ['Intro'],
        duration: 60,
        certifications: [],
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
        email: 'taylor@example.com',
        role: 'trainer',
        certifications: ['CPR'],
        trainerProfile: {
            authorizedRoles: [],
            shiftSchedules: [{
                shiftCode: 'DAY', daysWorked: ['monday', 'tuesday'], startTime: '08:00', endTime: '16:00', totalHoursPerWeek: 16,
                shiftType: 'day'
            }],
            tenure: { hireDate: '2020-01-01', yearsOfService: 6, monthsOfService: 72 },
            specializations: [],
        },
    }),
    createUser({ id: 't2', name: 'Uma Trainer', email: 'uma@example.com', role: 'trainer', certifications: ['Forklift'] }),
    createUser({ id: 'e1', name: 'Employee User', email: 'employee@example.com', role: 'employee' }),
]

const sessions: Session[] = [
    {
        id: 's1',
        courseId: 'c1',
        trainerId: 't1',
        title: 'Morning Safety Session',
        startTime: '2026-03-17T09:00:00.000Z',
        endTime: '2026-03-17T11:00:00.000Z',
        location: 'Room A',
        capacity: 10,
        enrolledStudents: ['e1'],
        status: 'scheduled',
    },
]

function makeSession(id: string, trainerId: string, start: Date, durationHours: number): Session {
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000)

    return {
        id,
        courseId: 'c1',
        trainerId,
        title: `Session ${id}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        location: 'Room A',
        capacity: 10,
        enrolledStudents: ['e1'],
        status: 'scheduled',
    }
}

describe('TrainerAvailability', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2026-03-20T12:00:00.000Z'))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders aggregate stats and navigates to schedule view', async () => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()

        render(
            <main>
                <TrainerAvailability
                    users={users}
                    sessions={sessions}
                    courses={courses}
                    onNavigate={onNavigate}
                />
            </main>
        )

        const activeTrainerCard = screen.getByTestId('active-trainers-card')
        expect(within(activeTrainerCard).getByText('2')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /view schedule/i }))
        expect(onNavigate).toHaveBeenCalledWith('schedule')

        const { axe } = await import('vitest-axe')
        expect(await axe(document.body)).toHaveNoViolations()
    })

    it('filters trainers by search query and shows empty state', async () => {
        const user = userEvent.setup()
        render(
            <TrainerAvailability
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        await user.type(screen.getByPlaceholderText(/search trainers/i), 'no-match')

        expect(screen.getByText(/no trainers found matching your filters/i)).toBeInTheDocument()
    })

    it('navigates to session details when a session is clicked in the calendar', async () => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()

        render(
            <TrainerAvailability
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={onNavigate}
            />
        )

        await user.click(screen.getByRole('button', { name: /morning safety session/i }))

        expect(onNavigate).toHaveBeenCalledWith('schedule', { sessionId: 's1' })
    })

    it('renders work-schedule tab content including heatmap and off-day cells', async () => {
        const user = userEvent.setup()

        render(
            <TrainerAvailability
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getByRole('tab', { name: /work schedule/i }))

        expect(screen.getByText(/trainercoverageheatmap mock/i)).toBeInTheDocument()
        expect(screen.getByText(/weekly work schedule/i)).toBeInTheDocument()
        expect(screen.getAllByText('Off')).toHaveLength(12)
    })

    it('opens trainer detail sheet via workload recommendations callback', async () => {
        const user = userEvent.setup()

        render(
            <TrainerAvailability
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getByRole('tab', { name: /workload balance/i }))

        expect(screen.getByText(/workloadrecommendations mock/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /mock view trainer/i }))

        expect(screen.getByRole('heading', { name: /taylor trainer/i })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /availability/i, level: 3 })).toBeInTheDocument()
    })

    it('does not open trainer detail sheet for missing workload recommendation trainer id', async () => {
        const user = userEvent.setup()

        render(
            <TrainerAvailability
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getByRole('tab', { name: /workload balance/i }))
        await user.click(screen.getByRole('button', { name: /mock missing trainer/i }))

        expect(screen.queryByRole('heading', { name: /taylor trainer/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: /uma trainer/i })).not.toBeInTheDocument()
    })

    it('opens recommendation details dialog and can open schedule context', async () => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()

        render(
            <TrainerAvailability
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={onNavigate}
            />
        )

        await user.click(screen.getByRole('tab', { name: /workload balance/i }))
        await user.click(screen.getByRole('button', { name: /mock apply recommendation/i }))

        expect(screen.getByRole('heading', { name: /redistribute high load/i })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /open schedule context/i }))

        expect(onNavigate).toHaveBeenCalledTimes(1)
        expect(onNavigate).toHaveBeenLastCalledWith('schedule', {
            recommendationType: 'redistribute',
            affectedTrainers: ['t1'],
        })
    })

    it('filters by certification and restores all trainers when filter is cleared', async () => {
        const user = userEvent.setup()

        render(
            <TrainerAvailability
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getAllByRole('combobox')[0])
        await user.click(screen.getByRole('option', { name: /^CPR$/i }))

        expect(screen.getByText(/taylor trainer/i)).toBeInTheDocument()
        expect(screen.queryByText(/uma trainer/i)).not.toBeInTheDocument()

        const clearButton = screen.getByRole('button', { name: /clear/i })

        await user.click(clearButton)

        expect(screen.getByText(/uma trainer/i)).toBeInTheDocument()
    })

    it('shows schedule and certification fallback text for trainers without profile details', async () => {
        const user = userEvent.setup()
        const usersWithFallbackTrainer = [
            users[0],
            {
                ...users[1],
                certifications: [],
                trainerProfile: {
                    authorizedRoles: [],
                    shiftSchedules: [],
                    tenure: {
                        hireDate: '2024-01-01',
                        yearsOfService: 2,
                        monthsOfService: 24,
                    },
                    specializations: [],
                },
            },
            users[2],
        ]

        render(
            <TrainerAvailability
                users={usersWithFallbackTrainer}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: /uma trainer/i }))

        expect(screen.getByText(/no detailed work schedule configured/i)).toBeInTheDocument()
        expect(screen.getByText(/no certifications/i)).toBeInTheDocument()
    })

    it('renders authorized roles in trainer detail sheet when present', async () => {
        const user = userEvent.setup()
        const usersWithRoles = [
            {
                ...users[0],
                trainerProfile: {
                    ...users[0].trainerProfile!,
                    authorizedRoles: ['Safety Instructor'],
                },
            },
            users[1],
            users[2],
        ]

        render(
            <TrainerAvailability
                users={usersWithRoles}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: /taylor trainer/i }))

        expect(screen.getByText(/authorized to teach/i)).toBeInTheDocument()
        expect(screen.getByText(/safety instructor/i)).toBeInTheDocument()
    })

    it('navigates from upcoming sessions in trainer detail sheet', async () => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()
        const futureSession: Session = {
            ...sessions[0],
            id: 'future-1',
            title: 'Future Session',
            startTime: '2099-01-01T09:00:00.000Z',
            endTime: '2099-01-01T10:00:00.000Z',
        }

        render(
            <TrainerAvailability
                users={users}
                sessions={[futureSession]}
                courses={courses}
                onNavigate={onNavigate}
            />
        )

        await user.click(screen.getByRole('button', { name: /taylor trainer/i }))
        await user.click(screen.getByRole('button', { name: /future session/i }))

        expect(onNavigate).toHaveBeenCalledWith('schedule', { sessionId: 'future-1' })
    })

    it('applies red over-utilized card style when at least one trainer is over 90% utilization', () => {
        const now = new Date()
        now.setHours(8, 0, 0, 0)

        const heavySessions = [
            makeSession('over-1', 't1', new Date(now), 40),
        ]

        render(
            <TrainerAvailability
                users={users}
                sessions={heavySessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        const overutilizedCard = screen.getByText(/over-utilized/i).closest('[data-slot="card"]')
        if (!(overutilizedCard instanceof HTMLElement)) {
            throw new Error('Over-utilized card element not found')
        }
        expect(within(overutilizedCard).getByText('1')).toHaveClass('text-red-600')
    })

    it('applies utilization color thresholds for high, medium, and moderate loads', () => {
        const now = new Date()
        now.setHours(8, 0, 0, 0)

        const extraTrainer = createUser({
            id: 't3',
            name: 'Kai Trainer',
            email: 'kai@example.com',
            role: 'trainer',
            certifications: ['CPR'],
        })

        const thresholdSessions = [
            makeSession('high', 't1', new Date(now), 40),
            makeSession('medium', 't2', new Date(now), 30),
            makeSession('moderate', 't3', new Date(now), 16),
        ]

        render(
            <TrainerAvailability
                users={[users[0], users[1], extraTrainer, users[2]]}
                sessions={thresholdSessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        expect(screen.getByText('100% utilized')).toHaveAttribute('data-utilization', 'high')
        expect(screen.getByText('75% utilized')).toHaveAttribute('data-utilization', 'medium')
        expect(screen.getByText('40% utilized')).toHaveAttribute('data-utilization', 'low')
    })
})
