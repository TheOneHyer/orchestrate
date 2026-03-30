import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { ScheduleTemplates } from './ScheduleTemplates'
import type { Course, ScheduleTemplate, Session } from '@/lib/types'

const useKVMock = vi.fn()
const setTemplatesMock = vi.fn()
const toastSuccess = vi.fn()

type MockScheduleTemplateDialogProps = {
    open: boolean
    template: ScheduleTemplate | null
    onOpenChange: (open: boolean) => void
    onSave: (data: Omit<ScheduleTemplate, 'id' | 'createdAt' | 'createdBy' | 'lastUsed' | 'usageCount'>) => void
}

vi.mock('@github/spark/hooks', () => ({
    useKV: (...args: unknown[]) => useKVMock(...args),
}))

vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => toastSuccess(...args),
    },
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({
        children,
        onClick,
        ...props
    }: {
        children: ReactNode
        onClick?: () => void
        [key: string]: unknown
    }) => (
        <button onClick={onClick} {...props}>{children}</button>
    ),
    DropdownMenuSeparator: () => <hr />,
}))

vi.mock('@/components/ScheduleTemplateDialog', () => ({
    ScheduleTemplateDialog: ({ open, template, onOpenChange, onSave }: MockScheduleTemplateDialogProps) => {
        if (!open) return null
        return (
            <div>
                <p>{template ? `Editing ${template.name}` : 'Creating Template'}</p>
                <button onClick={() => onOpenChange(true)}>Mock Keep Template Dialog Open</button>
                <button onClick={() => onOpenChange(false)}>Mock Close Template Dialog</button>
                <button
                    onClick={() =>
                        onSave({
                            name: 'Mock Template Name',
                            description: 'Mock template description',
                            category: 'ops',
                            recurrenceType: 'weekly',
                            sessions: [
                                {
                                    dayOfWeek: 1,
                                    time: '09:00',
                                    duration: 60,
                                    capacity: 10,
                                    requiresCertifications: [],
                                },
                            ],
                            autoAssignTrainers: true,
                            notifyParticipants: true,
                            tags: ['mock', 'ops'],
                            isActive: true,
                            courseId: 'c1',
                        })
                    }
                >
                    Mock Save Template
                </button>
            </div>
        )
    },
}))

vi.mock('@/components/ApplyTemplateDialog', () => ({
    ApplyTemplateDialog: ({ open, template, onApply }: { open: boolean; template: ScheduleTemplate | null; onApply: (sessions: Array<Partial<Session>>) => void }) => {
        if (!open || !template) {
            return null
        }
        return (
            <div>
                <p>Applying {template.name}</p>
                <button
                    onClick={() =>
                        onApply([
                            {
                                title: 'Generated Session',
                                courseId: template.courseId,
                                trainerId: 't1',
                            },
                        ])
                    }
                >
                    Mock Confirm Apply
                </button>
                <button
                    onClick={() =>
                        onApply([
                            {
                                title: 'Generated Session One',
                                courseId: template.courseId,
                                trainerId: 't1',
                            },
                            {
                                title: 'Generated Session Two',
                                courseId: template.courseId,
                                trainerId: 't2',
                            },
                        ])
                    }
                >
                    Mock Confirm Apply Multiple
                </button>
            </div>
        )
    },
}))

function createTemplate(overrides: Partial<ScheduleTemplate> = {}): ScheduleTemplate {
    return {
        id: 'template-1',
        name: 'Ops Rotation',
        description: 'Weekly ops schedule',
        category: 'operations',
        recurrenceType: 'weekly',
        sessions: [
            {
                dayOfWeek: 1,
                time: '09:00',
                duration: 60,
                capacity: 12,
                requiresCertifications: ['CPR'],
            },
        ],
        autoAssignTrainers: true,
        notifyParticipants: true,
        createdBy: 'admin',
        createdAt: '2026-01-01T00:00:00.000Z',
        usageCount: 2,
        tags: ['ops', 'safety'],
        isActive: true,
        courseId: 'c1',
        ...overrides,
    }
}

const courses: Course[] = [
    {
        id: 'c1',
        title: 'Safety Foundations',
        description: 'Course',
        modules: ['Intro'],
        duration: 60,
        certifications: [],
        createdBy: 'admin',
        createdAt: '2026-01-01',
        published: true,
        passScore: 80,
    },
]

