import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TrainerCoverageHeatmap } from './TrainerCoverageHeatmap'
import { useKV } from '@github/spark/hooks'
import type { User } from '@/lib/types'

vi.mock('@github/spark/hooks', () => ({
    useKV: vi.fn(),
}))

function makeTrainer(id: string, name: string, certs: string[]): User {
    return {
        id,
        name,
        email: `${id}@example.com`,
        role: 'trainer',
        department: 'Operations',
        certifications: certs,
        hireDate: '2022-01-01T00:00:00.000Z',
        trainerProfile: {
            authorizedRoles: [],
            shiftSchedules: [
                {
                    shiftCode: `${id}-day`,
                    daysWorked: ['monday', 'tuesday'],
                    startTime: '08:00 AM',
                    endTime: '12:00 PM',
                    totalHoursPerWeek: 8,
                },
            ],
            tenure: {
                hireDate: '2022-01-01T00:00:00.000Z',
                yearsOfService: 4,
                monthsOfService: 48,
            },
            specializations: [],
        },
    }
}

describe('TrainerCoverageHeatmap', () => {
    const setTargetCoverage = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useKV).mockReturnValue([4, setTargetCoverage, vi.fn()] as unknown as ReturnType<typeof useKV>)
    })

    it('shows empty state when no trainer schedules are configured', () => {
        const users: User[] = [
            {
                id: 'trainer-1',
                name: 'Alex Trainer',
                email: 'alex@example.com',
                role: 'trainer',
                department: 'Ops',
                certifications: ['Safety'],
                hireDate: '2021-01-01T00:00:00.000Z',
            },
        ]

        render(<TrainerCoverageHeatmap users={users} />)

        expect(screen.getByText(/no trainers with configured schedules/i)).toBeInTheDocument()
    })

    it('updates target coverage when a valid value is saved', async () => {
        const user = userEvent.setup()
        const users: User[] = [makeTrainer('trainer-1', 'Alex Trainer', ['Safety'])]

        render(<TrainerCoverageHeatmap users={users} />)

        await user.click(screen.getByRole('button', { name: /target:\s*4/i }))

        const targetInput = screen.getByRole('spinbutton')
        await user.clear(targetInput)
        await user.type(targetInput, '6')

        await user.click(screen.getByRole('button', { name: /^save$/i }))

        expect(setTargetCoverage).toHaveBeenCalledWith(6)
    })

    it('does not update target coverage when value is out of allowed range', async () => {
        const user = userEvent.setup()
        const users: User[] = [makeTrainer('trainer-1', 'Alex Trainer', ['Safety'])]

        render(<TrainerCoverageHeatmap users={users} />)

        await user.click(screen.getByRole('button', { name: /target:\s*4/i }))

        const targetInput = screen.getByRole('spinbutton')
        await user.clear(targetInput)
        await user.type(targetInput, '30')

        await user.click(screen.getByRole('button', { name: /^save$/i }))

        expect(setTargetCoverage).not.toHaveBeenCalled()
    })

    it('does not update target coverage when value is below allowed range', async () => {
        const user = userEvent.setup()
        const users: User[] = [makeTrainer('trainer-1', 'Alex Trainer', ['Safety'])]

        render(<TrainerCoverageHeatmap users={users} />)

        await user.click(screen.getByRole('button', { name: /target:\s*4/i }))

        const targetInput = screen.getByRole('spinbutton')
        await user.clear(targetInput)
        await user.type(targetInput, '0')

        await user.click(screen.getByRole('button', { name: /^save$/i }))

        expect(setTargetCoverage).not.toHaveBeenCalled()
    })

    it('applies and displays certification filter text', async () => {
        const user = userEvent.setup()
        const users: User[] = [
            makeTrainer('trainer-1', 'Alex Trainer', ['Safety']),
            makeTrainer('trainer-2', 'Jordan Trainer', ['Forklift']),
        ]

        render(<TrainerCoverageHeatmap users={users} />)

        await user.click(screen.getByRole('combobox', { name: /certification filter/i }))
        await user.click(await screen.findByRole('option', { name: 'Safety' }))

        const filterSummary = screen.getByText(/showing only trainers certified in/i)
        expect(filterSummary).toBeInTheDocument()
        expect(filterSummary.parentElement).toHaveTextContent(/safety/i)
    })

    it('hides internal certification filter controls when external callback is provided', () => {
        const users: User[] = [makeTrainer('trainer-1', 'Alex Trainer', ['Safety'])]

        render(
            <TrainerCoverageHeatmap
                users={users}
                selectedCertification="all"
                onCertificationChange={vi.fn()}
            />
        )

        expect(screen.queryByText(/all certifications/i)).not.toBeInTheDocument()
    })
})
