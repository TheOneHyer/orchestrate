import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TrendChart } from './TrendChart'

describe('TrendChart', () => {
    it('shows fallback when trend data is empty', () => {
        render(<TrendChart data={[]} timeRange="month" />)

        expect(screen.getByText(/no trend data available/i)).toBeInTheDocument()
        expect(screen.getByTestId('trend-chart-empty')).toBeInTheDocument()
    })

    it('renders trend chart for single trainer by default', () => {
        render(
            <TrendChart
                timeRange="month"
                data={[
                    {
                        trainerId: 'trainer-1',
                        trend: 'increasing',
                        changeRate: 9,
                        dataPoints: [
                            { date: '2026-03-10', utilization: 70.25, hours: 28, sessions: 7 },
                            { date: '2026-03-11', utilization: 75.5, hours: 30.5, sessions: 8 },
                        ],
                    },
                ]}
            />
        )

        expect(screen.queryByText(/no trend data available/i)).not.toBeInTheDocument()
        expect(screen.getByTestId('trend-chart')).toBeInTheDocument()
        expect(screen.getByTestId('trend-series-trainer-1')).toBeInTheDocument()
    })

    it('supports multi-trainer mode when showAll is enabled', () => {
        const data = [
            {
                trainerId: 'trainer-1',
                trend: 'stable' as const,
                changeRate: 1,
                dataPoints: [{ date: '2026-03-10', utilization: 70, hours: 28, sessions: 7 }],
            },
            {
                trainerId: 'trainer-2',
                trend: 'decreasing' as const,
                changeRate: -4,
                dataPoints: [{ date: '2026-03-10', utilization: 82, hours: 33, sessions: 9 }],
            },
        ]

        const { rerender } = render(
            <TrendChart
                timeRange="week"
                showAll={true}
                data={data}
            />
        )

        expect(screen.getByTestId('trend-series-trainer-1')).toBeInTheDocument()
        expect(screen.getByTestId('trend-series-trainer-2')).toBeInTheDocument()

        rerender(
            <TrendChart
                timeRange="week"
                showAll={false}
                data={data}
            />
        )

        expect(screen.getByTestId('trend-series-trainer-1')).toBeInTheDocument()
        expect(screen.queryByTestId('trend-series-trainer-2')).not.toBeInTheDocument()
    })
})
