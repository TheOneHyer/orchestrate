import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RiskTrendChart } from './RiskTrendChart'

describe('RiskTrendChart', () => {
    it('shows fallback when no historical points are provided', () => {
        render(<RiskTrendChart data={[]} />)

        expect(screen.getByText(/no historical data available/i)).toBeInTheDocument()
        expect(screen.getByText(/risk tracking will appear as data is collected/i)).toBeInTheDocument()
        expect(screen.getByTestId('risk-trend-chart-empty')).toBeInTheDocument()
    })

    const mockDataPoint = {
        date: '2026-03-10T00:00:00.000Z',
        riskScore: 32,
        riskLevel: 'medium' as const,
        utilizationRate: 78,
        sessionCount: 7,
        hoursScheduled: 29,
    }

    it('renders chart shell and trainer context when data exists', () => {
        render(
            <RiskTrendChart
                trainerName="Taylor"
                showUtilization={true}
                data={[
                    mockDataPoint,
                    { ...mockDataPoint, date: '2026-03-15T00:00:00.000Z', riskScore: 58, riskLevel: 'high' as const, utilizationRate: 91, sessionCount: 11, hoursScheduled: 41 },
                ]}
            />
        )

        expect(screen.getByText(/tracking taylor's risk level over time/i)).toBeInTheDocument()
        expect(screen.queryByText(/no historical data available/i)).not.toBeInTheDocument()
        expect(screen.getByTestId('risk-trend-chart')).toBeInTheDocument()
        expect(screen.getByTestId('utilization-series')).toBeInTheDocument()
    })

    it('hides utilization series marker when showUtilization is false', () => {
        render(
            <RiskTrendChart
                trainerName="Taylor"
                showUtilization={false}
                data={[mockDataPoint]}
            />
        )

        expect(screen.getByTestId('risk-trend-chart')).toBeInTheDocument()
        expect(screen.queryByTestId('utilization-series')).not.toBeInTheDocument()
    })
})
