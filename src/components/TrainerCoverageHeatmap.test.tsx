import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TrainerCoverageHeatmap } from './TrainerCoverageHeatmap'
import { useKV } from '@github/spark/hooks'
import type { User } from '@/lib/types'

vi.mock('@github/spark/hooks', () => ({
    useKV: vi.fn(),
}))

type ShiftSchedule = NonNullable<User['trainerProfile']>['shiftSchedules'][number]

function makeTrainer(id: string, name: string, certs: string[], shiftSchedules?: ShiftSchedule[]): User {
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
            shiftSchedules: shiftSchedules || [
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

    const getHeatmapCell = (value: string) => {
        const cell = screen.getAllByText(value).find((element) => element.className.includes('cursor-help'))
        if (!cell) {
            throw new Error(`Unable to find heatmap cell with value ${value}`)
        }
        return cell
    }

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

    it('supports keyboard save and cancel while using default target when kv is undefined', async () => {
        const user = userEvent.setup()
        vi.mocked(useKV).mockReturnValue([undefined as unknown as number, setTargetCoverage, vi.fn()] as unknown as ReturnType<typeof useKV>)
        const users: User[] = [makeTrainer('trainer-1', 'Alex Trainer', ['Safety'])]

        render(<TrainerCoverageHeatmap users={users} />)

        await user.click(screen.getByRole('button', { name: /target:\s*4/i }))

        const targetInput = screen.getByRole('spinbutton')
        expect(targetInput).toHaveValue(4)

        await user.clear(targetInput)
        await user.type(targetInput, '5{Enter}')
        expect(setTargetCoverage).toHaveBeenCalledWith(5)

        await user.click(screen.getByRole('button', { name: /target:\s*4/i }))
        const reopenedInput = screen.getByRole('spinbutton')
        await user.clear(reopenedInput)
        await user.type(reopenedInput, '8')
        await user.keyboard('{Escape}')

        expect(setTargetCoverage).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })

    it('renders singular target summary and handles overnight and midnight schedule parsing', () => {
        vi.mocked(useKV).mockReturnValue([1, setTargetCoverage, vi.fn()] as unknown as ReturnType<typeof useKV>)

        const overnightSchedule: ShiftSchedule = {
            shiftCode: 'overnight',
            daysWorked: ['monday'],
            startTime: '11:00 PM',
            endTime: '01:00 AM',
            totalHoursPerWeek: 2,
        }
        const midnightSchedule: ShiftSchedule = {
            shiftCode: 'midnight',
            daysWorked: ['monday'],
            startTime: '12:00 AM',
            endTime: '02:00 AM',
            totalHoursPerWeek: 2,
        }
        const users: User[] = [
            makeTrainer('trainer-1', 'Alex Trainer', ['Safety'], [overnightSchedule]),
            makeTrainer('trainer-2', 'Jordan Trainer', ['Safety'], [midnightSchedule]),
        ]

        render(<TrainerCoverageHeatmap users={users} />)

        const summary = screen.getByText(/target coverage is set to/i).parentElement
        expect(summary).toHaveTextContent(/target coverage is set to 1/i)
        expect(summary).toHaveTextContent(/trainer per hour\./i)
        expect(summary).not.toHaveTextContent(/trainers per hour\./i)
    })

    it('applies expected heatmap colors for each target ratio tier', () => {
        vi.mocked(useKV).mockReturnValue([4, setTargetCoverage, vi.fn()] as unknown as ReturnType<typeof useKV>)

        const users: User[] = [
            makeTrainer('trainer-1', 'A Trainer', ['Safety'], [{
                shiftCode: 's1',
                daysWorked: ['monday'],
                startTime: '08:00 AM',
                endTime: '12:00 PM',
                totalHoursPerWeek: 4,
            }]),
            makeTrainer('trainer-2', 'B Trainer', ['Safety'], [{
                shiftCode: 's2',
                daysWorked: ['monday'],
                startTime: '08:00 AM',
                endTime: '11:00 AM',
                totalHoursPerWeek: 3,
            }]),
            makeTrainer('trainer-3', 'C Trainer', ['Safety'], [{
                shiftCode: 's3',
                daysWorked: ['monday'],
                startTime: '08:00 AM',
                endTime: '10:00 AM',
                totalHoursPerWeek: 2,
            }]),
            makeTrainer('trainer-4', 'D Trainer', ['Safety'], [{
                shiftCode: 's4',
                daysWorked: ['monday'],
                startTime: '08:00 AM',
                endTime: '09:00 AM',
                totalHoursPerWeek: 1,
            }]),
        ]

        render(<TrainerCoverageHeatmap users={users} />)

        expect(getHeatmapCell('4')).toHaveClass('bg-green-500')
        expect(getHeatmapCell('3')).toHaveClass('bg-yellow-400')
        expect(getHeatmapCell('2')).toHaveClass('bg-orange-400')
        expect(getHeatmapCell('1')).toHaveClass('bg-red-400')
    })
})
