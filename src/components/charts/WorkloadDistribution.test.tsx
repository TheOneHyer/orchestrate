import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WorkloadDistribution } from './WorkloadDistribution'

vi.mock('recharts', async () => {
    const actual = await vi.importActual<typeof import('recharts')>('recharts')
    return {
        ...actual,
        Tooltip: ({ formatter }: { formatter?: (value: number, name: string) => unknown }) => {
            // Invoke the formatter with all four name values so every branch in the
            // component's formatter callback is exercised during each render.
            if (formatter) {
                formatter('75' as unknown as number, 'utilization')
                formatter(40, 'hours')
                formatter(10, 'sessions')
                formatter(5, 'other')
            }
            return null
        },
    }
})

describe('WorkloadDistribution', () => {
    const mockTrainer = {
        id: 'trainer-1',
        name: 'Taylor',
        email: 'taylor@example.com',
        role: 'trainer' as const,
        department: 'Operations',
        certifications: [],
        hireDate: '2020-01-01T00:00:00.000Z',
    }

    const mockWorkloadData = {
        trainerId: 'trainer-1',
        utilizationRate: 96,
        hoursScheduled: 43.5,
        sessionCount: 10,
        consecutiveDays: 8,
        riskScore: 82,
        riskLevel: 'critical' as const,
        factors: [],
        recommendations: [],
    }

    it('shows empty state when there is no workload data', () => {
        render(<WorkloadDistribution data={[]} trainers={[]} />)

        expect(screen.getByText(/no workload data available/i)).toBeInTheDocument()
    })

    it('renders workload chart when utilization rows are provided', () => {
        render(
            <WorkloadDistribution
                trainers={[mockTrainer]}
                data={[mockWorkloadData]}
            />
        )

        expect(screen.queryByText(/no workload data available/i)).not.toBeInTheDocument()
        expect(screen.getByTestId('workload-chart')).toBeInTheDocument()
        expect(screen.getByText(/taylor: 96% utilization, 43.5 hours/i)).toBeInTheDocument()
    })

    it('renders rows for multiple trainers', () => {
        const trainerTwo = {
            ...mockTrainer,
            id: 'trainer-2',
            name: 'Jordan',
            email: 'jordan@example.com',
        }

        render(
            <WorkloadDistribution
                trainers={[mockTrainer, trainerTwo]}
                data={[
                    mockWorkloadData,
                    {
                        ...mockWorkloadData,
                        trainerId: 'trainer-2',
                        utilizationRate: 72,
                        hoursScheduled: 31,
                        riskLevel: 'medium',
                    },
                ]}
            />
        )

        expect(screen.getByText(/taylor: 96% utilization, 43.5 hours/i)).toBeInTheDocument()
        expect(screen.getByText(/jordan: 72% utilization, 31 hours/i)).toBeInTheDocument()
    })

    it('shows 0% and 100% utilization boundary values with hours', () => {
        const trainerTwo = {
            ...mockTrainer,
            id: 'trainer-2',
            name: 'Casey',
            email: 'casey@example.com',
        }

        render(
            <WorkloadDistribution
                trainers={[mockTrainer, trainerTwo]}
                data={[
                    {
                        ...mockWorkloadData,
                        trainerId: 'trainer-1',
                        utilizationRate: 0,
                        hoursScheduled: 0,
                        riskLevel: 'low',
                    },
                    {
                        ...mockWorkloadData,
                        trainerId: 'trainer-2',
                        utilizationRate: 100,
                        hoursScheduled: 40,
                        riskLevel: 'critical',
                    },
                ]}
            />
        )

        expect(screen.getByText(/taylor: 0% utilization, 0 hours/i)).toBeInTheDocument()
        expect(screen.getByText(/casey: 100% utilization, 40 hours/i)).toBeInTheDocument()
    })

    it('renders risk indicator classes for low, medium, high, and critical utilization', () => {
        const trainerTwo = { ...mockTrainer, id: 'trainer-2', name: 'Jordan', email: 'jordan@example.com' }
        const trainerThree = { ...mockTrainer, id: 'trainer-3', name: 'Casey', email: 'casey@example.com' }
        const trainerFour = { ...mockTrainer, id: 'trainer-4', name: 'Morgan', email: 'morgan@example.com' }

        const { container } = render(
            <WorkloadDistribution
                trainers={[mockTrainer, trainerTwo, trainerThree, trainerFour]}
                data={[
                    { ...mockWorkloadData, trainerId: 'trainer-1', utilizationRate: 60, riskLevel: 'low' },
                    { ...mockWorkloadData, trainerId: 'trainer-2', utilizationRate: 75, riskLevel: 'medium' },
                    { ...mockWorkloadData, trainerId: 'trainer-3', utilizationRate: 90, riskLevel: 'high' },
                    { ...mockWorkloadData, trainerId: 'trainer-4', utilizationRate: 99, riskLevel: 'critical' },
                ]}
            />
        )

        expect(container.querySelector('.risk-indicator-low')).toBeTruthy()
        expect(container.querySelector('.risk-indicator-medium')).toBeTruthy()
        expect(container.querySelector('.risk-indicator-high')).toBeTruthy()
        expect(container.querySelector('.risk-indicator-critical')).toBeTruthy()
    })

    it('falls back to Unknown when trainer metadata is missing', () => {
        render(
            <WorkloadDistribution
                trainers={[]}
                data={[mockWorkloadData]}
            />
        )

        expect(screen.getByText(/unknown: 96% utilization, 43\.5 hours/i)).toBeInTheDocument()
    })
})
