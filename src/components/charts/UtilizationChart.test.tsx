import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UtilizationChart } from './UtilizationChart'

type UtilizationData = Parameters<typeof UtilizationChart>[0]['data'][number]

describe('UtilizationChart', () => {
    it('shows an empty state when no utilization data exists', () => {
        render(<UtilizationChart trainerName="Taylor" data={[]} />)

        expect(screen.getByTestId('utilization-chart')).toBeInTheDocument()
        expect(screen.getByText(/^no utilization data available$/i)).toBeInTheDocument()
    })

    it('renders utilization series data for a trainer', () => {
        render(
            <UtilizationChart
                trainerName="Taylor"
                data={[
                    { date: '2026-03-10', utilization: 71.44, hours: 28.2, sessions: 7 },
                    { date: '2026-03-11', utilization: 74.98, hours: 30.9, sessions: 8 },
                ]}
            />
        )

        expect(screen.getByTestId('utilization-chart')).toBeInTheDocument()
        expect(screen.getByText(/utilization trend for taylor/i)).toBeInTheDocument()
        expect(screen.getByText(/min 71.4%, max 75%, average 73%/i)).toBeInTheDocument()
    })

    it('handles a single data point with identical min and max values', () => {
        render(
            <UtilizationChart
                trainerName="Taylor"
                data={[
                    { date: '2026-03-10', utilization: 71.4, hours: 28.2, sessions: 7 },
                ]}
            />
        )

        expect(screen.getByText(/min 71.4%, max 71.4%, average 71%/i)).toBeInTheDocument()
    })

    it('renders boundary utilization values in the summary', () => {
        render(
            <UtilizationChart
                trainerName="Taylor"
                data={[
                    { date: '2026-03-10', utilization: 0, hours: 0, sessions: 0 },
                    { date: '2026-03-11', utilization: 100, hours: 40, sessions: 10 },
                ]}
            />
        )

        expect(screen.getByText(/min 0%, max 100%, average 50%/i)).toBeInTheDocument()
    })

    it('handles identical utilization values across all points', () => {
        render(
            <UtilizationChart
                trainerName="Taylor"
                data={[
                    { date: '2026-03-10', utilization: 55, hours: 22, sessions: 5 },
                    { date: '2026-03-11', utilization: 55, hours: 22, sessions: 5 },
                    { date: '2026-03-12', utilization: 55, hours: 22, sessions: 5 },
                ]}
            />
        )

        expect(screen.getByText(/min 55%, max 55%, average 55%/i)).toBeInTheDocument()
    })

    it('normalizes negative utilization values without crashing', () => {
        render(
            <UtilizationChart
                trainerName="Taylor"
                data={[
                    { date: '2026-03-10', utilization: -5, hours: 10, sessions: 2 },
                ]}
            />
        )

        expect(screen.getByTestId('utilization-chart')).toBeInTheDocument()
        expect(screen.getByText(/min 0%, max 0%, average 0%/i)).toBeInTheDocument()
    })

    it('clamps utilization values above 100%', () => {
        render(
            <UtilizationChart
                trainerName="Taylor"
                data={[
                    { date: '2026-03-10', utilization: 120, hours: 45, sessions: 11 },
                ]}
            />
        )

        expect(screen.getByTestId('utilization-chart')).toBeInTheDocument()
        expect(screen.getByText(/min 100%, max 100%, average 100%/i)).toBeInTheDocument()
    })

    it('handles missing utilization and hours fields gracefully', () => {
        render(
            <UtilizationChart
                trainerName="Taylor"
                data={[
                    // Intentional cast to simulate malformed runtime input and verify defensive handling.
                    { date: '2026-03-10', utilization: undefined, hours: undefined, sessions: 0 } as UtilizationData,
                ]}
            />
        )

        expect(screen.getByTestId('utilization-chart')).toBeInTheDocument()
        expect(screen.getByText(/min 0%, max 0%, average 0%/i)).toBeInTheDocument()
    })

    it('handles NaN utilization and hours without crashing', () => {
        render(
            <UtilizationChart
                trainerName="Taylor"
                data={[
                    // Intentional cast to simulate upstream division-by-zero producing NaN values.
                    { date: '2026-03-10', utilization: NaN, hours: NaN, sessions: 0 } as UtilizationData,
                ]}
            />
        )

        expect(screen.getByTestId('utilization-chart')).toBeInTheDocument()
        expect(screen.getByText(/min 0%, max 0%, average 0%/i)).toBeInTheDocument()
    })
})
