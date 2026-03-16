import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RecoveryPlanDialog } from './RecoveryPlanDialog'
import type { User, WellnessCheckIn } from '@/lib/types'

vi.mock('@/lib/wellness-analytics', () => ({
    calculateWellnessScore: vi.fn(() => 42),
    getRecoveryPlanRecommendations: vi.fn(() => ['Reduce workload', 'Schedule support session']),
}))

const currentUser: User = {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    department: 'Operations',
    certifications: [],
    hireDate: '2024-01-01T00:00:00.000Z',
}

const latestCheckIn: WellnessCheckIn = {
    id: 'checkin-1',
    trainerId: 'trainer-1',
    timestamp: '2026-03-15T12:00:00.000Z',
    mood: 2,
    stress: 'high',
    energy: 'tired',
    workloadSatisfaction: 2,
    sleepQuality: 3,
    physicalWellbeing: 3,
    mentalClarity: 2,
    concerns: ['Work-life balance', 'Too many sessions scheduled'],
    followUpRequired: true,
}

describe('RecoveryPlanDialog', () => {
    const baseProps = {
        open: true,
        onClose: vi.fn(),
        trainerId: 'trainer-1',
        trainerName: 'Taylor Trainer',
        currentUser,
        onSubmit: vi.fn(),
    }

    it('starts with disabled submit when no trigger reason and no actions exist', () => {
        render(<RecoveryPlanDialog {...baseProps} />)

        expect(screen.getByText(/no actions added yet/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /create recovery plan/i })).toBeDisabled()
    })

    it('auto-populates reason and actions from high-risk latest check-in', () => {
        render(
            <RecoveryPlanDialog
                {...baseProps}
                latestCheckIn={latestCheckIn}
                currentUtilization={90}
            />
        )

        expect(screen.getByDisplayValue(/wellness score: 42\/100/i)).toBeInTheDocument()
        expect(screen.getByDisplayValue(/high stress level/i)).toBeInTheDocument()
        expect(screen.getByDisplayValue(/utilization at 90%/i)).toBeInTheDocument()
        expect(screen.getByText(/workload reduction/i)).toBeInTheDocument()
        expect(screen.getByText(/provide 3-5 consecutive days of paid time off/i)).toBeInTheDocument()
        expect(screen.getByText(/support session/i)).toBeInTheDocument()
    })

    it('submits plan payload with generated action ids when auto-filled data exists', async () => {
        const onSubmit = vi.fn()

        render(
            <RecoveryPlanDialog
                {...baseProps}
                latestCheckIn={latestCheckIn}
                currentUtilization={90}
                onSubmit={onSubmit}
            />
        )

        await userEvent.click(screen.getByRole('button', { name: /create recovery plan/i }))

        expect(onSubmit).toHaveBeenCalledOnce()
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                trainerId: 'trainer-1',
                createdBy: 'admin-1',
                status: 'active',
                targetUtilization: 70,
                currentUtilization: 90,
                actions: expect.arrayContaining([
                    expect.objectContaining({
                        id: expect.stringMatching(/^action-/),
                        completed: false,
                    }),
                ]),
            })
        )
    })

    it('renders latest check-in summary panel when provided', () => {
        render(
            <RecoveryPlanDialog
                {...baseProps}
                latestCheckIn={latestCheckIn}
            />
        )

        expect(screen.getByText(/latest check-in summary/i)).toBeInTheDocument()
        expect(screen.getByText(/mood:/i)).toBeInTheDocument()
        expect(screen.getByText(/stress:/i)).toBeInTheDocument()
        expect(screen.getByText(/concerns:/i)).toBeInTheDocument()
    })

    it('calls onClose when cancel is clicked', async () => {
        const onClose = vi.fn()

        render(
            <RecoveryPlanDialog
                {...baseProps}
                latestCheckIn={latestCheckIn}
                onClose={onClose}
            />
        )

        await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

        expect(onClose).toHaveBeenCalledOnce()
    })
})
