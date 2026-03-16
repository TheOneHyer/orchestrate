import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BurnoutRiskGauge } from './BurnoutRiskGauge'

describe('BurnoutRiskGauge', () => {
    it('shows empty state when there is no data', () => {
        render(<BurnoutRiskGauge data={[]} />)

        expect(screen.getByText(/no data available/i)).toBeInTheDocument()
        expect(screen.getByTestId('burnout-risk-gauge-empty')).toBeInTheDocument()
    })

    it('renders chart container when utilization data is present', () => {
        render(
            <BurnoutRiskGauge
                data={[
                    {
                        trainerId: 't1',
                        utilizationRate: 62,
                        hoursScheduled: 24,
                        sessionCount: 6,
                        consecutiveDays: 4,
                        riskScore: 20,
                        riskLevel: 'low',
                        factors: [],
                        recommendations: [],
                    },
                    {
                        trainerId: 't3',
                        utilizationRate: 76,
                        hoursScheduled: 31,
                        sessionCount: 8,
                        consecutiveDays: 5,
                        riskScore: 40,
                        riskLevel: 'moderate',
                        factors: [],
                        recommendations: [],
                    },
                    {
                        trainerId: 't4',
                        utilizationRate: 89,
                        hoursScheduled: 36,
                        sessionCount: 10,
                        consecutiveDays: 7,
                        riskScore: 62,
                        riskLevel: 'high',
                        factors: [],
                        recommendations: [],
                    },
                    {
                        trainerId: 't2',
                        utilizationRate: 97,
                        hoursScheduled: 50,
                        sessionCount: 12,
                        consecutiveDays: 9,
                        riskScore: 88,
                        riskLevel: 'critical',
                        factors: [],
                        recommendations: [],
                    },
                ]}
            />
        )

        expect(screen.queryByText(/no data available/i)).not.toBeInTheDocument()
        expect(screen.getByTestId('burnout-risk-gauge')).toBeInTheDocument()
        expect(screen.getByTestId('burnout-risk-gauge-chart')).toBeInTheDocument()
        expect(screen.getByTestId('burnout-risk-gauge-chart')).toHaveTextContent('1 Low Risk')
        expect(screen.getByTestId('burnout-risk-gauge-chart')).toHaveTextContent('1 Medium Risk')
        expect(screen.getByTestId('burnout-risk-gauge-chart')).toHaveTextContent('1 High Risk')
        expect(screen.getByTestId('burnout-risk-gauge-chart')).toHaveTextContent('1 Critical Risk')
    })
})