describe('ScheduleTemplates', () => {
    let kvTemplates: ScheduleTemplate[]

    const getUpdater = (callIndex = 0): ((current: ScheduleTemplate[]) => ScheduleTemplate[]) =>
        setTemplatesMock.mock.calls[callIndex][0] as (current: ScheduleTemplate[]) => ScheduleTemplate[]

    beforeEach(() => {
        kvTemplates = [
            createTemplate({ id: 'template-1', name: 'Ops Rotation' }),
            createTemplate({ id: 'template-2', name: 'Inactive Template', isActive: false }),
        ]

        vi.clearAllMocks()
        useKVMock.mockImplementation((key: string, initial: unknown[]) => {
            if (key === 'schedule-templates') {
                return [kvTemplates, setTemplatesMock]
            }
            return [initial, vi.fn()]
        })
    })

    it('renders active templates and hides inactive templates', () => {
        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        expect(screen.getByText('Ops Rotation')).toBeInTheDocument()
        expect(screen.queryByText('Inactive Template')).not.toBeInTheDocument()
        expect(screen.getByText('operations')).toBeInTheDocument()
        expect(screen.getByText(/used 2 times/i)).toBeInTheDocument()
    })

    it('filters templates by search query', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        await user.type(screen.getByPlaceholderText(/search templates/i), 'nonexistent')

        expect(screen.getByText(/no templates found/i)).toBeInTheDocument()
        expect(screen.getByText(/try adjusting your filters/i)).toBeInTheDocument()
    })

    it('matches templates when search query matches a tag', async () => {
        const user = userEvent.setup()
        kvTemplates = [
            createTemplate({
                id: 'template-tag',
                name: 'Alpha Plan',
                description: 'General template',
                tags: ['night-shift', 'rotation'],
            }),
        ]

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        await user.type(screen.getByPlaceholderText(/search templates/i), 'night-shift')
        expect(screen.getByText('Alpha Plan')).toBeInTheDocument()
    })

    it('filters out templates when category filter does not match', async () => {
        const user = userEvent.setup()
        kvTemplates = [
            createTemplate({ id: 'template-ops', name: 'Ops Template', category: 'operations' }),
            createTemplate({ id: 'template-safety', name: 'Safety Template', category: 'safety' }),
        ]

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        await user.click(screen.getByRole('combobox'))
        await user.click(screen.getByRole('option', { name: /safety/i }))

        expect(screen.getByText('Safety Template')).toBeInTheDocument()
        expect(screen.queryByText('Ops Template')).not.toBeInTheDocument()
    })

    it('renders no templates state when KV templates are empty', () => {
        kvTemplates = []

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        expect(screen.getByText(/no templates found/i)).toBeInTheDocument()
        expect(setTemplatesMock).not.toHaveBeenCalled()
    })

    it('handles undefined persisted templates and creates a template from an empty fallback array', async () => {
        const user = userEvent.setup()
        useKVMock.mockImplementation((key: string, initial: unknown[]) => {
            if (key === 'schedule-templates') {
                return [undefined, setTemplatesMock]
            }
            return [initial, vi.fn()]
        })

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        expect(screen.getByText(/no templates found/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /new template/i }))
        await user.click(screen.getByRole('button', { name: /mock save template/i }))

        expect(setTemplatesMock).toHaveBeenCalledWith(expect.any(Function))

        const updater = setTemplatesMock.mock.calls[0][0] as (current: ScheduleTemplate[] | undefined) => ScheduleTemplate[]
        const updated = updater(undefined)

        expect(updated).toHaveLength(1)
        expect(updated[0]).toEqual(expect.objectContaining({ name: 'Mock Template Name' }))
    })

    it('shows empty-state create CTA and opens creation dialog', async () => {
        const user = userEvent.setup()
        kvTemplates = []

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: /create template/i }))
        expect(screen.getByText(/creating template/i)).toBeInTheDocument()
    })

    it('keeps the template dialog open when onOpenChange(true) is emitted', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: /new template/i }))
        expect(screen.getByText(/creating template/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /mock keep template dialog open/i }))

        expect(screen.getByText(/creating template/i)).toBeInTheDocument()
    })

    it('handles legacy templates with missing optional metadata and still supports edit/duplicate', async () => {
        const user = userEvent.setup()
        const legacyTemplate = {
            ...createTemplate({ id: 'template-legacy', name: 'Legacy Template' }),
            usageCount: undefined,
            createdBy: undefined,
            lastUsed: undefined,
        } as unknown as ScheduleTemplate
        kvTemplates = [legacyTemplate]

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        const card = screen.getByTestId('template-card-template-legacy')
        expect(screen.getByText('Legacy Template')).toBeInTheDocument()

        await user.click(within(card).getByRole('button', { name: /edit/i }))
        await user.click(screen.getByRole('button', { name: /mock save template/i }))
        expect(setTemplatesMock).toHaveBeenCalled()

        await user.click(within(card).getByRole('button', { name: /duplicate/i }))
        expect(setTemplatesMock).toHaveBeenCalledTimes(2)
        expect(toastSuccess).toHaveBeenCalledWith('Template duplicated successfully')
    })

    it('handles special-character search terms without crashing', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        await user.type(screen.getByPlaceholderText(/search templates/i), '[ops]++??')
        expect(screen.getByText(/no templates found/i)).toBeInTheDocument()

        await user.clear(screen.getByPlaceholderText(/search templates/i))
        await user.type(screen.getByPlaceholderText(/search templates/i), 'ops')
        expect(screen.getByText('Ops Rotation')).toBeInTheDocument()
    })

    it('creates a new template via dialog save', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: /new template/i }))
        expect(screen.getByText('Creating Template')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /mock save template/i }))

        expect(setTemplatesMock).toHaveBeenCalledTimes(1)
        const updater = getUpdater()
        const next = updater(kvTemplates)

        expect(next.length).toBe(3)
        const createdTemplate = next.find((template) => template.name === 'Mock Template Name')
        expect(createdTemplate).toBeDefined()
        expect(createdTemplate).toEqual(
            expect.objectContaining({
                name: 'Mock Template Name',
                usageCount: 0,
                createdBy: 'admin',
            })
        )
        expect(toastSuccess).toHaveBeenCalledWith('Template created successfully')
    })

    it('applies a template and creates sessions', async () => {
        const user = userEvent.setup()
        const onCreateSessions = vi.fn()

        render(<ScheduleTemplates courses={courses} onCreateSessions={onCreateSessions} />)

        const applyButton = screen.getByTestId('apply-template-template-1')
        await user.click(applyButton)

        expect(screen.getByText(/applying ops rotation/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /^mock confirm apply$/i }))

        expect(onCreateSessions).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ title: 'Generated Session', courseId: 'c1' }),
            ])
        )

        expect(setTemplatesMock).toHaveBeenCalledTimes(1)
        const updater = getUpdater()
        const next = updater(kvTemplates)
        const updatedTemplate = next.find((t) => t.id === 'template-1')

        expect(updatedTemplate?.usageCount).toBe(3)
        expect(updatedTemplate?.lastUsed).toBeTruthy()
        expect(toastSuccess).toHaveBeenCalledWith('1 session created successfully')
    })

    it('applies a template with plural success copy even when onCreateSessions is not provided', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} />)

        await user.click(screen.getByTestId('apply-template-template-1'))
        await user.click(screen.getByRole('button', { name: /mock confirm apply multiple/i }))

        expect(toastSuccess).toHaveBeenCalledWith('2 sessions created successfully')
        expect(setTemplatesMock).toHaveBeenCalled()
    })

    it('does not expose apply actions when the apply dialog is closed', () => {
        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        expect(screen.queryByRole('button', { name: /^mock confirm apply$/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /^mock confirm apply multiple$/i })).not.toBeInTheDocument()
    })

    it('opens apply dialog from dropdown menu apply action', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        const card = screen.getByTestId('template-card-template-1')
        const applyButton = within(card).getByTestId('dropdown-apply-template')
        await user.click(applyButton)

        expect(screen.getByText(/applying ops rotation/i)).toBeInTheDocument()
    })

    it('duplicates and deletes templates from menu actions', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        const card = screen.getByTestId('template-card-template-1')

        await user.click(within(card).getByRole('button', { name: /duplicate/i }))
        expect(setTemplatesMock).toHaveBeenCalledTimes(1)
        let updater = getUpdater(0)
        let next = updater(kvTemplates)

        expect(next.some((t) => t.name === 'Ops Rotation (Copy)')).toBe(true)
        expect(toastSuccess).toHaveBeenCalledWith('Template duplicated successfully')

        await user.click(within(card).getByRole('button', { name: /delete/i }))
        expect(setTemplatesMock).toHaveBeenCalledTimes(2)
        updater = getUpdater(1)
        next = updater(kvTemplates)

        expect(next.some((t) => t.id === 'template-1')).toBe(false)
        expect(toastSuccess).toHaveBeenCalledWith('Template deleted')
    })

    it('opens edit mode and updates an existing template', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        const card = screen.getByTestId('template-card-template-1')
        await user.click(within(card).getByRole('button', { name: /edit/i }))

        expect(screen.getByText('Editing Ops Rotation')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /mock save template/i }))

        expect(setTemplatesMock).toHaveBeenCalledTimes(1)
        const updater = getUpdater()
        const next = updater(kvTemplates)

        expect(next.find((t) => t.id === 'template-1')).toEqual(
            expect.objectContaining({ name: 'Mock Template Name' })
        )
        expect(toastSuccess).toHaveBeenCalledWith('Template updated successfully')
    })

    it('clears editing state when template dialog closes', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        const card = screen.getByTestId('template-card-template-1')
        await user.click(within(card).getByRole('button', { name: /edit/i }))
        expect(screen.getByText('Editing Ops Rotation')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /mock close template dialog/i }))
        await user.click(screen.getByRole('button', { name: /new template/i }))

        expect(screen.getByText('Creating Template')).toBeInTheDocument()
    })

    it('renders plural session badge, singular used badge, overflow tags badge, and last-used date', () => {
        const richTemplate = createTemplate({
            id: 'template-rich',
            name: 'Rich Template',
            sessions: [
                { dayOfWeek: 1, time: '09:00', duration: 60, capacity: 10, requiresCertifications: [] },
                { dayOfWeek: 2, time: '10:00', duration: 60, capacity: 10, requiresCertifications: [] },
                { dayOfWeek: 3, time: '11:00', duration: 60, capacity: 10, requiresCertifications: [] },
            ],
            usageCount: 1,
            tags: ['ops', 'safety', 'morning', 'beginner'],
            lastUsed: '2026-03-01T00:00:00.000Z',
        })

        useKVMock.mockImplementation((key: string, initial: unknown[]) => {
            if (key === 'schedule-templates') return [[richTemplate], setTemplatesMock]
            return [initial, vi.fn()]
        })

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        // sessions.length !== 1 → plural "sessions"
        expect(screen.getByText(/3 sessions/i)).toBeInTheDocument()
        // usageCount !== 1 is false (usageCount = 1) → singular "time"
        expect(screen.getByText(/used 1 time\b/i)).toBeInTheDocument()
        // tags.length > 3 → overflow badge (+1)
        expect(screen.getByText('+1')).toBeInTheDocument()
        // lastUsed is set → "Last: Mar 1" rendered
        expect(screen.getByText(/last:/i)).toBeInTheDocument()
    })

    it('handles undefined persisted template arrays in updater callbacks', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        // Create flow (updater index 0)
        await user.click(screen.getByRole('button', { name: /new template/i }))
        await user.click(screen.getByRole('button', { name: /mock save template/i }))

        const createUpdater = getUpdater(0)
        const createdFromUndefined = createUpdater(undefined as unknown as ScheduleTemplate[])
        expect(createdFromUndefined).toHaveLength(1)
        expect(createdFromUndefined[0]).toEqual(expect.objectContaining({ name: 'Mock Template Name' }))

        // Duplicate flow (updater index 1)
        const templateCard = screen.getByTestId('template-card-template-1')
        await user.click(within(templateCard).getByRole('button', { name: /duplicate/i }))
        const duplicateUpdater = getUpdater(1)
        const duplicatedFromUndefined = duplicateUpdater(undefined as unknown as ScheduleTemplate[])
        expect(duplicatedFromUndefined).toHaveLength(1)
        expect(duplicatedFromUndefined[0].name).toMatch(/\(copy\)$/i)

        // Delete flow (updater index 2)
        await user.click(within(templateCard).getByRole('button', { name: /delete/i }))
        const deleteUpdater = getUpdater(2)
        expect(deleteUpdater(undefined as unknown as ScheduleTemplate[])).toEqual([])

        // Edit flow (updater index 3)
        await user.click(within(templateCard).getByRole('button', { name: /edit/i }))
        await user.click(screen.getByRole('button', { name: /mock save template/i }))
        const editUpdater = getUpdater(3)
        expect(editUpdater(undefined as unknown as ScheduleTemplate[])).toEqual([])

        // Apply flow (updater index 4)
        await user.click(screen.getByTestId('apply-template-template-1'))
        await user.click(screen.getByRole('button', { name: /^mock confirm apply$/i }))
        const applyUpdater = getUpdater(4)
        expect(applyUpdater(undefined as unknown as ScheduleTemplate[])).toEqual([])
    })

    it('renders null for last-used date when lastUsed is an invalid date string', () => {
        // Use an invalid lastUsed value so parseISO produces an invalid Date.
        const badDateTemplate = createTemplate({
            id: 'template-bad-date',
            name: 'Bad Date Template',
            lastUsed: 'not-a-real-date',
        })

        useKVMock.mockImplementation((key: string, initial: unknown[]) => {
            if (key === 'schedule-templates') return [[badDateTemplate], setTemplatesMock]
            return [initial, vi.fn()]
        })

        render(<ScheduleTemplates courses={courses} onCreateSessions={vi.fn()} />)

        expect(screen.getByText('Bad Date Template')).toBeInTheDocument()
        // Invalid lastUsed should suppress the rendered "Last:" metadata.
        expect(screen.queryByText(/last:/i)).not.toBeInTheDocument()
    })
})
