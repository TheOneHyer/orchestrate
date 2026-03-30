import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, addMonths, addWeeks } from 'date-fns'
import { describe, expect, it, vi } from 'vitest'

import { ApplyTemplateDialog } from './ApplyTemplateDialog'
import type { ScheduleTemplate } from '@/lib/types'

const templateSessions: ScheduleTemplate['sessions'] = [
    {
        dayOfWeek: 1,
        time: '09:30',
        duration: 60,
        location: 'Room A',
        capacity: 12,
        requiresCertifications: [],
        shift: 'day',
    },
    {
        dayOfWeek: 3,
        time: '14:00',
        duration: 90,
        location: 'Room B',
        capacity: 8,
        requiresCertifications: [],
        shift: 'evening',
    },
]

const template: ScheduleTemplate = {
    id: 'tpl-1',
    name: 'Weekly Safety Template',
    description: 'Weekly recurring safety practice sessions',
    courseId: 'course-default',
    category: 'Safety',
    recurrenceType: 'weekly',
    sessions: templateSessions,
    autoAssignTrainers: true,
    notifyParticipants: true,
    createdBy: 'admin-1',
    createdAt: '2026-03-01T00:00:00.000Z',
    usageCount: 0,
    tags: [],
    isActive: true,
}

function createTemplate(overrides: Partial<ScheduleTemplate> = {}): ScheduleTemplate {
    return {
        ...template,
        ...overrides,
    }
}

function getCreateButton() {
    return screen.getByRole('button', { name: /create/i })
}

