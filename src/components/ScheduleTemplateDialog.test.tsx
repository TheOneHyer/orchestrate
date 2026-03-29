import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ScheduleTemplateDialog } from './ScheduleTemplateDialog'
import type { ScheduleTemplate } from '@/lib/types'

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

    it('does not render dialog body when open is false', () => {
        render(
            <ScheduleTemplateDialog
                open={false}
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
                courses={courses}
            />
        )

        expect(screen.queryByLabelText(/template name/i)).not.toBeInTheDocument()
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
        await user.type(cycleInput, '15')

        await user.type(screen.getByPlaceholderText(/add a tag/i), 'rotation{enter}')

        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).toHaveBeenCalledOnce()
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Safety Rotation',
                description: 'Rotating weekly schedule',
                recurrenceType: 'custom',
                cycleDays: 15,
                tags: ['rotation'],
                isActive: true,
            })
        )
        expect(onSave.mock.calls[0][0].sessions).toHaveLength(1)
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('allows selecting and clearing the optional course before save', async () => {
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

        await user.type(screen.getByLabelText(/template name/i), 'Course Toggle Template')

        const courseSelect = screen.getByRole('combobox', { name: /course \(optional\)/i })
        await user.click(courseSelect)
        await user.click(await screen.findByRole('option', { name: /safety 101/i }))

        await user.click(courseSelect)
        await user.click(await screen.findByRole('option', { name: /unassigned/i }))

        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).toHaveBeenCalledOnce()
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                courseId: undefined,
            })
        )
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

        const durationInput = within(secondSessionCard).getByRole('spinbutton', {
            name: /duration for session 2/i,
        })
        const capacityInput = within(secondSessionCard).getByRole('spinbutton', {
            name: /capacity for session 2/i,
        })

        await user.clear(durationInput)
        await user.type(durationInput, '90')

        await user.click(sessionComboboxes[1])
        await user.click(await screen.findByRole('option', { name: /^night$/i }))

        await user.clear(capacityInput)
        await user.type(capacityInput, '12')

        await user.type(within(secondSessionCard).getByPlaceholderText(/room\/location/i), 'Bay 3')

        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).toHaveBeenCalledOnce()
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Two Session Template',
                sessions: expect.arrayContaining([
                    expect.objectContaining({
                        dayOfWeek: 3,
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

        await user.click(within(secondSessionCard).getByRole('button', { name: /remove session 2/i }))

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

    it('shows a validation error when custom cycle days are invalid', async () => {
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

        await user.type(screen.getByLabelText(/template name/i), 'Broken Rotation')
        await user.click(screen.getByRole('combobox', { name: /recurrence type/i }))
        await user.click(await screen.findByRole('option', { name: /custom/i }))

        const cycleInput = await screen.findByLabelText(/cycle duration/i)
        await user.clear(cycleInput)
        await user.type(cycleInput, '0')
        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).not.toHaveBeenCalled()
        expect(screen.getByText(/cycle days must be a positive integer/i)).toBeInTheDocument()
    })

    it('shows a validation error when custom cycle days contain decimals', async () => {
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

        await user.type(screen.getByLabelText(/template name/i), 'Decimal Rotation')
        await user.click(screen.getByRole('combobox', { name: /recurrence type/i }))
        await user.click(await screen.findByRole('option', { name: /custom/i }))

        const cycleInput = await screen.findByLabelText(/cycle duration/i)
        await user.clear(cycleInput)
        await user.type(cycleInput, '1.5')
        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).not.toHaveBeenCalled()
        expect(screen.getByText(/cycle days must be a positive integer/i)).toBeInTheDocument()
    })

    it('shows a validation error when a session time is blank', async () => {
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

        await user.type(screen.getByLabelText(/template name/i), 'Broken Time Template')

        const timeInput = document.querySelector('input[type="time"]')
        if (!(timeInput instanceof HTMLInputElement)) {
            throw new Error('Session time input was not found')
        }

        await user.clear(timeInput)
        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).not.toHaveBeenCalled()
        expect(screen.getByText(/session 1: time is required/i)).toBeInTheDocument()
    })

    it('shows a validation error when a session duration is not a positive integer', async () => {
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

        await user.type(screen.getByLabelText(/template name/i), 'Broken Duration Template')

        const durationInput = screen.getByRole('spinbutton', {
            name: /duration for session 1/i,
        })

        await user.clear(durationInput)
        await user.type(durationInput, '0')
        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).not.toHaveBeenCalled()
        expect(screen.getByText(/session 1: duration must be a positive integer/i)).toBeInTheDocument()
    })

    it('shows a validation error when a session capacity is not a positive integer', async () => {
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

        await user.type(screen.getByLabelText(/template name/i), 'Broken Capacity Template')

        const capacityInput = screen.getByRole('spinbutton', {
            name: /capacity for session 1/i,
        })

        await user.clear(capacityInput)
        await user.type(capacityInput, '0')
        await user.click(screen.getByRole('button', { name: /create template/i }))

        expect(onSave).not.toHaveBeenCalled()
        expect(screen.getByText(/session 1: capacity must be a positive integer/i)).toBeInTheDocument()
    })

    it('parses pure digit string values when editing existing template data', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        const importedTemplate = {
            id: 'template-strings',
            name: 'Imported Template',
            description: 'Imported from persisted data',
            category: 'general',
            recurrenceType: 'custom',
            cycleDays: '15',
            sessions: [
                {
                    dayOfWeek: 1,
                    time: '09:00',
                    duration: '15',
                    capacity: '15',
                    requiresCertifications: [],
                },
            ],
            autoAssignTrainers: true,
            notifyParticipants: true,
            createdBy: 'admin-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            usageCount: 0,
            tags: [],
            isActive: true,
        } as unknown as ScheduleTemplate

        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
                courses={courses}
                template={importedTemplate}
            />
        )

        await user.click(screen.getByRole('button', { name: /update template/i }))

        expect(onSave).toHaveBeenCalledOnce()
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                cycleDays: 15,
                sessions: [
                    expect.objectContaining({
                        duration: 15,
                        capacity: 15,
                    }),
                ],
            })
        )
    })

    it('rejects non-digit imported session values', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        const importedTemplate = {
            id: 'template-invalid-strings',
            name: 'Imported Invalid Template',
            description: 'Imported from persisted data',
            category: 'general',
            recurrenceType: 'weekly',
            sessions: [
                {
                    dayOfWeek: 1,
                    time: '09:00',
                    duration: '45min',
                    capacity: 12,
                    requiresCertifications: [],
                },
            ],
            autoAssignTrainers: true,
            notifyParticipants: true,
            createdBy: 'admin-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            usageCount: 0,
            tags: [],
            isActive: true,
        } as unknown as ScheduleTemplate

        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
                courses={courses}
                template={importedTemplate}
            />
        )

        await user.click(screen.getByRole('button', { name: /update template/i }))

        expect(onSave).not.toHaveBeenCalled()
        expect(screen.getByText(/session 1: duration must be a positive integer/i)).toBeInTheDocument()
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

    it('normalizes missing session certification requirements to an empty array', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        const importedTemplate = {
            id: 'template-missing-cert-requirements',
            name: 'Imported Legacy Template',
            description: 'Legacy record without requiresCertifications',
            category: 'general',
            recurrenceType: 'weekly',
            sessions: [
                {
                    dayOfWeek: 1,
                    time: '09:00',
                    duration: 45,
                    capacity: 12,
                },
            ],
            autoAssignTrainers: true,
            notifyParticipants: true,
            createdBy: 'admin-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            usageCount: 0,
            tags: [],
            isActive: true,
        } as unknown as ScheduleTemplate

        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
                courses={courses}
                template={importedTemplate}
            />
        )

        await user.click(screen.getByRole('button', { name: /update template/i }))

        expect(onSave).toHaveBeenCalledOnce()
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                sessions: [
                    expect.objectContaining({
                        requiresCertifications: [],
                    }),
                ],
            })
        )
    })
})
