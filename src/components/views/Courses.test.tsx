import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Courses } from './Courses'
import type { Course, Enrollment, User } from '@/lib/types'

const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('sonner', () => ({
    toast: {
        error: (...args: unknown[]) => toastError(...args),
        success: (...args: unknown[]) => toastSuccess(...args),
    },
}))

beforeEach(() => {
    toastError.mockClear()
    toastSuccess.mockClear()
    vi.stubGlobal('confirm', vi.fn(() => true))
})

afterEach(() => {
    vi.unstubAllGlobals()
})

function createUser(overrides: Partial<User> = {}): User {
    return {
        id: 'u-default',
        name: 'Default User',
        email: 'default@example.com',
        role: 'employee',
        department: 'Operations',
        certifications: [],
        hireDate: '2025-01-01',
        ...overrides,
    }
}

function createCourse(overrides: Partial<Course> = {}): Course {
    return {
        id: 'c-default',
        title: 'Default Course',
        description: 'Default description',
        modules: ['Intro'],
        duration: 90,
        certifications: [],
        createdBy: 'u-admin',
        createdAt: '2026-01-01T00:00:00.000Z',
        published: true,
        passScore: 80,
        ...overrides,
    }
}

async function addMinimalModule(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /add module/i }))
    await user.clear(screen.getByDisplayValue('Module 1'))
    await user.type(screen.getByPlaceholderText(/incident response overview/i), 'Intro Module')
}

async function fillValidCourseForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/title/i), 'New Safety Course')
    await user.type(screen.getByLabelText(/description/i), 'Course description')
    await user.clear(screen.getByLabelText(/duration \(minutes\)/i))
    await user.type(screen.getByLabelText(/duration \(minutes\)/i), '120')
    await user.clear(screen.getByLabelText(/pass score/i))
    await user.type(screen.getByLabelText(/pass score/i), '85')
    await user.type(screen.getByLabelText(/certifications/i), 'Safety Cert')
    await addMinimalModule(user)
}

