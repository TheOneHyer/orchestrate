import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

let tooltipRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'critical'

vi.mock('recharts', () => {
    const PassThrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>

    return {
        ResponsiveContainer: PassThrough,
        AreaChart: PassThrough,
        LineChart: PassThrough,
        Area: PassThrough,
        Line: PassThrough,
        XAxis: PassThrough,
        YAxis: PassThrough,
        CartesianGrid: PassThrough,
        Legend: PassThrough,
        ReferenceLine: PassThrough,
        Tooltip: ({ content }: { content?: React.ReactElement }) => {
            if (!content) return null

            const payloadPoint = {
                fullDate: 'March 16, 2026',
                'Risk Score': 88,
                'Utilization %': 91.2,
                sessions: 5,
                hours: 12,
                riskLevel: tooltipRiskLevel,
            }

            return (
                <>
                    {React.cloneElement(content as React.ReactElement<any>, { active: false, payload: [] })}
                    {React.cloneElement(content as React.ReactElement<any>, { active: true, payload: [{ payload: payloadPoint }] })}
                </>
            )
        },
    }
})

describe('RiskTrendChart custom tooltip', () => {
    it('renders tooltip details and critical styling path when tooltip is active', async () => {
        tooltipRiskLevel = 'critical'
        const { RiskTrendChart } = await import('./RiskTrendChart')

        render(
            <RiskTrendChart
                showUtilization={true}
                data={[
                    {
                        date: '2026-03-10T00:00:00.000Z',
                        riskScore: 32,
                        riskLevel: 'medium',
                        utilizationRate: 78,
                        sessionCount: 7,
                        hoursScheduled: 29,
                    },
                ]}
            />
        )

        expect(screen.getByText('March 16, 2026')).toBeInTheDocument()
        expect(screen.getByText('Risk Score:')).toBeInTheDocument()
        expect(screen.getByText('Utilization:')).toBeInTheDocument()
        expect(screen.getByText('critical')).toBeInTheDocument()
    })

    it('renders tooltip risk-level chip for non-critical values', async () => {
        const { RiskTrendChart } = await import('./RiskTrendChart')

        for (const level of ['high', 'medium', 'low'] as const) {
            tooltipRiskLevel = level

            const { unmount } = render(
                <RiskTrendChart
                    showUtilization={false}
                    data={[
                        {
                            date: '2026-03-10T00:00:00.000Z',
                            riskScore: 32,
                            riskLevel: 'medium',
                            utilizationRate: 78,
                            sessionCount: 7,
                            hoursScheduled: 29,
                        },
                    ]}
                />
            )

            expect(screen.getByText(level)).toBeInTheDocument()
            unmount()
        }
    })
})
