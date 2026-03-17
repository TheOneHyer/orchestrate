import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BurnoutDashboard } from './BurnoutDashboard'
import type { Course, Session, User, WellnessCheckIn } from '@/lib/types'

const useKVMock = vi.fn()
const calculateTrainerUtilizationMock = vi.fn()
const getUtilizationTrendMock = vi.fn()
const getTrainerHistoryMock = vi.fn()
const getBurnoutRiskLevelMock = vi.fn()

vi.mock('@github/spark/hooks', () => ({
    useKV: (...args: unknown[]) => useKVMock(...args),
}))

vi.mock('@/hooks/use-risk-history', () => ({
    useRiskHistory: () => ({
        getTrainerHistory: (...args: unknown[]) => getTrainerHistoryMock(...args),
    }),
}))

vi.mock('@/lib/burnout-analytics', () => ({
    calculateTrainerUtilization: (...args: unknown[]) => calculateTrainerUtilizationMock(...args),
    getUtilizationTrend: (...args: unknown[]) => getUtilizationTrendMock(...args),
    getBurnoutRiskLevel: (...args: unknown[]) => getBurnoutRiskLevelMock(...args),
}))

vi.mock('@/components/charts/UtilizationChart', () => ({
    UtilizationChart: ({ trainerName }: { trainerName: string }) => <div>UtilizationChart {trainerName}</div>,
}))

vi.mock('@/components/charts/BurnoutRiskGauge', () => ({
    BurnoutRiskGauge: () => <div>BurnoutRiskGauge Mock</div>,
}))

vi.mock('@/components/charts/TrendChart', () => ({
    TrendChart: ({ showAll }: { showAll?: boolean }) => (
        <div>{showAll ? 'TrendChart All' : 'TrendChart Single'}</div>
    ),
}))

vi.mock('@/components/charts/WorkloadDistribution', () => ({
    WorkloadDistribution: () => <div>WorkloadDistribution Mock</div>,
}))

