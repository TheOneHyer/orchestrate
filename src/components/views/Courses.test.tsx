import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('Courses', () => {
    it('shows an error when navigation payload references a missing course id', () => {
        render(
            <Courses
                courses={[]}
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

        expect(onNavigate).toHaveBeenCalledWith('courses', { create: true })
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

        await user.type(screen.getByLabelText(/title/i), 'New Safety Course')
        await user.type(screen.getByLabelText(/description/i), 'Course description')
        await user.clear(screen.getByLabelText(/duration \(minutes\)/i))
        await user.type(screen.getByLabelText(/duration \(minutes\)/i), '120')
        await user.clear(screen.getByLabelText(/pass score/i))
        await user.type(screen.getByLabelText(/pass score/i), '85')
        await user.type(screen.getByLabelText(/modules/i), 'Intro, Practical')
        await user.type(screen.getByLabelText(/certifications/i), 'Safety Cert')

        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(onCreateCourse).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'New Safety Course',
                description: 'Course description',
                duration: 120,
                passScore: 85,
                modules: ['Intro', 'Practical'],
                certifications: ['Safety Cert'],
                createdBy: 'admin-1',
                published: false,
            })
        )
        expect(screen.queryByRole('heading', { name: /create course/i })).toBeNull()
        expect(toastSuccess).toHaveBeenCalledWith(
            'Course created',
            expect.objectContaining({ description: expect.stringMatching(/draft course/i) })
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

        await user.type(screen.getByLabelText(/title/i), 'New Safety Course')
        await user.type(screen.getByLabelText(/description/i), 'Course description')
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(onCreateCourse).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('heading', { name: /create course/i })).toBeInTheDocument()
        expect(screen.getByLabelText(/title/i)).toHaveValue('New Safety Course')
        expect(toastError).toHaveBeenCalledWith(
            'Course creation failed',
            expect.objectContaining({ description: 'Service unavailable' })
        )
        expect(toastSuccess).not.toHaveBeenCalled()
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
            'Missing required fields',
            expect.objectContaining({ description: expect.stringMatching(/title and description/i) })
        )
    })

    it('shows validation error for invalid duration and invalid pass score', async () => {
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
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Invalid duration',
            expect.objectContaining({ description: expect.stringMatching(/positive whole number/i) })
        )

        await user.clear(screen.getByLabelText(/duration \(minutes\)/i))
        await user.type(screen.getByLabelText(/duration \(minutes\)/i), '60')
        await user.clear(screen.getByLabelText(/pass score/i))
        await user.type(screen.getByLabelText(/pass score/i), '101')
        await user.click(screen.getByRole('button', { name: /save course/i }))

        expect(toastError).toHaveBeenCalledWith(
            'Invalid pass score',
            expect.objectContaining({ description: expect.stringMatching(/between 0 and 100/i) })
        )
        expect(onCreateCourse).not.toHaveBeenCalled()
    })

    it('shows permission error when create callback is unavailable', async () => {
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
            expect.objectContaining({ description: expect.stringMatching(/permission/i) })
        )
    })
})
