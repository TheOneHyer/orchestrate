import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EnrollStudentsDialog } from './EnrollStudentsDialog'
import { checkStudentEnrollmentConflicts } from '@/lib/conflict-detection'
import type { Session, User } from '@/lib/types'

vi.mock('@/lib/conflict-detection', () => ({
    checkStudentEnrollmentConflicts: vi.fn(),
}))

const mockCheckStudentEnrollmentConflicts = vi.mocked(checkStudentEnrollmentConflicts)

function makeStudent(id: string, name: string, department = 'Operations'): User {
    return {
        id,
        name,
        email: `${id}@example.com`,
        role: 'employee',
        department,
        certifications: [],
        hireDate: '2025-01-01T00:00:00.000Z',
    }
}

const session: Session = {
    id: 'sess-1',
    courseId: 'course-1',
    trainerId: 'trainer-1',
    title: 'Safety Basics',
    startTime: '2026-03-20T09:00:00.000Z',
    endTime: '2026-03-20T10:00:00.000Z',
    location: 'Room A',
    capacity: 3,
    enrolledStudents: [],
    status: 'scheduled',
}

const students = [
    makeStudent('stu-1', 'Alice Adams', 'Ops'),
    makeStudent('stu-2', 'Ben Brown', 'HR'),
]

describe('EnrollStudentsDialog', () => {
    beforeEach(() => {
        mockCheckStudentEnrollmentConflicts.mockClear()
        mockCheckStudentEnrollmentConflicts.mockReturnValue({
            hasConflicts: false,
            conflicts: [],
            allowedStudents: students.map(student => student.id),
        })
    })

    it('renders session context and student list', () => {
        render(
            <EnrollStudentsDialog
                open={true}
                onOpenChange={vi.fn()}
                session={session}
                allSessions={[session]}
                availableStudents={students}
                onEnrollStudents={vi.fn()}
            />
        )

        expect(screen.getByRole('heading', { name: /enroll students/i })).toBeInTheDocument()
        expect(screen.getByText('Alice Adams')).toBeInTheDocument()
        expect(screen.getByText('Ben Brown')).toBeInTheDocument()
    })

    it('filters students by search query', async () => {
        render(
            <EnrollStudentsDialog
                open={true}
                onOpenChange={vi.fn()}
                session={session}
                allSessions={[session]}
                availableStudents={students}
                onEnrollStudents={vi.fn()}
            />
        )

        await userEvent.type(screen.getByPlaceholderText(/search by name, email, or department/i), 'alice')

        expect(screen.getByText('Alice Adams')).toBeInTheDocument()
        expect(screen.queryByText('Ben Brown')).not.toBeInTheDocument()
    })

    it('filters students by email', async () => {
        render(
            <EnrollStudentsDialog
                open={true}
                onOpenChange={vi.fn()}
                session={session}
                allSessions={[session]}
                availableStudents={students}
                onEnrollStudents={vi.fn()}
            />
        )

        await userEvent.type(screen.getByPlaceholderText(/search by name, email, or department/i), 'stu-1@example.com')

        expect(screen.getByText('Alice Adams')).toBeInTheDocument()
        expect(screen.queryByText('Ben Brown')).not.toBeInTheDocument()
    })

    it('filters students by department', async () => {
        render(
            <EnrollStudentsDialog
                open={true}
                onOpenChange={vi.fn()}
                session={session}
                allSessions={[session]}
                availableStudents={students}
                onEnrollStudents={vi.fn()}
            />
        )

        await userEvent.type(screen.getByPlaceholderText(/search by name, email, or department/i), 'HR')

        expect(screen.getByText('Ben Brown')).toBeInTheDocument()
        expect(screen.queryByText('Alice Adams')).not.toBeInTheDocument()
    })

    it('supports select all and deselect all', async () => {
        render(
            <EnrollStudentsDialog
                open={true}
                onOpenChange={vi.fn()}
                session={session}
                allSessions={[session]}
                availableStudents={students}
                onEnrollStudents={vi.fn()}
            />
        )

        await userEvent.click(screen.getByRole('button', { name: /select all/i }))
        expect(screen.getByText(/2 selected/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /deselect all/i })).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: /deselect all/i }))
        expect(screen.getByText(/0 selected/i)).toBeInTheDocument()
    })

    it('enrolls selected students when no conflicts exist', async () => {
        const onEnrollStudents = vi.fn()
        const onOpenChange = vi.fn()

        render(
            <EnrollStudentsDialog
                open={true}
                onOpenChange={onOpenChange}
                session={session}
                allSessions={[session]}
                availableStudents={students}
                onEnrollStudents={onEnrollStudents}
            />
        )

        await userEvent.click(screen.getByRole('checkbox', { name: /alice adams/i }))
        await userEvent.click(screen.getByRole('button', { name: /enroll 1 student/i }))

        expect(onEnrollStudents).toHaveBeenCalledWith(['stu-1'])
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('shows conflicts and enrolls only allowed students', async () => {
        mockCheckStudentEnrollmentConflicts.mockReturnValue({
            hasConflicts: true,
            conflicts: [
                {
                    studentId: 'stu-2',
                    studentName: 'Ben Brown',
                    conflictingSession: {
                        ...session,
                        id: 'sess-2',
                        title: 'Conflicting Session',
                    },
                    message: 'Ben Brown conflict',
                },
            ],
            allowedStudents: ['stu-1'],
        })

        const onEnrollStudents = vi.fn()
        const onOpenChange = vi.fn()

        render(
            <EnrollStudentsDialog
                open={true}
                onOpenChange={onOpenChange}
                session={session}
                allSessions={[session]}
                availableStudents={students}
                onEnrollStudents={onEnrollStudents}
            />
        )

        await userEvent.click(screen.getByRole('checkbox', { name: /alice adams/i }))
        await userEvent.click(screen.getByRole('checkbox', { name: /ben brown/i }))

        expect(mockCheckStudentEnrollmentConflicts).toHaveBeenLastCalledWith(
            session,
            ['stu-1', 'stu-2'],
            [session],
            students
        )

        expect(screen.getByText(/scheduling conflicts/i)).toBeInTheDocument()
        expect(screen.getByText(/ben brown\s*→\s*conflicting session/i)).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: /enroll 1 student/i }))
        expect(onEnrollStudents).toHaveBeenCalledWith(['stu-1'])
        expect(onOpenChange).toHaveBeenLastCalledWith(false)
    })

    it('disables enroll when selection exceeds remaining capacity', async () => {
        const fullSession: Session = {
            ...session,
            capacity: 1,
            enrolledStudents: ['already-enrolled'],
        }

        render(
            <EnrollStudentsDialog
                open={true}
                onOpenChange={vi.fn()}
                session={fullSession}
                allSessions={[fullSession]}
                availableStudents={students}
                onEnrollStudents={vi.fn()}
            />
        )

        await userEvent.click(screen.getByRole('checkbox', { name: /alice adams/i }))

        expect(screen.getByText(/session capacity exceeded/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /enroll 1 student/i })).toBeDisabled()
    })
})