describe('Courses', () => {
    it('shows an error when navigation payload references a missing course id', () => {
        render(
            <Courses
                courses={[createCourse({ id: 'c-other' })]}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={vi.fn()}
                navigationPayload={{ courseId: 'missing-course' }}
            />
        )

        expect(toastError).toHaveBeenCalledWith(
            'Course not found',
            expect.objectContaining({ description: expect.stringMatching(/could not be opened/i) })
        )
    })

    it('does not show an error when courseId payload arrives before courses are loaded', () => {
        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={vi.fn()}
                navigationPayload={{ courseId: 'missing-course' }}
            />
        )

        expect(toastError).not.toHaveBeenCalled()
    })

    it('retries deferred courseId payload when courses later become available', () => {
        const payload = { courseId: 'c1' }
        const { rerender } = render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={vi.fn()}
                navigationPayload={payload}
            />
        )

        expect(screen.queryByRole('dialog')).toBeNull()

        rerender(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Safety Foundations', description: 'Deferred payload target' })]}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={vi.fn()}
                navigationPayload={payload}
            />
        )

        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByRole('heading', { name: /safety foundations/i })).toBeInTheDocument()
    })

    it('renders courses, module counts, and durations', () => {
        const courses: Course[] = [
            createCourse({ id: 'c1', title: 'Safety Foundations', duration: 90, modules: ['Intro', 'Quiz'] }),
            createCourse({ id: 'c2', title: 'Warehouse Basics', duration: 60, modules: ['Lesson 1'] }),
        ]

        render(
            <Courses
                courses={courses}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={vi.fn()}
            />
        )

        expect(screen.getByText('Safety Foundations')).toBeInTheDocument()
        expect(screen.getByText('Warehouse Basics')).toBeInTheDocument()
        expect(screen.getByText('1h 30m')).toBeInTheDocument()
        expect(screen.getByText('1h')).toBeInTheDocument()
        expect(screen.getByText('2 modules')).toBeInTheDocument()
        expect(screen.getByText('1 module')).toBeInTheDocument()
    })

    it('shows Create Course action for admin and trainer roles only', () => {
        const onNavigate = vi.fn()

        const { rerender } = render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={onNavigate}
            />
        )

        expect(screen.getByRole('button', { name: /create course/i })).toBeInTheDocument()

        rerender(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'trainer-1', role: 'trainer' })}
                onNavigate={onNavigate}
            />
        )

        expect(screen.getByRole('button', { name: /create course/i })).toBeInTheDocument()

        rerender(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'employee-1', role: 'employee' })}
                onNavigate={onNavigate}
            />
        )

        expect(screen.queryByRole('button', { name: /create course/i })).toBeNull()
    })

    it('navigates to create flow when Create Course is clicked', async () => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={onNavigate}
            />
        )

        await user.click(screen.getByRole('button', { name: /create course/i }))

        expect(onNavigate).not.toHaveBeenCalled()
        expect(screen.getByRole('heading', { name: /create course/i })).toBeInTheDocument()
    })

    it('filters courses by title or description using case-insensitive search', async () => {
        const user = userEvent.setup()

        const courses: Course[] = [
            createCourse({ id: 'c1', title: 'Forklift Certification', description: 'Lift safety and operations' }),
            createCourse({ id: 'c2', title: 'Customer Service', description: 'Conflict resolution and communication' }),
        ]

        render(
            <Courses
                courses={courses}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={vi.fn()}
            />
        )

        await user.type(screen.getByPlaceholderText(/search courses/i), 'fOrKlIfT')

        expect(screen.getByText('Forklift Certification')).toBeInTheDocument()
        expect(screen.queryByText('Customer Service')).toBeNull()

        await user.clear(screen.getByPlaceholderText(/search courses/i))
        expect(screen.getByText('Forklift Certification')).toBeInTheDocument()
        expect(screen.getByText('Customer Service')).toBeInTheDocument()

        await user.type(screen.getByPlaceholderText(/search courses/i), 'communication')

        expect(screen.getByText('Customer Service')).toBeInTheDocument()
        expect(screen.queryByText('Forklift Certification')).toBeNull()
    })

    it('renders a Draft badge for unpublished courses', () => {
        const courses: Course[] = [
            createCourse({
                id: 'c1',
                title: 'Hazmat Intro',
                published: false,
                certifications: ['Hazmat', 'Safety', 'PPE'],
            }),
        ]

        render(
            <Courses
                courses={courses}
                enrollments={[]}
                currentUser={createUser({ id: 'u1', role: 'employee' })}
                onNavigate={vi.fn()}
            />
        )

        expect(screen.getByText('Draft')).toBeInTheDocument()
    })

    it('renders certification labels and overflow indicator', () => {
        const courses: Course[] = [
            createCourse({
                id: 'c1',
                title: 'Hazmat Intro',
                published: false,
                certifications: ['Hazmat', 'Safety', 'PPE'],
            }),
        ]

        render(
            <Courses
                courses={courses}
                enrollments={[]}
                currentUser={createUser({ id: 'u1', role: 'employee' })}
                onNavigate={vi.fn()}
            />
        )

        expect(screen.getByText('Hazmat')).toBeInTheDocument()
        expect(screen.getByText('Safety')).toBeInTheDocument()
        expect(screen.getByText('+1')).toBeInTheDocument()
    })

    it('renders only current user enrollment progress', () => {
        const currentUser = createUser({ id: 'u1', role: 'employee' })

        const courses: Course[] = [
            createCourse({
                id: 'c1',
                title: 'Hazmat Intro',
                published: false,
                certifications: ['Hazmat', 'Safety', 'PPE'],
            }),
        ]

        const enrollments: Enrollment[] = [
            { id: 'e1', userId: 'u1', courseId: 'c1', status: 'in-progress', progress: 75, enrolledAt: '2026-01-01' },
            { id: 'e2', userId: 'other-user', courseId: 'c1', status: 'completed', progress: 100, enrolledAt: '2026-01-02' },
        ]

        render(
            <Courses
                courses={courses}
                enrollments={enrollments}
                currentUser={currentUser}
                onNavigate={vi.fn()}
            />
        )

        expect(screen.getByText('Draft')).toBeInTheDocument()
        expect(screen.getByText('Hazmat')).toBeInTheDocument()
        expect(screen.getByText('Safety')).toBeInTheDocument()
        expect(screen.getByText('+1')).toBeInTheDocument()
        expect(screen.getByText('Progress')).toBeInTheDocument()
        expect(screen.getByText('75%')).toBeInTheDocument()
        expect(screen.queryByText('100%')).toBeNull()
        expect(screen.getByText('in-progress')).toBeInTheDocument()
    })

    it('navigates to course details when a course card is clicked', async () => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()

        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Safety Foundations' })]}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={onNavigate}
            />
        )

        await user.click(screen.getByText('Safety Foundations'))

        expect(onNavigate).toHaveBeenCalledWith('courses', { courseId: 'c1' })
    })

    it('shows empty state when no courses match the search query', async () => {
        const user = userEvent.setup()

        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Safety Foundations' })]}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={vi.fn()}
            />
        )

        await user.type(screen.getByPlaceholderText(/search courses/i), 'nonexistent')

        expect(screen.getByText(/no courses found/i)).toBeInTheDocument()
        expect(screen.queryByText('Safety Foundations')).toBeNull()
    })

    it('opens course detail dialog when courseId is provided in navigation payload', () => {
        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Safety Foundations', description: 'Detailed description' })]}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={vi.fn()}
                navigationPayload={{ courseId: 'c1' }}
            />
        )

        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByRole('heading', { name: /safety foundations/i })).toBeInTheDocument()
        expect(within(dialog).getByText(/detailed description/i)).toBeInTheDocument()
    })

    it('calls onNavigate when Enter key is pressed on course card', async () => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()

        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Safety Foundations' })]}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={onNavigate}
            />
        )

        const card = screen.getByRole('button', { name: /open course safety foundations/i })
        card.focus()
        await user.keyboard('{Enter}')

        expect(onNavigate).toHaveBeenCalledWith('courses', { courseId: 'c1' })
    })

    it('calls onNavigate when Space key is pressed on course card', async () => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()

        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Safety Foundations' })]}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={onNavigate}
            />
        )

        const card = screen.getByRole('button', { name: /open course safety foundations/i })
        card.focus()
        await user.keyboard('{ }')

        expect(onNavigate).toHaveBeenCalledWith('courses', { courseId: 'c1' })
    })

    it('does not call onNavigate for non-activation keys on course cards', async () => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()

        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Safety Foundations' })]}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={onNavigate}
            />
        )

        const card = screen.getByRole('button', { name: /open course safety foundations/i })
        card.focus()
        await user.keyboard('{Escape}')

        expect(onNavigate).not.toHaveBeenCalled()
    })

    it('opens create dialog when create intent is provided in navigation payload', () => {
        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={vi.fn()}
                navigationPayload={{ create: true }}
            />
        )

        expect(screen.getByRole('heading', { name: /create course/i })).toBeInTheDocument()
    })

    it('does not open the create dialog when navigation payload create is false', () => {
        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={vi.fn()}
                navigationPayload={{ create: false }}
            />
        )

        expect(screen.queryByRole('heading', { name: /create course/i })).toBeNull()
        expect(toastError).not.toHaveBeenCalled()
    })

    it('creates a course when create dialog is submitted', async () => {
        const user = userEvent.setup()
        const onCreateCourse = vi.fn()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={onCreateCourse}
                navigationPayload={{ create: true }}
            />
        )

        await fillValidCourseForm(user)

        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(onCreateCourse).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'New Safety Course',
                description: 'Course description',
                duration: 120,
                passScore: 85,
                modules: ['Intro Module'],
                certifications: ['Safety Cert'],
                createdBy: 'admin-1',
                published: false,
                moduleDetails: [
                    expect.objectContaining({
                        title: 'Intro Module',
                        contentType: 'text',
                    }),
                ],
            })
        )
        expect(onCreateCourse.mock.calls[0]?.[0]?.id).toBeUndefined()
        expect(screen.queryByRole('heading', { name: /create course/i })).toBeNull()
        expect(toastSuccess).toHaveBeenCalledWith(
            'Course created',
            expect.objectContaining({ description: expect.stringMatching(/added to the catalog/i) })
        )
    })

    it('keeps the create dialog open when course creation fails', async () => {
        const user = userEvent.setup()
        const onCreateCourse = vi.fn().mockRejectedValue(new Error('Service unavailable'))

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={onCreateCourse}
                navigationPayload={{ create: true }}
            />
        )

        await fillValidCourseForm(user)
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(onCreateCourse).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('heading', { name: /create course/i })).toBeInTheDocument()
        expect(screen.getByLabelText(/title/i)).toHaveValue('New Safety Course')
        expect(toastError).toHaveBeenCalledWith(
            'Course save failed',
            expect.objectContaining({ description: 'Service unavailable' })
        )
        expect(toastSuccess).not.toHaveBeenCalled()
    })

    it('shows a fallback error message when course creation fails without an Error object', async () => {
        const user = userEvent.setup()
        const onCreateCourse = vi.fn().mockRejectedValue('bad gateway')

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={onCreateCourse}
                navigationPayload={{ create: true }}
            />
        )

        await fillValidCourseForm(user)
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Course save failed',
            expect.objectContaining({ description: 'Please try again after resolving the issue.' })
        )
    })

    it('does not reopen the create dialog when courses change for the same payload', async () => {
        const user = userEvent.setup()
        const payload = { create: true }
        const onNavigate = vi.fn()

        const { rerender } = render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={onNavigate}
                navigationPayload={payload}
            />
        )

        expect(screen.getByRole('heading', { name: /create course/i })).toBeInTheDocument()

        await user.keyboard('{Escape}')
        expect(screen.queryByRole('heading', { name: /create course/i })).toBeNull()

        rerender(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Safety Foundations' })]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={onNavigate}
                navigationPayload={payload}
            />
        )

        expect(screen.queryByRole('heading', { name: /create course/i })).toBeNull()
    })

    it('reopens the create dialog after the navigation payload is cleared and sent again', async () => {
        const user = userEvent.setup()
        const firstPayload = { create: true }
        const { rerender } = render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={vi.fn()}
                navigationPayload={firstPayload}
            />
        )

        expect(screen.getByRole('heading', { name: /create course/i })).toBeInTheDocument()
        await user.type(screen.getByLabelText(/title/i), 'Draft to clear')

        await user.keyboard('{Escape}')
        expect(screen.queryByRole('heading', { name: /create course/i })).toBeNull()

        rerender(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={vi.fn()}
                navigationPayload={undefined}
            />
        )

        rerender(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={vi.fn()}
                navigationPayload={{ create: true }}
            />
        )

        expect(screen.getByRole('heading', { name: /create course/i })).toBeInTheDocument()
        expect(screen.getByLabelText(/title/i)).toHaveValue('')
    })

    it('clears create form values when dismissed with Cancel', async () => {
        const user = userEvent.setup()
        const payload = { create: true }
        const { rerender } = render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={vi.fn()}
                navigationPayload={payload}
            />
        )

        await user.type(screen.getByLabelText(/title/i), 'Cancel should clear this')
        await user.click(screen.getByRole('button', { name: /cancel/i }))
        expect(screen.queryByRole('heading', { name: /create course/i })).toBeNull()

        rerender(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={vi.fn()}
                navigationPayload={undefined}
            />
        )

        rerender(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={vi.fn()}
                navigationPayload={{ create: true }}
            />
        )

        expect(screen.getByRole('heading', { name: /create course/i })).toBeInTheDocument()
        expect(screen.getByLabelText(/title/i)).toHaveValue('')
    })

    it('shows validation error when create form misses required fields', async () => {
        const user = userEvent.setup()
        const onCreateCourse = vi.fn()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={onCreateCourse}
                navigationPayload={{ create: true }}
            />
        )

        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(onCreateCourse).not.toHaveBeenCalled()
        expect(toastError).toHaveBeenCalledWith(
            'Course validation failed',
            expect.objectContaining({ description: expect.stringMatching(/title and description/i) })
        )
    })

    it('shows validation error for invalid duration', async () => {
        const user = userEvent.setup()
        const onCreateCourse = vi.fn()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={onCreateCourse}
                navigationPayload={{ create: true }}
            />
        )

        await user.type(screen.getByLabelText(/title/i), 'New Safety Course')
        await user.type(screen.getByLabelText(/description/i), 'Course description')
        await user.clear(screen.getByLabelText(/duration \(minutes\)/i))
        await user.type(screen.getByLabelText(/duration \(minutes\)/i), '0')
        await addMinimalModule(user)
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Course validation failed',
            expect.objectContaining({ description: expect.stringMatching(/positive whole number/i) })
        )
        expect(onCreateCourse).not.toHaveBeenCalled()
    })

    it('shows validation error for invalid pass score', async () => {
        const user = userEvent.setup()
        const onCreateCourse = vi.fn()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={onCreateCourse}
                navigationPayload={{ create: true }}
            />
        )

        await user.type(screen.getByLabelText(/title/i), 'New Safety Course')
        await user.type(screen.getByLabelText(/description/i), 'Course description')
        await user.clear(screen.getByLabelText(/duration \(minutes\)/i))
        await user.type(screen.getByLabelText(/duration \(minutes\)/i), '60')
        await user.clear(screen.getByLabelText(/pass score/i))
        await user.type(screen.getByLabelText(/pass score/i), '101')
        await addMinimalModule(user)
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Course validation failed',
            expect.objectContaining({ description: expect.stringMatching(/between 0 and 100/i) })
        )
        expect(onCreateCourse).not.toHaveBeenCalled()
    })

    it('shows validation error when pass score is left blank', async () => {
        const user = userEvent.setup()
        const onCreateCourse = vi.fn()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={onCreateCourse}
                navigationPayload={{ create: true }}
            />
        )

        await user.type(screen.getByLabelText(/title/i), 'New Safety Course')
        await user.type(screen.getByLabelText(/description/i), 'Course description')
        await user.clear(screen.getByLabelText(/duration \(minutes\)/i))
        await user.type(screen.getByLabelText(/duration \(minutes\)/i), '60')
        await user.clear(screen.getByLabelText(/pass score/i))
        await addMinimalModule(user)
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Course validation failed',
            expect.objectContaining({ description: expect.stringMatching(/between 0 and 100/i) })
        )
        expect(onCreateCourse).not.toHaveBeenCalled()
    })

    it('shows validation error when no modules are defined', async () => {
        const user = userEvent.setup()
        const onCreateCourse = vi.fn()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={onCreateCourse}
                navigationPayload={{ create: true }}
            />
        )

        await user.type(screen.getByLabelText(/title/i), 'New Safety Course')
        await user.type(screen.getByLabelText(/description/i), 'Course description')
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Course validation failed',
            expect.objectContaining({ description: expect.stringMatching(/at least one module is required/i) })
        )
        expect(onCreateCourse).not.toHaveBeenCalled()
    })

    it('shows validation error when a module is missing required details', async () => {
        const user = userEvent.setup()
        const onCreateCourse = vi.fn()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={onCreateCourse}
                navigationPayload={{ create: true }}
            />
        )

        await fillValidCourseForm(user)
        await user.clear(screen.getByDisplayValue('Intro Module'))
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Course validation failed',
            expect.objectContaining({ description: expect.stringMatching(/each module needs a title and positive duration/i) })
        )
        expect(onCreateCourse).not.toHaveBeenCalled()
    })

    it('shows callback error when create callback is unavailable', async () => {
        const user = userEvent.setup()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                navigationPayload={{ create: true }}
            />
        )

        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Course creation unavailable',
            expect.objectContaining({ description: expect.stringMatching(/create callback is not configured/i) })
        )
    })

    it('renders completed enrollment status for the current user', () => {
        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Safety Foundations' })]}
                enrollments={[
                    { id: 'e1', userId: 'u1', courseId: 'c1', status: 'completed', progress: 100, enrolledAt: '2026-01-01' },
                ]}
                currentUser={createUser({ id: 'u1' })}
                onNavigate={vi.fn()}
            />
        )

        expect(screen.getByText('completed')).toBeInTheDocument()
        expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('renders draft detail dialog without certifications or modules', () => {
        render(
            <Courses
                courses={[
                    createCourse({
                        id: 'c1',
                        title: 'Draft Course',
                        description: 'No modules yet',
                        published: false,
                        certifications: [],
                        modules: [],
                    }),
                ]}
                enrollments={[]}
                currentUser={createUser()}
                onNavigate={vi.fn()}
                navigationPayload={{ courseId: 'c1' }}
            />
        )

        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText('Draft')).toBeInTheDocument()
        expect(within(dialog).getByText(/no modules defined\./i)).toBeInTheDocument()
        expect(within(dialog).queryByText('Certifications')).toBeNull()
    })

    it('edits an existing course and saves updated structured module data', async () => {
        const user = userEvent.setup()
        const onUpdateCourse = vi.fn()

        render(
            <Courses
                courses={[
                    createCourse({
                        id: 'c1',
                        title: 'Safety Foundations',
                        description: 'Original description',
                        moduleDetails: [
                            {
                                id: 'module-1',
                                title: 'Original Module',
                                description: 'Original module description',
                                contentType: 'text',
                                duration: 15,
                                content: { body: 'Original body' },
                                order: 0,
                            },
                        ],
                    }),
                ]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onUpdateCourse={onUpdateCourse}
                navigationPayload={{ courseId: 'c1' }}
            />
        )

        await user.click(screen.getByRole('button', { name: /edit course/i }))
        await user.clear(screen.getByLabelText(/title/i))
        await user.type(screen.getByLabelText(/title/i), 'Updated Safety Foundations')
        await user.clear(screen.getByLabelText(/description/i))
        await user.type(screen.getByLabelText(/description/i), 'Updated course description')
        await user.clear(screen.getByDisplayValue('Original Module'))
        await user.type(screen.getByPlaceholderText(/incident response overview/i), 'Updated Module')
        await user.clear(screen.getByDisplayValue('Original body'))
        await user.type(screen.getByPlaceholderText(/add text-based learning content/i), 'Updated body content')

        await user.click(screen.getByRole('button', { name: /save changes/i }))

        expect(onUpdateCourse).toHaveBeenCalledWith(
            'c1',
            expect.objectContaining({
                title: 'Updated Safety Foundations',
                description: 'Updated course description',
                modules: ['Updated Module'],
                moduleDetails: [
                    expect.objectContaining({
                        title: 'Updated Module',
                        contentType: 'text',
                        content: { body: 'Updated body content' },
                    }),
                ],
            })
        )
    })

    it('shows an error toast and does not call onUpdateCourse when editing without the callback', async () => {
        const user = userEvent.setup()

        render(
            <Courses
                courses={[
                    createCourse({
                        id: 'c1',
                        title: 'Safety Foundations',
                        moduleDetails: [
                            {
                                id: 'module-1',
                                title: 'Intro Module',
                                description: '',
                                contentType: 'text',
                                duration: 15,
                                content: { body: 'Body text' },
                                order: 0,
                            },
                        ],
                    }),
                ]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={vi.fn()}
                navigationPayload={{ courseId: 'c1' }}
            />
        )

        await user.click(screen.getByRole('button', { name: /edit course/i }))
        await user.click(screen.getByRole('button', { name: /save changes/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Course update unavailable',
            expect.objectContaining({ description: expect.stringMatching(/not configured/i) })
        )
        expect(toastSuccess).not.toHaveBeenCalled()
    })

    it('shows an error toast and does not call onCreateCourse when creating without the callback', async () => {
        const user = userEvent.setup()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onUpdateCourse={vi.fn()}
                navigationPayload={{ create: true }}
            />
        )

        await fillValidCourseForm(user)
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Course creation unavailable',
            expect.objectContaining({ description: expect.stringMatching(/not configured/i) })
        )
        expect(toastSuccess).not.toHaveBeenCalled()
    })

    it('publishes and deletes a selected course from the detail dialog', async () => {
        const user = userEvent.setup()
        const onUpdateCourse = vi.fn()
        const onDeleteCourse = vi.fn()

        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Draft Course', published: false })]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onUpdateCourse={onUpdateCourse}
                onDeleteCourse={onDeleteCourse}
                navigationPayload={{ courseId: 'c1' }}
            />
        )

        await user.click(screen.getByRole('button', { name: /publish course/i }))
        expect(onUpdateCourse).toHaveBeenCalledWith('c1', expect.objectContaining({ published: true, updatedAt: expect.any(String) }))
        expect(toastSuccess).toHaveBeenCalledWith(
            'Course published',
            expect.objectContaining({ description: expect.stringMatching(/available/i) })
        )

        await user.click(screen.getByRole('button', { name: /delete course/i }))
        expect(onDeleteCourse).toHaveBeenCalledWith('c1')
        expect(toastSuccess).toHaveBeenLastCalledWith(
            'Course deleted',
            expect.objectContaining({ description: expect.stringMatching(/removed/i) })
        )
    })

    it('moves a published course back to draft', async () => {
        const user = userEvent.setup()
        const onUpdateCourse = vi.fn()

        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Published Course', published: true })]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onUpdateCourse={onUpdateCourse}
                navigationPayload={{ courseId: 'c1' }}
            />
        )

        await user.click(screen.getByRole('button', { name: /move to draft/i }))

        expect(onUpdateCourse).toHaveBeenCalledWith('c1', expect.objectContaining({ published: false, updatedAt: expect.any(String) }))
        expect(toastSuccess).toHaveBeenCalledWith(
            'Course moved to draft',
            expect.objectContaining({ description: expect.stringMatching(/hidden from employees/i) })
        )
    })

    it('shows an error when deleting a course fails', async () => {
        const user = userEvent.setup()
        const onDeleteCourse = vi.fn().mockRejectedValue(new Error('delete failed'))

        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Draft Course', published: false })]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onDeleteCourse={onDeleteCourse}
                navigationPayload={{ courseId: 'c1' }}
            />
        )

        await user.click(screen.getByRole('button', { name: /delete course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Delete failed',
            expect.objectContaining({ description: 'delete failed' })
        )
    })

    it('supports video, slideshow, and quiz module content while creating a course', async () => {
        const user = userEvent.setup()
        const onCreateCourse = vi.fn()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={onCreateCourse}
                navigationPayload={{ create: true }}
            />
        )

        const dialog = screen.getByRole('dialog')

        await user.type(screen.getByLabelText(/title/i), 'Mixed Media Course')
        await user.type(screen.getByLabelText(/description/i), 'Structured content types')
        await user.clear(screen.getByLabelText(/duration \(minutes\)/i))
        await user.type(screen.getByLabelText(/duration \(minutes\)/i), '90')
        await user.clear(screen.getByLabelText(/pass score/i))
        await user.type(screen.getByLabelText(/pass score/i), '88')

        await user.click(screen.getByRole('button', { name: /add module/i }))
        await user.clear(screen.getByDisplayValue('Module 1'))
        await user.type(screen.getByPlaceholderText(/incident response overview/i), 'Video Module')
        await user.click(within(dialog).getAllByRole('combobox')[0])
        await user.click(screen.getByRole('option', { name: 'Video' }))
        await user.type(screen.getByPlaceholderText(/https:\/\/example.com\/video/i), 'https://example.com/video')

        await user.click(screen.getByRole('button', { name: /add module/i }))
        await user.clear(screen.getByDisplayValue('Module 2'))
        await user.type(screen.getAllByPlaceholderText(/incident response overview/i)[1], 'Slideshow Module')
        await user.click(within(dialog).getAllByRole('combobox')[1])
        await user.click(screen.getByRole('option', { name: 'Slideshow' }))
        await user.type(screen.getByPlaceholderText(/slide 1/i), 'Slide A\nSlide B')

        await user.click(screen.getByRole('button', { name: /add module/i }))
        await user.clear(screen.getByDisplayValue('Module 3'))
        await user.type(screen.getAllByPlaceholderText(/incident response overview/i)[2], 'Quiz Module')
        await user.click(within(dialog).getAllByRole('combobox')[2])
        await user.click(screen.getByRole('option', { name: 'Quiz' }))
        await user.type(screen.getByPlaceholderText(/what is the safest first step/i), 'What is the safest action?')

        const choiceInputs = within(dialog).getAllByRole('textbox')
        await user.type(choiceInputs[choiceInputs.length - 2], 'Stop')
        await user.type(choiceInputs[choiceInputs.length - 1], 'Go')
        await user.click(within(dialog).getAllByRole('combobox')[3])
        await user.click(screen.getByRole('option', { name: /choice b/i }))

        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(onCreateCourse).toHaveBeenCalledWith(
            expect.objectContaining({
                modules: ['Video Module', 'Slideshow Module', 'Quiz Module'],
                moduleDetails: [
                    expect.objectContaining({ contentType: 'video' }),
                    expect.objectContaining({ contentType: 'slideshow' }),
                    expect.objectContaining({ contentType: 'quiz' }),
                ],
            })
        )
    })

    it('reorders and removes modules before saving a course', async () => {
        const user = userEvent.setup()
        const onCreateCourse = vi.fn()

        render(
            <Courses
                courses={[]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onCreateCourse={onCreateCourse}
                navigationPayload={{ create: true }}
            />
        )

        await user.type(screen.getByLabelText(/title/i), 'Ordered Modules Course')
        await user.type(screen.getByLabelText(/description/i), 'Module ordering test')
        await user.clear(screen.getByLabelText(/duration \(minutes\)/i))
        await user.type(screen.getByLabelText(/duration \(minutes\)/i), '60')
        await user.clear(screen.getByLabelText(/pass score/i))
        await user.type(screen.getByLabelText(/pass score/i), '80')

        await user.click(screen.getByRole('button', { name: /add module/i }))
        await user.clear(screen.getByDisplayValue('Module 1'))
        await user.type(screen.getByPlaceholderText(/incident response overview/i), 'First Module')

        await user.click(screen.getByRole('button', { name: /add module/i }))
        await user.clear(screen.getByDisplayValue('Module 2'))
        await user.type(screen.getAllByPlaceholderText(/incident response overview/i)[1], 'Second Module')

        await user.click(screen.getAllByRole('button', { name: /move up/i })[1])
        await user.click(screen.getAllByRole('button', { name: /remove/i })[1])
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(onCreateCourse).toHaveBeenCalledWith(
            expect.objectContaining({
                modules: ['Second Module'],
                moduleDetails: [expect.objectContaining({ title: 'Second Module' })],
            })
        )
    })

    it('filters the course catalog by published status', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 })

        render(
            <Courses
                courses={[
                    createCourse({ id: 'c1', title: 'Published Course', published: true }),
                    createCourse({ id: 'c2', title: 'Draft Course', published: false }),
                ]}
                enrollments={[]}
                currentUser={createUser({ role: 'admin' })}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getByRole('combobox'))
        await user.click(screen.getByRole('option', { name: /draft/i }))
        expect(screen.getByText('Draft Course')).toBeInTheDocument()
        expect(screen.queryByText('Published Course')).toBeNull()

        await user.click(screen.getByRole('combobox'))
        await user.click(screen.getByRole('option', { name: /published/i }))
        expect(screen.getByText('Published Course')).toBeInTheDocument()
        expect(screen.queryByText('Draft Course')).toBeNull()
    })

    it('shows an error when publishing fails', async () => {
        const user = userEvent.setup()
        const onUpdateCourse = vi.fn().mockRejectedValue(new Error('publish failed'))

        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Draft Course', published: false })]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onUpdateCourse={onUpdateCourse}
                navigationPayload={{ courseId: 'c1' }}
            />
        )

        await user.click(screen.getByRole('button', { name: /publish course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Status update failed',
            expect.objectContaining({ description: 'publish failed' })
        )
    })

    it('does not delete a course when confirmation is cancelled', async () => {
        const user = userEvent.setup()
        const onDeleteCourse = vi.fn()
        vi.stubGlobal('confirm', vi.fn(() => false))

        render(
            <Courses
                courses={[createCourse({ id: 'c1', title: 'Draft Course', published: false })]}
                enrollments={[]}
                currentUser={createUser({ id: 'admin-1', role: 'admin' })}
                onNavigate={vi.fn()}
                onDeleteCourse={onDeleteCourse}
                navigationPayload={{ courseId: 'c1' }}
            />
        )

        await user.click(screen.getByRole('button', { name: /delete course/i }))
        expect(onDeleteCourse).not.toHaveBeenCalled()
    })
})
