import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ScheduleTemplateDialog } from './ScheduleTemplateDialog'

const courses = [
    { id: 'course-1', title: 'Safety 101' },
    { id: 'course-2', title: 'Forklift Basics' },
]

describe('ScheduleTemplateDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps create disabled until required fields are provided', async () => {
        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
                courses={courses}
            />
        )

        expect(await screen.findByRole('button', { name: /create template/i })).toBeDisabled()
    })

    it('adds tags only once when duplicate input is submitted', async () => {
        const user = userEvent.setup()

        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
                courses={courses}
            />
        )

        const nameInput = screen.getByLabelText(/template name/i)
        await user.type(nameInput, 'Weekly Safety')

        const tagInput = screen.getByPlaceholderText(/add a tag/i)
        await user.type(tagInput, 'critical{enter}')
        await user.type(tagInput, 'critical{enter}')

        const tagsSection = screen.getByText(/^tags$/i).closest('div')
        if (!tagsSection) {
            throw new Error('Tags section was not found')
        }

        expect(within(tagsSection).getAllByText('critical')).toHaveLength(1)
        expect(screen.getByRole('button', { name: /create template/i })).toBeEnabled()
    })

    it('saves a custom recurrence template with trimmed values', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        const onOpenChange = vi.fn()

        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={onOpenChange}
                onSave={onSave}
                courses={courses}
            />
        )

        await user.type(screen.getByLabelText(/template name/i), '  Safety Rotation  ')
        await user.type(screen.getByLabelText(/description/i), '  Rotating weekly schedule  ')

        await user.click(screen.getByRole('combobox', { name: /recurrence type/i }))
        await user.click(await screen.findByRole('option', { name: /custom/i }))

        const cycleInput = await screen.findByLabelText(/cycle duration/i)
        await user.clear(cycleInput)
        await user.type(cycleInput, '14')

        await user.type(screen.getByPlaceholderText(/add a tag/i), 'rotation{enter}')

        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).toHaveBeenCalledOnce()
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Safety Rotation',
                description: 'Rotating weekly schedule',
                recurrenceType: 'custom',
                cycleDays: 14,
                tags: ['rotation'],
                isActive: true,
            })
        )
        expect(onSave.mock.calls[0][0].sessions).toHaveLength(1)
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('closes when cancel is clicked', async () => {
        const user = userEvent.setup()
        const onOpenChange = vi.fn()

        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={onOpenChange}
                onSave={vi.fn()}
                courses={courses}
            />
        )

        await user.click(screen.getByRole('button', { name: /^cancel$/i }))

        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('hides day-of-week controls for daily recurrence and omits cycleDays on save', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
                courses={courses}
            />
        )

        await user.type(screen.getByLabelText(/template name/i), 'Daily Briefing')

        await user.click(screen.getByRole('combobox', { name: /recurrence type/i }))
        await user.click(await screen.findByRole('option', { name: /^daily$/i }))

        expect(screen.queryByText(/day of week/i)).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                recurrenceType: 'daily',
                cycleDays: undefined,
            })
        )
    })

    it('updates a newly added session fields and saves both sessions', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
                courses={courses}
            />
        )

        await user.type(screen.getByLabelText(/template name/i), 'Two Session Template')
        await user.click(screen.getByRole('button', { name: /add session/i }))

        const secondSessionCard = screen.getByText('Session 2').closest('[data-slot="card"]')
        if (!(secondSessionCard instanceof HTMLElement)) {
            throw new Error('Session 2 card was not found')
        }

        const sessionComboboxes = within(secondSessionCard).getAllByRole('combobox')

        await user.click(sessionComboboxes[0])
        await user.click(await screen.findByRole('option', { name: /wednesday/i }))

        const timeInput = secondSessionCard.querySelector('input[type="time"]')
        if (!(timeInput instanceof HTMLInputElement)) {
            throw new Error('Session time input was not found')
        }
        await user.clear(timeInput)
        await user.type(timeInput, '13:30')

        const numberInputs = secondSessionCard.querySelectorAll('input[type="number"]')
        const durationInput = numberInputs[0]
        const capacityInput = numberInputs[1]
        if (!(durationInput instanceof HTMLInputElement) || !(capacityInput instanceof HTMLInputElement)) {
            throw new Error('Session number inputs were not found')
        }

        fireEvent.change(durationInput, { target: { value: '90' } })

        await user.click(sessionComboboxes[1])
        await user.click(await screen.findByRole('option', { name: /^night$/i }))

        fireEvent.change(capacityInput, { target: { value: '12' } })

        await user.type(within(secondSessionCard).getByPlaceholderText(/room\/location/i), 'Bay 3')

        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).toHaveBeenCalledOnce()
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Two Session Template',
                sessions: expect.arrayContaining([
                    expect.objectContaining({
                        dayOfWeek: 2,
                        time: '13:30',
                        duration: 90,
                        shift: 'night',
                        capacity: 12,
                        location: 'Bay 3',
                    }),
                ]),
            })
        )
        expect(onSave.mock.calls[0][0].sessions).toHaveLength(2)
    })

    it('removes an added session before save', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
                courses={courses}
            />
        )

        await user.type(screen.getByLabelText(/template name/i), 'Single Session Template')
        await user.click(screen.getByRole('button', { name: /add session/i }))

        const secondSessionCard = screen.getByText('Session 2').closest('[data-slot="card"]')
        if (!(secondSessionCard instanceof HTMLElement)) {
            throw new Error('Session 2 card was not found')
        }

        await user.click(within(secondSessionCard).getByRole('button'))

        expect(screen.queryByText('Session 2')).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).toHaveBeenCalledOnce()
        expect(onSave.mock.calls[0][0].sessions).toHaveLength(1)
    })

    it('removes existing tags when editing a template and saves updated values', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        const onOpenChange = vi.fn()

        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={onOpenChange}
                onSave={onSave}
                courses={courses}
                template={{
                    id: 'template-1',
                    name: 'Weekly Safety',
                    description: 'Existing template',
                    courseId: 'course-1',
                    category: 'safety',
                    recurrenceType: 'weekly',
                    sessions: [
                        {
                            dayOfWeek: 1,
                            time: '09:00',
                            duration: 120,
                            capacity: 20,
                            requiresCertifications: [],
                        }
                    ],
                    autoAssignTrainers: true,
                    notifyParticipants: true,
                    createdBy: 'admin-1',
                    createdAt: '2026-01-01T00:00:00.000Z',
                    usageCount: 2,
                    tags: ['urgent', 'night'],
                    isActive: true,
                }}
            />
        )

        expect(screen.getByRole('button', { name: /update template/i })).toBeEnabled()

        const urgentTag = screen.getByText('urgent').closest('[data-slot="badge"]')
        if (!(urgentTag instanceof HTMLElement)) {
            throw new Error('Urgent tag container was not found')
        }

        await user.click(within(urgentTag).getByRole('button'))
        await user.clear(screen.getByLabelText(/template name/i))
        await user.type(screen.getByLabelText(/template name/i), 'Updated Weekly Safety')
        await user.click(screen.getByRole('button', { name: /update template/i }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Updated Weekly Safety',
                tags: ['night'],
            })
        )
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('persists auto-assign and notify toggles when switched off', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
                courses={courses}
            />
        )

        await user.type(screen.getByLabelText(/template name/i), 'Toggled Template')

        const autoAssignSwitch = screen.getByRole('switch', { name: /auto-assign trainers/i })
        const notifySwitch = screen.getByRole('switch', { name: /notify participants/i })

        expect(autoAssignSwitch).toBeChecked()
        expect(notifySwitch).toBeChecked()

        await user.click(autoAssignSwitch)
        await user.click(notifySwitch)
        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                autoAssignTrainers: false,
                notifyParticipants: false,
            })
        )
    })
})
