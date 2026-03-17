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
    DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
        <button onClick={onClick}>{children}</button>
    ),
    DropdownMenuSeparator: () => <hr />,
}))

vi.mock('@/components/ScheduleTemplateDialog', () => ({
    ScheduleTemplateDialog: ({ open, template, onSave }: MockScheduleTemplateDialogProps) => {
        if (!open) return null
        return (
            <div>
                <p>{template ? `Editing ${template.name}` : 'Creating Template'}</p>
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
        if (!open || !template) return null
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
        render(<ScheduleTemplates courses={courses} onNavigate={vi.fn()} onCreateSessions={vi.fn()} />)

        expect(screen.getByText('Ops Rotation')).toBeInTheDocument()
        expect(screen.queryByText('Inactive Template')).not.toBeInTheDocument()
        expect(screen.getByText('operations')).toBeInTheDocument()
        expect(screen.getByText(/used 2 times/i)).toBeInTheDocument()
    })

    it('filters templates by search query', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onNavigate={vi.fn()} onCreateSessions={vi.fn()} />)

        await user.type(screen.getByPlaceholderText(/search templates/i), 'nonexistent')

        expect(screen.getByText(/no templates found/i)).toBeInTheDocument()
        expect(screen.getByText(/try adjusting your filters/i)).toBeInTheDocument()
    })

    it('renders no templates state when KV templates are empty', () => {
        kvTemplates = []

        render(<ScheduleTemplates courses={courses} onNavigate={vi.fn()} onCreateSessions={vi.fn()} />)

        expect(screen.getByText(/no templates found/i)).toBeInTheDocument()
        expect(setTemplatesMock).not.toHaveBeenCalled()
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

        render(<ScheduleTemplates courses={courses} onNavigate={vi.fn()} onCreateSessions={vi.fn()} />)

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

        render(<ScheduleTemplates courses={courses} onNavigate={vi.fn()} onCreateSessions={vi.fn()} />)

        await user.type(screen.getByPlaceholderText(/search templates/i), '[ops]++??')
        expect(screen.getByText(/no templates found/i)).toBeInTheDocument()

        await user.clear(screen.getByPlaceholderText(/search templates/i))
        await user.type(screen.getByPlaceholderText(/search templates/i), 'ops')
        expect(screen.getByText('Ops Rotation')).toBeInTheDocument()
    })

    it('creates a new template via dialog save', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onNavigate={vi.fn()} onCreateSessions={vi.fn()} />)

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

        render(<ScheduleTemplates courses={courses} onNavigate={vi.fn()} onCreateSessions={onCreateSessions} />)

        const applyButton = screen.getByTestId('apply-template-template-1')
        await user.click(applyButton)

        expect(screen.getByText(/applying ops rotation/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /mock confirm apply/i }))

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

    it('duplicates and deletes templates from menu actions', async () => {
        const user = userEvent.setup()

        render(<ScheduleTemplates courses={courses} onNavigate={vi.fn()} onCreateSessions={vi.fn()} />)

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

        render(<ScheduleTemplates courses={courses} onNavigate={vi.fn()} onCreateSessions={vi.fn()} />)

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
})
