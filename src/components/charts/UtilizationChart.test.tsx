import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UtilizationChart } from './UtilizationChart'

describe('UtilizationChart', () => {
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
        expect(screen.getByText(/min 71.4%, max 75%/i)).toBeInTheDocument()
    })
})
