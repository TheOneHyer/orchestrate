import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WorkloadDistribution } from './WorkloadDistribution'

describe('WorkloadDistribution', () => {
    it('shows empty state when there is no workload data', () => {
        render(<WorkloadDistribution data={[]} trainers={[]} />)

        expect(screen.getByText(/no workload data available/i)).toBeInTheDocument()
    })

    it('renders workload chart when utilization rows are provided', () => {
        render(
            <WorkloadDistribution
                trainers={[
                    {
                        id: 'trainer-1',
                        name: 'Taylor',
                        email: 'taylor@example.com',
                        role: 'trainer',
                        department: 'Operations',
                        certifications: [],
                        hireDate: '2020-01-01T00:00:00.000Z',
                    },
                ]}
                data={[
                    {
                        trainerId: 'trainer-1',
                        utilizationRate: 96,
                        hoursScheduled: 43.5,
                        sessionCount: 10,
                        consecutiveDays: 8,
                        riskScore: 82,
                        riskLevel: 'critical',
                        factors: [],
                        recommendations: [],
                    },
                ]}
            />
        )

        expect(screen.queryByText(/no workload data available/i)).not.toBeInTheDocument()
        expect(screen.getByTestId('workload-chart')).toBeInTheDocument()
    })
})
