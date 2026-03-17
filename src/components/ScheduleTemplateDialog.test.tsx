import { render, screen } from '@testing-library/react'
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

    it('keeps create disabled until required fields are provided', () => {
        render(
            <ScheduleTemplateDialog
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
                courses={courses}
            />
        )

        expect(screen.getByRole('button', { name: /create template/i })).toBeDisabled()
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

        expect(screen.getAllByText('critical')).toHaveLength(1)
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
})
