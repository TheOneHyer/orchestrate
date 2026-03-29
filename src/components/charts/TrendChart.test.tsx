import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TrendChart } from './TrendChart'

describe('TrendChart', () => {
    const TEST_DATA = [
        {
            trainerId: 'trainer-1',
            trend: 'stable' as const,
            changeRate: 1,
            dataPoints: [
                { date: '2026-03-10', utilization: 70, hours: 28, sessions: 7 },
                { date: '2026-03-11', utilization: 72, hours: 29, sessions: 7 },
            ],
        },
        {
            trainerId: 'trainer-2',
            trend: 'decreasing' as const,
            changeRate: -4,
            dataPoints: [
                { date: '2026-03-10', utilization: 82, hours: 33, sessions: 9 },
                { date: '2026-03-11', utilization: 79, hours: 32, sessions: 8 },
            ],
        },
    ]

    it('shows fallback when trend data is empty', () => {
        render(<TrendChart data={[]} timeRange="month" />)

        expect(screen.getByText(/no trend data available/i)).toBeInTheDocument()
        expect(screen.getByTestId('trend-chart-empty')).toBeInTheDocument()
    })

    it('renders trend chart with single trainer data', () => {
        render(
            <TrendChart
                timeRange="month"
                data={[
                    {
                        trainerId: 'trainer-1',
                        trend: 'increasing' as const,
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

    it('applies timeRange filtering to trainer trend summary', () => {
        const rangeSensitiveData = [
            {
                trainerId: 'trainer-1',
                trend: 'increasing' as const,
                changeRate: 4,
                dataPoints: [
                    { date: '2026-02-20', utilization: 40, hours: 16, sessions: 4 },
                    { date: '2026-03-10', utilization: 80, hours: 32, sessions: 8 },
                ],
            },
        ]

        const { rerender } = render(
            <TrendChart
                timeRange="week"
                data={rangeSensitiveData}
            />
        )

        expect(screen.getByTestId('trend-series-trainer-1')).toHaveTextContent(/average 80.0%, trend flat/i)

        rerender(
            <TrendChart
                timeRange="month"
                data={rangeSensitiveData}
            />
        )

        expect(screen.getByTestId('trend-series-trainer-1')).toHaveTextContent(/average 60.0%, trend up/i)
    })

    it('renders all trainers when showAll is enabled', () => {
        render(
            <TrendChart
                timeRange="week"
                showAll={true}
                data={TEST_DATA}
            />
        )

        expect(screen.getByTestId('trend-series-trainer-1')).toBeInTheDocument()
        expect(screen.getByTestId('trend-series-trainer-2')).toBeInTheDocument()
    })

    it('shows only the first trainer when showAll is disabled', () => {
        render(
            <TrendChart
                timeRange="week"
                showAll={false}
                data={TEST_DATA}
            />
        )

        expect(screen.getByTestId('trend-series-trainer-1')).toBeInTheDocument()
        expect(screen.queryByTestId('trend-series-trainer-2')).not.toBeInTheDocument()
    })

    it('defaults to a single trainer series when showAll is omitted', () => {
        render(<TrendChart timeRange="week" data={TEST_DATA} />)

        expect(screen.getByTestId('trend-series-trainer-1')).toBeInTheDocument()
        expect(screen.queryByTestId('trend-series-trainer-2')).not.toBeInTheDocument()
    })

    it('uses quarter range and falls back to zero-summary values for invalid-date secondary series', () => {
        render(
            <TrendChart
                timeRange="quarter"
                showAll={true}
                data={[
                    {
                        trainerId: 'trainer-1',
                        trend: 'increasing' as const,
                        changeRate: 6,
                        dataPoints: [
                            { date: '2026-01-10', utilization: 62, hours: 25, sessions: 6 },
                            { date: '2026-03-11', utilization: 74, hours: 30, sessions: 8 },
                        ],
                    },
                    {
                        trainerId: 'trainer-2',
                        trend: 'stable' as const,
                        changeRate: 0,
                        dataPoints: [
                            { date: 'invalid-date', utilization: 99, hours: 40, sessions: 10 },
                        ],
                    },
                ]}
            />
        )

        expect(screen.getByTestId('trend-series-trainer-1')).toHaveTextContent(/average 68\.0%, trend up/i)
        expect(screen.getByTestId('trend-series-trainer-2')).toHaveTextContent(/latest 0\.0%, average 0\.0%, trend flat/i)
    })

    it('falls back to zero-summary values for truly empty secondary series', () => {
        render(
            <TrendChart
                timeRange="quarter"
                showAll={true}
                data={[
                    {
                        trainerId: 'trainer-1',
                        trend: 'increasing' as const,
                        changeRate: 6,
                        dataPoints: [
                            { date: '2026-01-10', utilization: 62, hours: 25, sessions: 6 },
                            { date: '2026-03-11', utilization: 74, hours: 30, sessions: 8 },
                        ],
                    },
                    {
                        trainerId: 'trainer-2',
                        trend: 'stable' as const,
                        changeRate: 0,
                        dataPoints: [],
                    },
                ]}
            />
        )

        expect(screen.getByTestId('trend-series-trainer-1')).toHaveTextContent(/average 68\.0%, trend up/i)
        expect(screen.getByTestId('trend-series-trainer-2')).toHaveTextContent(/latest 0\.0%, average 0\.0%, trend flat/i)
    })

    it('falls back to empty data points for all-invalid-date series', () => {
        render(
            <TrendChart
                timeRange="month"
                showAll={true}
                data={[
                    {
                        trainerId: 'trainer-1',
                        trend: 'stable' as const,
                        changeRate: 0,
                        dataPoints: [
                            { date: 'not-a-date', utilization: 70, hours: 28, sessions: 7 },
                        ],
                    },
                    {
                        trainerId: 'trainer-2',
                        trend: 'stable' as const,
                        changeRate: 0,
                        dataPoints: [
                            { date: 'also-invalid', utilization: 80, hours: 32, sessions: 8 },
                        ],
                    },
                ]}
            />
        )

        expect(screen.getByTestId('trend-chart-empty')).toBeInTheDocument()
        expect(screen.getByText(/no trend data available/i)).toBeInTheDocument()
    })
})