describe('ApplyTemplateDialog', () => {
    it('disables create when template is missing', () => {
        render(
            <ApplyTemplateDialog
                open={true}
                onOpenChange={vi.fn()}
                template={null}
                onApply={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: /create 0 sessions/i })).toBeDisabled()
    })

    it('renders template metadata and preview list', () => {
        render(
            <ApplyTemplateDialog
                open={true}
                onOpenChange={vi.fn()}
                template={template}
                onApply={vi.fn()}
            />
        )

        expect(screen.getByText(/weekly safety template/i)).toBeInTheDocument()
        expect(screen.getByText(/weekly recurring safety practice sessions/i)).toBeInTheDocument()
        expect(screen.getByText(/2 sessions per cycle/i)).toBeInTheDocument()
        expect(screen.getByText(/preview \(first/i)).toBeInTheDocument()
    })

    it('creates generated sessions with override values', async () => {
        const onApply = vi.fn()
        const onOpenChange = vi.fn()
        const user = userEvent.setup()

        render(
            <ApplyTemplateDialog
                open={true}
                onOpenChange={onOpenChange}
                template={template}
                onApply={onApply}
            />
        )

        await user.clear(screen.getByLabelText(/start date/i))
        await user.type(screen.getByLabelText(/start date/i), '2026-03-17')
        await user.clear(screen.getByLabelText(/number of cycles/i))
        await user.type(screen.getByLabelText(/number of cycles/i), '2')
        await user.clear(screen.getByLabelText(/course override/i))
        await user.type(screen.getByLabelText(/course override/i), 'course-override')
        await user.clear(screen.getByLabelText(/location override/i))
        await user.type(screen.getByLabelText(/location override/i), 'Main Lab')
        await user.clear(screen.getByLabelText(/capacity override/i))
        await user.type(screen.getByLabelText(/capacity override/i), '20')

        await user.click(screen.getByRole('button', { name: /create 4 sessions/i }))

        expect(onApply).toHaveBeenCalledOnce()
        const sessions = onApply.mock.calls[0][0]
        expect(sessions).toHaveLength(4)
        expect(sessions[0]).toEqual(
            expect.objectContaining({
                courseId: 'course-override',
                location: 'Main Lab',
                capacity: 20,
                status: 'scheduled',
            })
        )

        const first = new Date(sessions[0].startTime)
        const firstEnd = new Date(sessions[0].endTime)
        // Start date 2026-03-17 with first template session on Monday always lands on 2026-03-23.
        // Compare dates by normalizing to the same timezone (using getTime())
        const firstSessionTemplate = template.sessions[0]
        const [hours, minutes] = firstSessionTemplate.time.split(':').map(Number)
        const expectedFirstStart = new Date(2026, 2, 23, hours, minutes, 0, 0)

        expect(first.getTime()).toBe(expectedFirstStart.getTime())
        expect(firstEnd.getTime() - first.getTime()).toBe(60 * 60 * 1000)
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('shows overflow preview hint when total sessions exceed five', async () => {
        const user = userEvent.setup()

        render(
            <ApplyTemplateDialog
                open={true}
                onOpenChange={vi.fn()}
                template={template}
                onApply={vi.fn()}
            />
        )

        await user.clear(screen.getByLabelText(/number of cycles/i))
        await user.type(screen.getByLabelText(/number of cycles/i), '3')

        expect(await screen.findByText(/and 1 more session/i)).toBeInTheDocument()
        expect(await screen.findByRole('button', { name: /create 6 sessions/i })).toBeInTheDocument()
    })

    it('uses singular copy for one session per cycle and one total session', () => {
        const singleSessionTemplate = createTemplate({
            sessions: [
                {
                    dayOfWeek: 2,
                    time: '10:00',
                    duration: 45,
                    location: 'Solo Room',
                    capacity: 10,
                    requiresCertifications: [],
                    shift: 'day',
                },
            ],
        })

        render(
            <ApplyTemplateDialog
                open={true}
                onOpenChange={vi.fn()}
                template={singleSessionTemplate}
                onApply={vi.fn()}
            />
        )

        fireEvent.change(screen.getByLabelText(/number of cycles/i), { target: { value: '1' } })

        expect(screen.getByText(/1 session per cycle/i)).toBeInTheDocument()
        const totalSessionCopyMatches = screen.queryAllByText((_, element) =>
            element?.textContent?.replace(/\s+/g, ' ').includes('Will create 1 total session') ?? false
        )
        expect(totalSessionCopyMatches.length).toBeGreaterThan(0)
        expect(screen.getByRole('button', { name: /create 1 session/i })).toBeEnabled()
    })

    it('shows course override placeholder for templates without a default course id', () => {
        render(
            <ApplyTemplateDialog
                open={true}
                onOpenChange={vi.fn()}
                template={createTemplate({ courseId: undefined })}
                onApply={vi.fn()}
            />
        )

        expect(screen.getByPlaceholderText(/leave empty to set later/i)).toBeInTheDocument()
    })

    it('falls back to empty courseId and TBD location when template and overrides omit values', async () => {
        const onApply = vi.fn()
        const user = userEvent.setup()
        const noDefaultsTemplate = createTemplate({
            courseId: undefined,
            sessions: [
                {
                    dayOfWeek: 1,
                    time: '09:00',
                    duration: 30,
                    location: undefined,
                    capacity: 12,
                    requiresCertifications: [],
                    shift: 'day',
                },
            ],
        })

        render(
            <ApplyTemplateDialog
                open={true}
                onOpenChange={vi.fn()}
                template={noDefaultsTemplate}
                onApply={onApply}
            />
        )

        await user.click(getCreateButton())

        expect(onApply).toHaveBeenCalledOnce()
        expect(onApply.mock.calls[0][0][0]).toEqual(
            expect.objectContaining({
                courseId: '',
                location: 'TBD',
            })
        )
    })

    it.each([
        ['daily', undefined, (base: Date) => addDays(base, 1)],
        ['biweekly', undefined, (base: Date) => addWeeks(base, 2)],
        ['monthly', undefined, (base: Date) => addMonths(base, 1)],
        ['custom', 3, (base: Date) => addDays(base, 3)],
        ['unexpected', undefined, (base: Date) => addWeeks(base, 1)],
    ] as const)(
        'generates the next cycle correctly for %s recurrence',
        async (recurrenceType, cycleDays, getExpectedSecondStart) => {
            const onApply = vi.fn()
            const user = userEvent.setup()
            const recurrenceTemplate = createTemplate({
                recurrenceType: recurrenceType as unknown as ScheduleTemplate['recurrenceType'],
                cycleDays,
                sessions: [
                    {
                        time: '09:00',
                        duration: 60,
                        capacity: 10,
                        requiresCertifications: [],
                        shift: 'day',
                    },
                ],
            })

            render(
                <ApplyTemplateDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    template={recurrenceTemplate}
                    onApply={onApply}
                />
            )

            const startDateInput = screen.getByLabelText(/start date/i)
            await user.clear(startDateInput)
            await user.type(startDateInput, '2026-03-17')

            const cyclesInput = screen.getByLabelText(/number of cycles/i)
            await user.clear(cyclesInput)
            await user.type(cyclesInput, '2')

            await user.click(getCreateButton())

            expect(onApply).toHaveBeenCalledOnce()
            const sessions = onApply.mock.calls[0][0]
            expect(sessions).toHaveLength(2)

            const baseStart = new Date(2026, 2, 17, 9, 0, 0, 0)
            const expectedSecondStart = getExpectedSecondStart(baseStart)
            expect(new Date(sessions[1].startTime).getTime()).toBe(expectedSecondStart.getTime())
        }
    )

    it('uses a default cycle interval of 7 days when a custom template omits cycleDays', async () => {
        const onApply = vi.fn()
        const user = userEvent.setup()

        const customTemplate = createTemplate({ recurrenceType: 'custom', cycleDays: undefined })

        render(
            <ApplyTemplateDialog
                open={true}
                onOpenChange={vi.fn()}
                template={customTemplate}
                onApply={onApply}
            />
        )

        const startDateInput = screen.getByLabelText(/start date/i)
        await user.clear(startDateInput)
        await user.type(startDateInput, '2026-03-16')

        const cyclesInput = screen.getByLabelText(/number of cycles/i)
        await user.clear(cyclesInput)
        await user.type(cyclesInput, '2')

        await user.click(getCreateButton())

        expect(onApply).toHaveBeenCalledOnce()
        const sessions = onApply.mock.calls[0][0]
        expect(sessions.length).toBeGreaterThan(templateSessions.length)
        const secondCycleStart = new Date(sessions[templateSessions.length].startTime)
        const firstCycleStart = new Date(sessions[0].startTime)
        const dayDiff = Math.round((secondCycleStart.getTime() - firstCycleStart.getTime()) / (1000 * 60 * 60 * 24))
        expect(dayDiff).toBe(7)
    })

})
