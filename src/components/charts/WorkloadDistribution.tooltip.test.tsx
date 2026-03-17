import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('recharts', () => {
    const PassThrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>

    return {
        ResponsiveContainer: PassThrough,
        BarChart: PassThrough,
        Bar: PassThrough,
        XAxis: PassThrough,
        YAxis: PassThrough,
        CartesianGrid: PassThrough,
        ReferenceLine: PassThrough,
        Cell: () => null,
        Tooltip: ({ formatter }: { formatter?: (value: number, name: string) => [unknown, string] }) => {
            if (!formatter) return null

            const labels = [
                formatter(75, 'utilization')[1],
                formatter(40, 'hours')[1],
                formatter(10, 'sessions')[1],
                formatter(5, 'other')[1],
            ]

            return <div data-testid="tooltip-formatter-labels">{labels.join('|')}</div>
        },
    }
})

describe('WorkloadDistribution tooltip formatter', () => {
    it('formats utilization, hours, sessions, and fallback tooltip labels', async () => {
        const { WorkloadDistribution } = await import('./WorkloadDistribution')

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

        expect(screen.getByTestId('tooltip-formatter-labels')).toHaveTextContent('Utilization|Hours|Sessions|other')
    })
})
