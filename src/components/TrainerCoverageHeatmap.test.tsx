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

    const mockUseKV = (value: number | undefined) => {
        vi.mocked(useKV).mockReturnValue([value, setTargetCoverage, vi.fn()] as ReturnType<typeof useKV>)
    }

    const getHeatmapCell = (value: string) => {
        const cell = screen.getAllByText(value).find((element) => element.classList.contains('cursor-help'))
        if (!cell) {
            throw new Error(`Unable to find heatmap cell with value ${value}`)
        }
        return cell
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockUseKV(4)
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
        mockUseKV(undefined)
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
        mockUseKV(1)

        const overnightSchedule: ShiftSchedule = {
            shiftCode: 'overnight',
            shiftType: 'night',
            daysWorked: ['monday'],
            startTime: '11:00 PM',
            endTime: '01:00 AM',
            totalHoursPerWeek: 2,
        }
        const midnightSchedule: ShiftSchedule = {
            shiftCode: 'midnight',
            shiftType: 'night',
            daysWorked: ['monday'],
            startTime: '12:00 AM',
            endTime: '02:00 AM',
            totalHoursPerWeek: 2,
        }
        const users: User[] = [
            makeTrainer('trainer-1', 'Alex Trainer', ['Safety'], [overnightSchedule]),
            makeTrainer('trainer-2', 'Jordan Trainer', ['Safety'], [midnightSchedule]),
        ]

        const { container } = render(<TrainerCoverageHeatmap users={users} />)

        const getCoverageCell = (day: string, hour: number) => {
            const cell = container.querySelector(`[data-day="${day}"][data-hour="${hour}"]`)
            if (!(cell instanceof HTMLElement)) {
                throw new Error(`Unable to find coverage cell for ${day} at hour ${hour}`)
            }
            return cell
        }

        const summary = screen.getByText(/target coverage is set to/i).parentElement
        expect(summary).toHaveTextContent(/target coverage is set to 1/i)
        expect(summary).toHaveTextContent(/trainer per hour\./i)
        expect(summary).not.toHaveTextContent(/trainers per hour\./i)

        expect(getCoverageCell('monday', 23)).toHaveTextContent('1')
        expect(getCoverageCell('monday', 0)).toHaveTextContent('2')
        expect(getCoverageCell('monday', 1)).toHaveTextContent('1')
    })

    it('applies expected heatmap colors for each target ratio tier', () => {
        mockUseKV(4)

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

        expect(getHeatmapCell('4')).toHaveAttribute('data-coverage-tier', '4')
        expect(getHeatmapCell('3')).toHaveAttribute('data-coverage-tier', '3')
        expect(getHeatmapCell('2')).toHaveAttribute('data-coverage-tier', '2')
        expect(getHeatmapCell('1')).toHaveAttribute('data-coverage-tier', '1')
    })

    it.each<{
        caseName: string
        schedule: ShiftSchedule
    }>([
        {
            caseName: 'malformed',
            schedule: {
                shiftCode: 'bad',
                daysWorked: ['monday'],
                startTime: 'notavalidtime',
                endTime: 'alsoinvalid',
                totalHoursPerWeek: 8,
            },
        },
        {
            caseName: 'empty',
            schedule: {
                shiftCode: 'empty',
                daysWorked: ['monday'],
                startTime: '',
                endTime: '',
                totalHoursPerWeek: 8,
            },
        },
        {
            caseName: 'too many parts',
            schedule: {
                shiftCode: 'weird',
                daysWorked: ['monday'],
                startTime: 'bad bad bad',
                endTime: 'also bad here',
                totalHoursPerWeek: 8,
            },
        },
        {
            caseName: 'non-numeric',
            schedule: {
                shiftCode: 'nonnum',
                daysWorked: ['monday'],
                startTime: 'abc:def PM',
                endTime: 'xyz:uvw AM',
                totalHoursPerWeek: 8,
            },
        },
        {
            caseName: 'bad period',
            schedule: {
                shiftCode: 'badperiod',
                daysWorked: ['monday'],
                startTime: '08:00 XX',
                endTime: '12:00 XX',
                totalHoursPerWeek: 4,
            },
        },
    ])('skips schedules with $caseName time values', ({ schedule }) => {
        mockUseKV(1)

        const users: User[] = [makeTrainer('trainer-1', 'Alex Trainer', ['Safety'], [schedule])]
        const { container } = render(<TrainerCoverageHeatmap users={users} />)

        expect(container.querySelector('[data-day="monday"][data-hour="9"]')?.textContent).toBe('')
    })
})
