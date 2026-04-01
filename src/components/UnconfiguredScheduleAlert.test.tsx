import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { UnconfiguredScheduleAlert } from './UnconfiguredScheduleAlert'
import type { User } from '@/lib/types'

function createTrainer(overrides: Partial<User> = {}): User {
    return {
        id: 'trainer-1',
        name: 'Taylor Trainer',
        email: 'taylor@example.com',
        role: 'trainer',
        department: 'Operations',
        certifications: ['Safety'],
        hireDate: '2020-01-01T00:00:00.000Z',
        ...overrides,
    }
}

describe('UnconfiguredScheduleAlert', () => {
    it('returns null when trainer already has configured shifts', () => {
        const { container } = render(
            <UnconfiguredScheduleAlert
                user={createTrainer({
                    trainerProfile: {
                        authorizedRoles: [],
                        shiftSchedules: [
                            {
                                shiftCode: 'DAY-A-1',
                                shiftType: 'day',
                                daysWorked: ['monday'],
                                startTime: '08:00',
                                endTime: '16:00',
                                totalHoursPerWeek: 8,
                            },
                        ],
                        tenure: {
                            hireDate: '2020-01-01T00:00:00.000Z',
                            yearsOfService: 6,
                            monthsOfService: 72,
                        },
                        specializations: [],
                    },
                })}
            />
        )

        expect(container).toBeEmptyDOMElement()
    })

    it('renders inline variant without configure button', () => {
        render(<UnconfiguredScheduleAlert user={createTrainer()} variant="inline" />)

        expect(screen.getByText(/schedule not configured/i)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /configure/i })).not.toBeInTheDocument()
    })

    it('renders compact variant and triggers onEdit when configure is clicked', async () => {
        const onEdit = vi.fn()
        const user = userEvent.setup()

        render(
            <UnconfiguredScheduleAlert
                user={createTrainer()}
                variant="compact"
                onEdit={onEdit}
            />
        )

        await user.click(screen.getByRole('button', { name: /configure/i }))
        expect(onEdit).toHaveBeenCalledOnce()
    })

    it('renders default variant content and configure action', async () => {
        const onEdit = vi.fn()
        const user = userEvent.setup()

        render(<UnconfiguredScheduleAlert user={createTrainer()} onEdit={onEdit} />)

        expect(screen.getByText(/work schedule not configured/i)).toBeInTheDocument()
        expect(screen.getByText(/enable automatic scheduling and workload calculations/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /configure schedule now/i }))
        expect(onEdit).toHaveBeenCalledOnce()
    })

    it('renders alert when trainer profile exists but shift schedules are empty', () => {
        render(
            <UnconfiguredScheduleAlert
                user={createTrainer({
                    trainerProfile: {
                        authorizedRoles: [],
                        shiftSchedules: [],
                        tenure: {
                            hireDate: '2020-01-01T00:00:00.000Z',
                            yearsOfService: 6,
                            monthsOfService: 72,
                        },
                        specializations: [],
                    },
                })}
            />
        )

        expect(screen.getByText(/work schedule not configured/i)).toBeInTheDocument()
    })
})