vi.mock('@/components/charts/RiskTrendChart', () => ({
    RiskTrendChart: ({ trainerName }: { trainerName?: string }) => <div>RiskTrendChart {trainerName}</div>,
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
    createUser({ id: 't1', name: 'Taylor Trainer', role: 'trainer' }),
    createUser({ id: 't2', name: 'Uma Trainer', role: 'trainer' }),
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

const checkIns: WellnessCheckIn[] = []
const checkInsWithData: WellnessCheckIn[] = [
    {
        id: 'checkin-1',
        trainerId: 't1',
        timestamp: '2026-03-16T09:00:00.000Z',
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

describe('BurnoutDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        useKVMock.mockImplementation((key: string, initialValue: unknown) => {
            if (key === 'wellness-check-ins') return [checkIns, vi.fn()]
            return [initialValue, vi.fn()]
        })

        calculateTrainerUtilizationMock.mockImplementation((trainer: User) => {
            if (trainer.id === 't1') {
                return {
                    trainerId: 't1',
                    utilizationRate: 92,
                    hoursScheduled: 36,
                    sessionCount: 8,
                    consecutiveDays: 7,
                    riskScore: 88,
                    riskLevel: 'high',
                    factors: [{ factor: 'High load', description: 'Sustained high allocation', impact: 'high' }],
                    recommendations: ['Redistribute sessions'],
                }
            }

            return {
                trainerId: 't2',
                utilizationRate: 52,
                hoursScheduled: 20,
                sessionCount: 4,
                consecutiveDays: 3,
                riskScore: 28,
                riskLevel: 'low',
                factors: [],
                recommendations: ['Maintain current load'],
            }
        })

        getUtilizationTrendMock.mockImplementation((trainer: User) => {
            if (trainer.id === 't1') {
                return {
                    trainerId: 't1',
                    trend: 'increasing',
                    changeRate: 8,
                    dataPoints: [{ date: '2026-03-10', utilization: 85, hours: 34, sessions: 7 }],
                }
            }

            return {
                trainerId: 't2',
                trend: 'stable',
                changeRate: 0,
                dataPoints: [{ date: '2026-03-10', utilization: 50, hours: 20, sessions: 4 }],
            }
        })

        getTrainerHistoryMock.mockReturnValue([
            {
                timestamp: '2026-03-10T00:00:00.000Z',
                riskScore: 70,
                riskLevel: 'high',
                utilizationRate: 88,
                sessionCount: 7,
                hoursScheduled: 35,
            },
        ])

        getBurnoutRiskLevelMock.mockReturnValue('high')
    })

    it('renders top-level metrics and high-risk alert', () => {
        render(
            <BurnoutDashboard
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        expect(screen.getByText(/trainer burnout risk dashboard/i)).toBeInTheDocument()
        expect(screen.getByText(/1 trainer at high burnout risk/i)).toBeInTheDocument()
        expect(screen.getByText(/72\.0%/i)).toBeInTheDocument()
        expect(screen.getByTestId('active-trainers-count')).toHaveTextContent('2')
        expect(screen.getByText(/burnoutriskgauge mock/i)).toBeInTheDocument()
        expect(screen.getByText(/trendchart single/i)).toBeInTheDocument()
    })

    it('shows trainer details empty state before selection', async () => {
        const user = userEvent.setup()

        render(
            <BurnoutDashboard
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getByRole('tab', { name: /trainer details/i }))

        expect(screen.getByText(/select a trainer to view detailed analytics/i)).toBeInTheDocument()
    })

    it('opens selected trainer details via high-priority action and tab switch', async () => {
        const user = userEvent.setup()

        render(
            <BurnoutDashboard
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getByText(/taylor trainer/i))
        await user.click(screen.getByRole('tab', { name: /trainer details/i }))

        expect(screen.getByText(/^risk score$/i)).toBeInTheDocument()
        expect(screen.getByText(/^88$/)).toBeInTheDocument()
        const riskScoreCard = screen.getByText(/^risk score$/i).closest('[data-slot="card"]') as HTMLElement
        expect(within(riskScoreCard).getByText(/^high$/i)).toBeInTheDocument()
        expect(screen.getByText(/utilizationchart taylor trainer/i)).toBeInTheDocument()
        expect(screen.getByText(/risktrendchart taylor trainer/i)).toBeInTheDocument()
        expect(screen.getByText(/redistribute sessions/i)).toBeInTheDocument()
    })

    it('renders trends and distribution tabs with workload summaries', async () => {
        const user = userEvent.setup()

        render(
            <BurnoutDashboard
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getByRole('tab', { name: /trends analysis/i }))
        expect(screen.getByText(/trendchart all/i)).toBeInTheDocument()
        expect(screen.getByText(/trainer status summary/i)).toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: /workload distribution/i }))
        expect(screen.getByText(/workloaddistribution mock/i)).toBeInTheDocument()
        expect(screen.getByText(/overutilized trainers/i)).toBeInTheDocument()
        expect(screen.getByText(/underutilized trainers/i)).toBeInTheDocument()
        expect(screen.getByText(/taylor trainer/i)).toBeInTheDocument()
    })

    it('updates analytics when time range changes', async () => {
        const user = userEvent.setup()

        render(
            <BurnoutDashboard
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        calculateTrainerUtilizationMock.mockClear()

        await user.click(screen.getByRole('combobox', { name: /time range/i }))
        await user.click(screen.getByRole('option', { name: /last 7 days/i }))

        expect(calculateTrainerUtilizationMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 't1' }),
            sessions,
            courses,
            'week',
            checkIns
        )
    })

    it('passes populated wellness check-ins into utilization analytics', () => {
        useKVMock.mockImplementation((key: string, initialValue: unknown) => {
            if (key === 'wellness-check-ins') return [checkInsWithData, vi.fn()]
            return [initialValue, vi.fn()]
        })

        render(
            <BurnoutDashboard
                users={users}
                sessions={sessions}
                courses={courses}
                onNavigate={vi.fn()}
            />
        )

        expect(calculateTrainerUtilizationMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 't1' }),
            sessions,
            courses,
            'month',
            checkInsWithData
        )
        expect(calculateTrainerUtilizationMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 't2' }),
            sessions,
            courses,
            'month',
            checkInsWithData
        )
    })
})
