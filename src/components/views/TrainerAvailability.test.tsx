import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { TrainerAvailability } from './TrainerAvailability'
import type { Course, Session, User } from '@/lib/types'

vi.mock('@/components/WorkloadRecommendations', () => ({
    WorkloadRecommendations: ({ onViewTrainer }: { onViewTrainer: (trainerId: string) => void }) => (
        <div>
            <p>WorkloadRecommendations Mock</p>
            <button onClick={() => onViewTrainer('t1')}>Mock View Trainer</button>
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
            shiftSchedules: [{ shiftCode: 'DAY', daysWorked: ['monday', 'tuesday'], startTime: '08:00', endTime: '16:00', totalHoursPerWeek: 16 }],
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

describe('TrainerAvailability', () => {
    it('renders aggregate stats and navigates to schedule view', async () => {
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

        const activeTrainerCard = screen.getByTestId('active-trainers-card')
        expect(within(activeTrainerCard).getByText('2')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /view schedule/i }))
        expect(onNavigate).toHaveBeenCalledWith('schedule')
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
})
