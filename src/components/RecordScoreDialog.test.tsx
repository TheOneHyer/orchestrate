import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RecordScoreDialog } from './RecordScoreDialog'
import type { Course, Enrollment, User } from '@/lib/types'

function createCourse(overrides: Partial<Course> = {}): Course {
    return {
        id: 'course-1',
        title: 'Safety Fundamentals',
        description: 'Core safety training course.',
        duration: 60,
        passScore: 80,
        modules: [],
        certifications: [],
        createdBy: 'admin-1',
        published: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        ...overrides,
    }
}

function createStudent(overrides: Partial<User> = {}): User {
    return {
        id: 'student-1',
        name: 'Sam Student',
        email: 'sam@example.com',
        role: 'employee',
        department: 'Operations',
        certifications: [],
        hireDate: '2023-01-01T00:00:00.000Z',
        ...overrides,
    }
}

function createEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
    return {
        id: 'enroll-1',
        userId: 'student-1',
        courseId: 'course-1',
        sessionId: 'session-1',
        status: 'in-progress',
        progress: 50,
        enrolledAt: '2024-01-15T00:00:00.000Z',
        ...overrides,
    }
}

describe('RecordScoreDialog', () => {
    describe('rendering', () => {
        it('renders student name and course title', () => {
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment()}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            expect(screen.getByText('Sam Student')).toBeInTheDocument()
            expect(screen.getByText('Safety Fundamentals')).toBeInTheDocument()
        })

        it('renders the pass score badge', () => {
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment()}
                    course={createCourse({ passScore: 75 })}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            expect(screen.getByText('75%')).toBeInTheDocument()
        })

        it('renders a current score badge when enrollment already has a score', () => {
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment({ score: 60 })}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            expect(screen.getByText('60%')).toBeInTheDocument()
        })

        it('does not render a current score badge when enrollment has no score', () => {
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment({ score: undefined })}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            // 80% is the pass score badge; there should be no second "X%" badge
            expect(screen.queryByText('Current:')).not.toBeInTheDocument()
        })

        it('does not show a save button when open is false', () => {
            render(
                <RecordScoreDialog
                    open={false}
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment()}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            expect(screen.queryByRole('button', { name: /save score/i })).not.toBeInTheDocument()
        })
    })

    describe('score input and preview', () => {
        it('shows a pass preview when the entered score is at or above the pass score', async () => {
            const user = userEvent.setup()
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment()}
                    course={createCourse({ passScore: 80 })}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            await user.clear(screen.getByRole('spinbutton'))
            await user.type(screen.getByRole('spinbutton'), '85')
            expect(screen.getByTestId('score-preview')).toHaveTextContent(/pass/i)
        })

        it('shows a fail preview when the entered score is below the pass score', async () => {
            const user = userEvent.setup()
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment()}
                    course={createCourse({ passScore: 80 })}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            await user.clear(screen.getByRole('spinbutton'))
            await user.type(screen.getByRole('spinbutton'), '70')
            expect(screen.getByTestId('score-preview')).toHaveTextContent(/fail/i)
        })

        it('shows a pass preview at exactly the pass score boundary', async () => {
            const user = userEvent.setup()
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment()}
                    course={createCourse({ passScore: 80 })}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            await user.clear(screen.getByRole('spinbutton'))
            await user.type(screen.getByRole('spinbutton'), '80')
            expect(screen.getByTestId('score-preview')).toHaveTextContent(/pass/i)
        })

        it('shows a validation error for an out-of-range value', () => {
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment()}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            // Directly fire change to set out-of-range value (150) that bypasses browser filtering
            fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } })
            expect(screen.getByTestId('score-error')).toBeInTheDocument()
        })

        it('disables Save Score when the input is empty', () => {
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment({ score: undefined })}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            expect(screen.getByRole('button', { name: /save score/i })).toBeDisabled()
        })

        it('enables Save Score when a valid score is entered', async () => {
            const user = userEvent.setup()
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment()}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            await user.clear(screen.getByRole('spinbutton'))
            await user.type(screen.getByRole('spinbutton'), '90')
            expect(screen.getByRole('button', { name: /save score/i })).not.toBeDisabled()
        })
    })

    describe('submission', () => {
        it('calls onSubmit with the enrollment id and parsed score on confirm', async () => {
            const user = userEvent.setup()
            const onSubmit = vi.fn()
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment({ id: 'enroll-abc' })}
                    course={createCourse({ passScore: 80 })}
                    student={createStudent()}
                    onSubmit={onSubmit}
                />,
            )

            await user.clear(screen.getByRole('spinbutton'))
            await user.type(screen.getByRole('spinbutton'), '92')
            await user.click(screen.getByRole('button', { name: /save score/i }))

            expect(onSubmit).toHaveBeenCalledOnce()
            expect(onSubmit).toHaveBeenCalledWith('enroll-abc', 92)
        })

        it('calls onOpenChange(false) after successful submit', async () => {
            const user = userEvent.setup()
            const onOpenChange = vi.fn()
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={onOpenChange}
                    enrollment={createEnrollment()}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            await user.clear(screen.getByRole('spinbutton'))
            await user.type(screen.getByRole('spinbutton'), '88')
            await user.click(screen.getByRole('button', { name: /save score/i }))

            expect(onOpenChange).toHaveBeenCalledWith(false)
        })

        it('does not call onSubmit when Save is clicked with no value', async () => {
            const user = userEvent.setup()
            const onSubmit = vi.fn()
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment({ score: undefined })}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={onSubmit}
                />,
            )

            // Button is disabled so click has no effect
            await user.click(screen.getByRole('button', { name: /save score/i }))
            expect(onSubmit).not.toHaveBeenCalled()
        })

        it('calls onOpenChange(false) when Cancel is clicked', async () => {
            const user = userEvent.setup()
            const onOpenChange = vi.fn()
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={onOpenChange}
                    enrollment={createEnrollment()}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            await user.click(screen.getByRole('button', { name: /cancel/i }))
            expect(onOpenChange).toHaveBeenCalledWith(false)
        })
    })

    describe('pre-filled score', () => {
        it('pre-fills the input with the existing score when enrollment already has a score', () => {
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment({ score: 72 })}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            const input = screen.getByRole('spinbutton') as HTMLInputElement
            expect(input.value).toBe('72')
        })

        it('resets the input to the enrollment score when the dialog is reopened', async () => {
            const user = userEvent.setup()
            const enrollment = createEnrollment({ score: 72 })
            const { rerender } = render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={enrollment}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            const input = screen.getByRole('spinbutton') as HTMLInputElement
            await user.tripleClick(input)
            await user.keyboard('88')
            expect(input.value).toBe('88')

            rerender(
                <RecordScoreDialog
                    open={false}
                    onOpenChange={vi.fn()}
                    enrollment={enrollment}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            rerender(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={enrollment}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('72')
        })

        it('resets the input when the dialog switches to a different enrollment', () => {
            const { rerender } = render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment({ id: 'enroll-1', score: 72 })}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('72')

            rerender(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment({ id: 'enroll-2', score: 95 })}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('95')
        })

        it('shows a pass or fail preview immediately for the pre-filled score', () => {
            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment({ score: 85 })}
                    course={createCourse({ passScore: 80 })}
                    student={createStudent()}
                    onSubmit={vi.fn()}
                />,
            )

            expect(screen.getByTestId('score-preview')).toHaveTextContent(/pass/i)
        })

        it('does not call onSubmit when the form is submitted programmatically with no score value', () => {
            const onSubmit = vi.fn()

            render(
                <RecordScoreDialog
                    open
                    onOpenChange={vi.fn()}
                    enrollment={createEnrollment({ score: undefined })}
                    course={createCourse()}
                    student={createStudent()}
                    onSubmit={onSubmit}
                />,
            )

            const form = document.querySelector('form')!
            fireEvent.submit(form)

            expect(onSubmit).not.toHaveBeenCalled()
        })
    })
})
