import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RecoveryPlanDialog } from './RecoveryPlanDialog'
import { calculateWellnessScore, getRecoveryPlanRecommendations } from '@/lib/wellness-analytics'
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
    let user: ReturnType<typeof userEvent.setup>
    let baseProps: {
        open: boolean
        onClose: ReturnType<typeof vi.fn>
        trainerId: string
        trainerName: string
        currentUser: User
        onSubmit: ReturnType<typeof vi.fn>
    }

    beforeEach(() => {
        vi.clearAllMocks()
        user = userEvent.setup()
        baseProps = {
            open: true,
            onClose: vi.fn(),
            trainerId: 'trainer-1',
            trainerName: 'Taylor Trainer',
            currentUser,
            onSubmit: vi.fn(),
        }
    })

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
        expect(vi.mocked(calculateWellnessScore)).toHaveBeenCalledWith(latestCheckIn)
        expect(vi.mocked(getRecoveryPlanRecommendations)).toHaveBeenCalledWith(90, 42, 'high', 'tired')
    })

    it('submits plan payload with generated action ids when auto-filled data exists', async () => {
        render(
            <RecoveryPlanDialog
                {...baseProps}
                latestCheckIn={latestCheckIn}
                currentUtilization={90}
            />
        )

        await user.click(screen.getByRole('button', { name: /create recovery plan/i }))

        expect(baseProps.onSubmit).toHaveBeenCalledOnce()
        const submittedPayload = baseProps.onSubmit.mock.calls[0][0]
        expect(new Date(submittedPayload.targetCompletionDate).getTime()).toBeGreaterThan(
            new Date(submittedPayload.startDate).getTime()
        )
        expect(baseProps.onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                trainerId: 'trainer-1',
                createdBy: 'admin-1',
                status: 'active',
                triggerReason: expect.stringMatching(/wellness score/i),
                targetUtilization: 70,
                currentUtilization: 90,
                startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
                targetCompletionDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
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
        const stressSummary = screen.getByText(/stress:/i).closest('div')
        expect(stressSummary).toHaveTextContent(/stress:\s*high/i)
        const concernsSummary = screen.getByText(/concerns:/i).closest('div')
        // The summary shows 2/5 for both selected steps (2 out of 5 total) and selected concerns (2 out of 5 total)
        expect(screen.getAllByText('2/5')).toHaveLength(2)
        expect(concernsSummary).toHaveTextContent(/work-life balance, too many sessions scheduled/i)
    })

    it('calls onClose when cancel is clicked', async () => {
        render(
            <RecoveryPlanDialog
                {...baseProps}
                latestCheckIn={latestCheckIn}
            />
        )

        await user.click(screen.getByRole('button', { name: /cancel/i }))

        expect(baseProps.onClose).toHaveBeenCalledOnce()
    })

    it('supports adding and removing actions before submit', async () => {
        render(<RecoveryPlanDialog {...baseProps} currentUtilization={80} />)

        await user.type(screen.getByLabelText(/trigger reason/i), 'Temporary capacity support needed')

        await user.click(screen.getByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: /workload reduction/i }))
        await user.click(screen.getByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: /support session/i }))

        expect(screen.getByText(/workload reduction/i)).toBeInTheDocument()
        expect(screen.getByText(/support session/i, { selector: 'span' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /remove action workload reduction/i }))

        expect(screen.queryByText(/workload reduction/i)).not.toBeInTheDocument()
        expect(screen.getByText(/support session/i, { selector: 'span' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /create recovery plan/i }))

        expect(baseProps.onSubmit).toHaveBeenCalledOnce()
        const submittedPlan = baseProps.onSubmit.mock.calls[0][0]
        expect(submittedPlan.actions).toHaveLength(1)
        expect(submittedPlan.actions[0]).toEqual(
            expect.objectContaining({
                type: 'support-session',
            })
        )
    })

    it('updates action details, notes, and numeric fields before submit', async () => {
        render(<RecoveryPlanDialog {...baseProps} currentUtilization={88} />)

        await user.type(screen.getByLabelText(/trigger reason/i), 'Need a short-term recovery plan')
        const targetUtilizationInput = screen.getByLabelText(/target utilization/i)
        const durationWeeksInput = screen.getByLabelText(/duration \(weeks\)/i)

        await user.clear(targetUtilizationInput)
        await user.type(targetUtilizationInput, '65')
        await user.clear(durationWeeksInput)
        await user.type(durationWeeksInput, '6')

        await user.click(screen.getByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: /schedule adjustment/i }))

        await user.clear(screen.getByLabelText(/description/i))
        await user.type(screen.getByLabelText(/description/i), 'Move sessions to reduce fatigue')
        // `type="date"` inputs emit intermediate strings (for example `2026-04-1`, `2026-04-15T`)
        // when typing with userEvent, which jsdom parses/validates differently than real browsers
        // and can cause flaky validation or state in this test. Use a single change event with a
        // final valid value for stable cross-environment behavior.
        fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-04-15' } })
        await user.type(screen.getByLabelText(/notes \(optional\)/i, { selector: 'input' }), 'Coordinate with operations lead')
        await user.type(screen.getByLabelText(/plan notes \(optional\)/i, { selector: 'textarea' }), 'Escalate if utilization stays above target')

        await user.click(screen.getByRole('button', { name: /create recovery plan/i }))

        expect(baseProps.onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                targetUtilization: 65,
                currentUtilization: 88,
                notes: 'Escalate if utilization stays above target',
                actions: [
                    expect.objectContaining({
                        type: 'schedule-adjustment',
                        description: 'Move sessions to reduce fatigue',
                        notes: 'Coordinate with operations lead',
                        targetDate: expect.stringMatching(/^2026-04-15T00:00:00/),
                    }),
                ],
            })
        )

        const submittedPlan = baseProps.onSubmit.mock.calls[0][0]
        const durationDays = (new Date(submittedPlan.targetCompletionDate).getTime() - new Date(submittedPlan.startDate).getTime()) / (1000 * 60 * 60 * 24)
        expect(durationDays).toBeGreaterThanOrEqual(41)
    })

    it('falls back to default numeric values when target utilization or duration are cleared', async () => {
        render(<RecoveryPlanDialog {...baseProps} currentUtilization={82} />)

        const targetUtilizationInput = screen.getByLabelText(/target utilization/i)
        const durationWeeksInput = screen.getByLabelText(/duration \(weeks\)/i)

        await user.type(screen.getByLabelText(/trigger reason/i), 'Numeric fallback coverage')
        await user.clear(targetUtilizationInput)
        await user.clear(durationWeeksInput)
        await user.tab()

        expect(targetUtilizationInput).toHaveValue(70)
        expect(durationWeeksInput).toHaveValue(4)
    })

    it('disables submit and shows validation text when trigger reason is empty', async () => {
        render(<RecoveryPlanDialog {...baseProps} />)

        await user.type(screen.getByLabelText(/trigger reason/i), 'Initial reason')
        await user.click(screen.getByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: /custom action/i }))
        await user.clear(screen.getByLabelText(/trigger reason/i))

        expect(screen.getByRole('button', { name: /create recovery plan/i })).toBeDisabled()
        expect(screen.getByText(/trigger reason is required/i)).toBeInTheDocument()
    })

    it('handles below-minimum current utilization (-1) without crashing', () => {
        render(<RecoveryPlanDialog {...baseProps} currentUtilization={-1} />)

        expect(screen.getByLabelText(/current utilization/i)).toHaveValue(-1)
        expect(screen.getByLabelText(/target utilization/i)).toHaveValue(70)
    })

    it('handles above-maximum current utilization (101) without crashing', () => {
        render(<RecoveryPlanDialog {...baseProps} currentUtilization={101} />)

        expect(screen.getByLabelText(/current utilization/i)).toHaveValue(101)
        expect(screen.getByLabelText(/target utilization/i)).toHaveValue(70)
    })

    it('renders boundary current utilization at 0 with stable target utilization default', () => {
        render(<RecoveryPlanDialog {...baseProps} currentUtilization={0} />)

        expect(screen.getByLabelText(/current utilization/i)).toHaveValue(0)
        expect(screen.getByLabelText(/target utilization/i)).toHaveValue(70)
    })

    it('renders boundary current utilization at 100 with stable target utilization default', () => {
        render(<RecoveryPlanDialog {...baseProps} currentUtilization={100} />)

        expect(screen.getByLabelText(/current utilization/i)).toHaveValue(100)
        expect(screen.getByLabelText(/target utilization/i)).toHaveValue(70)
    })

    it('keeps focus in dialog and closes on Escape', async () => {
        render(<RecoveryPlanDialog {...baseProps} />)

        const dialog = screen.getByRole('dialog')
        await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

        await user.keyboard('{Escape}')

        expect(baseProps.onClose).toHaveBeenCalledOnce()
    })

    it('does not prefill recommendations when dialog is closed', () => {
        render(
            <RecoveryPlanDialog
                {...baseProps}
                open={false}
                latestCheckIn={latestCheckIn}
                currentUtilization={90}
            />
        )

        expect(vi.mocked(calculateWellnessScore)).not.toHaveBeenCalled()
        expect(vi.mocked(getRecoveryPlanRecommendations)).not.toHaveBeenCalled()
    })

    it('skips high-stress, concerns, and support-action prefill on low-risk check-ins', () => {
        vi.mocked(calculateWellnessScore).mockReturnValueOnce(68)
        vi.mocked(getRecoveryPlanRecommendations).mockReturnValueOnce([])

        const lowRiskCheckIn: WellnessCheckIn = {
            ...latestCheckIn,
            stress: 'low',
            followUpRequired: false,
            concerns: [],
            energy: 'good',
        }

        render(
            <RecoveryPlanDialog
                {...baseProps}
                latestCheckIn={lowRiskCheckIn}
                currentUtilization={70}
            />
        )

        const triggerInput = screen.getByLabelText(/trigger reason/i) as HTMLTextAreaElement
        expect(triggerInput.value).toContain('Wellness score: 68/100.')
        expect(triggerInput.value).not.toContain('High stress level')
        expect(triggerInput.value).not.toContain('Utilization at')
        expect(triggerInput.value).not.toContain('Concerns raised')

        expect(screen.queryByText(/support session/i, { selector: 'span' })).not.toBeInTheDocument()
        expect(screen.queryByText(/provide 3-5 consecutive days of paid time off/i)).not.toBeInTheDocument()
        expect(screen.getByText(/no actions added yet/i)).toBeInTheDocument()
    })

    it('displays validation error when actions list becomes empty after removal', async () => {
        render(<RecoveryPlanDialog {...baseProps} />)

        await user.type(screen.getByLabelText(/trigger reason/i), 'Test reason')
        await user.click(screen.getByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: /workload reduction/i }))

        expect(screen.getByRole('button', { name: /create recovery plan/i })).not.toBeDisabled()

        await user.click(screen.getByRole('button', { name: /remove action workload reduction/i }))

        expect(screen.getByRole('button', { name: /create recovery plan/i })).toBeDisabled()
        expect(screen.getByText(/no actions added yet/i)).toBeInTheDocument()
    })

    it('handles form submission with all fields populated and custom values', async () => {
        render(<RecoveryPlanDialog {...baseProps} currentUtilization={85} />)

        await user.type(screen.getByLabelText(/trigger reason/i), 'Long-term sustainability plan needed')
        const targetUtilizationInput = screen.getByLabelText(/target utilization/i)
        const durationWeeksInput = screen.getByLabelText(/duration \(weeks\)/i)

        await user.clear(targetUtilizationInput)
        await user.type(targetUtilizationInput, '60')
        await user.clear(durationWeeksInput)
        await user.type(durationWeeksInput, '8')

        await user.click(screen.getByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: /workload reduction/i }))

        await user.clear(screen.getByLabelText(/description/i))
        await user.type(screen.getByLabelText(/description/i), 'Custom action description')

        await user.type(screen.getByLabelText(/plan notes \(optional\)/i, { selector: 'textarea' }), 'Priority case')

        await user.click(screen.getByRole('button', { name: /create recovery plan/i }))

        expect(baseProps.onSubmit).toHaveBeenCalledOnce()
        expect(baseProps.onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                trainerId: 'trainer-1',
                createdBy: 'admin-1',
                status: 'active',
                triggerReason: 'Long-term sustainability plan needed',
                targetUtilization: 60,
                currentUtilization: 85,
                notes: 'Priority case',
                actions: expect.arrayContaining([
                    expect.objectContaining({
                        description: 'Custom action description',
                    }),
                ]),
            })
        )
        expect(baseProps.onClose).toHaveBeenCalled()
    })
})
