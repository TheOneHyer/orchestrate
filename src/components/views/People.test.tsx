import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { People } from './People'
import type { Course, Enrollment, Session, User } from '@/lib/types'

vi.mock('@/components/TrainerProfileView', () => ({
    TrainerProfileView: ({ user, onEdit, onDelete }: { user: User; onEdit?: () => void; onDelete?: () => void }) => (
        <div>
            <div data-testid="profile-name">{user.name}</div>
            {onEdit && <button onClick={onEdit}>Mock Edit Profile</button>}
            {onDelete && <button onClick={onDelete}>Mock Delete Person</button>}
        </div>
    ),
}))

vi.mock('@/components/TrainerProfileDialog', () => ({
    TrainerProfileDialog: ({ open, onSave, user }: { open: boolean; onSave: (user: User) => void; user: User }) => (
        open ? <button onClick={() => onSave({ ...user, name: `${user.name} Updated` })}>Mock Save Profile</button> : null
    ),
}))

vi.mock('@/components/AddPersonDialog', () => ({
    AddPersonDialog: ({ open, onSave }: { open: boolean; onSave: (user: User) => void }) => (
        open ? (
            <button
                onClick={() =>
                    onSave({
                        id: 'u-added',
                        name: 'Added Person',
                        email: 'added@example.com',
                        role: 'employee',
                        department: 'Operations',
                        certifications: [],
                        hireDate: '2026-01-01',
                    })
                }
            >
                Mock Confirm Add Person
            </button>
        ) : null
    ),
}))

vi.mock('@/components/DeletePersonDialog', () => ({
    DeletePersonDialog: ({ open, onConfirm, user }: { open: boolean; onConfirm: () => void; user: User | null }) => (
        open && user ? <button onClick={onConfirm}>Mock Confirm Delete</button> : null
    ),
}))

function createUser(overrides: Partial<User> = {}): User {
    return {
        id: 'u-default',
        name: 'Default User',
        email: 'default@example.com',
        role: 'employee',
        department: 'Operations',
        certifications: [],
        hireDate: '2024-01-01',
        ...overrides,
    }
}

const baseCourse: Course = {
    id: 'c1',
    title: 'Safety Foundations',
    description: 'Course',
    modules: ['Intro'],
    duration: 60,
    certifications: [],
    createdBy: 'u-admin',
    createdAt: '2026-01-01',
    published: true,
    passScore: 80,
}

const baseSession: Session = {
    id: 's1',
    courseId: 'c1',
    trainerId: 'u-trainer',
    title: 'Morning Session',
    startTime: '2026-03-01T09:00:00.000Z',
    endTime: '2026-03-01T10:00:00.000Z',
    location: 'Room A',
    capacity: 10,
    enrolledStudents: ['u-employee'],
    status: 'scheduled',
}

function renderPeople(options?: {
    users?: User[]
    enrollments?: Enrollment[]
    currentUser?: User
    onNavigate?: (view: string, data?: any) => void
    onUpdateUser?: (user: User) => void
    onAddUser?: (user: User) => void
    onDeleteUser?: (userId: string) => void
    navigationPayload?: unknown
}) {
    const users = options?.users ?? [
        createUser({ id: 'u-admin', name: 'Admin User', role: 'admin', email: 'admin@example.com' }),
        createUser({
            id: 'u-trainer',
            name: 'Trainer User',
            role: 'trainer',
            email: 'trainer@example.com',
            trainerProfile: {
                authorizedRoles: [],
                shiftSchedules: [{ shiftCode: 'DAY', daysWorked: ['monday'], startTime: '08:00', endTime: '16:00', totalHoursPerWeek: 8 }],
                tenure: { hireDate: '2024-01-01', yearsOfService: 2, monthsOfService: 24 },
                specializations: [],
            },
        }),
        createUser({ id: 'u-employee', name: 'Employee User', role: 'employee', email: 'employee@example.com', department: 'HR' }),
    ]

    const onNavigate = options?.onNavigate ?? vi.fn()

    const renderResult = render(
        <People
            users={users}
            enrollments={options?.enrollments ?? [
                { id: 'e1', userId: 'u-employee', courseId: 'c1', status: 'completed', progress: 100, score: 90, enrolledAt: '2026-01-01' },
                { id: 'e2', userId: 'u-employee', courseId: 'c1', status: 'in-progress', progress: 50, score: 70, enrolledAt: '2026-01-02' },
            ]}
            courses={[baseCourse]}
            sessions={[baseSession]}
            currentUser={options?.currentUser ?? createUser({ id: 'u-admin', role: 'admin', name: 'Admin User' })}
            onNavigate={onNavigate}
            onUpdateUser={options?.onUpdateUser}
            onAddUser={options?.onAddUser}
            onDeleteUser={options?.onDeleteUser}
            navigationPayload={options?.navigationPayload}
        />
    )

    return {
        ...renderResult,
        onNavigate,
    }
}

describe('People', () => {
    it('renders people list and enrollment stats', () => {
        renderPeople()

        expect(screen.getByText('Admin User')).toBeInTheDocument()
        expect(screen.getByText('Trainer User')).toBeInTheDocument()
        expect(screen.getByText('Employee User')).toBeInTheDocument()
        expect(screen.getByText('1 completed')).toBeInTheDocument()
        expect(screen.getByText('1 in progress')).toBeInTheDocument()
    })

    it('filters people by search query across name, email, and department', async () => {
        const user = userEvent.setup()
        renderPeople()

        const searchInput = screen.getByPlaceholderText(/search people/i)

        await user.type(searchInput, 'hr')

        expect(screen.getByText('Employee User')).toBeInTheDocument()
        expect(screen.queryByText('Trainer User')).toBeNull()
        expect(screen.queryByText('Admin User')).toBeNull()
    })

    it('filters people by role tabs', async () => {
        const user = userEvent.setup()
        renderPeople()

        await user.click(screen.getByRole('tab', { name: /trainers/i }))

        expect(screen.getByText('Trainer User')).toBeInTheDocument()
        expect(screen.queryByText('Admin User')).toBeNull()
        expect(screen.queryByText('Employee User')).toBeNull()

        await user.click(screen.getByRole('tab', { name: /admins/i }))

        expect(screen.getByText('Admin User')).toBeInTheDocument()
        expect(screen.queryByText('Trainer User')).toBeNull()
        expect(screen.queryByText('Employee User')).toBeNull()
    })

    it('opens selected profile view and returns to people list', async () => {
        const user = userEvent.setup()
        renderPeople()

        await user.click(screen.getByText('Trainer User'))

        expect(screen.getByTestId('profile-name')).toHaveTextContent('Trainer User')

        await user.click(screen.getByRole('button', { name: /back to people/i }))

        expect(screen.getByText('Manage employees and training profiles')).toBeInTheDocument()
        expect(screen.getByText('Trainer User')).toBeInTheDocument()
    })

    it('executes add-person flow and calls onAddUser when current user is admin', async () => {
        const user = userEvent.setup()
        const onAddUser = vi.fn()

        renderPeople({ onAddUser })

        await user.click(screen.getByRole('button', { name: /add person/i }))
        await user.click(screen.getByRole('button', { name: /mock confirm add person/i }))

        expect(onAddUser).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'u-added',
                name: 'Added Person',
                email: 'added@example.com',
            })
        )
    })

    it('does not allow trainers to complete add-person flow', async () => {
        const onAddUser = vi.fn()

        renderPeople({
            currentUser: createUser({ id: 'u-trainer-self', role: 'trainer', name: 'Trainer Self' }),
            onAddUser,
        })

        expect(screen.queryByRole('button', { name: /add person/i })).toBeNull()
        expect(onAddUser).not.toHaveBeenCalled()
    })

    it('hides add-person action for non-admin users', () => {
        renderPeople({ currentUser: createUser({ id: 'u-employee-self', role: 'employee', name: 'Employee Self' }) })

        expect(screen.queryByRole('button', { name: /add person/i })).toBeNull()
    })

    it('filters people by email search query', async () => {
        const user = userEvent.setup()
        renderPeople()

        await user.type(screen.getByPlaceholderText(/search people/i), 'employee@example.com')

        expect(screen.getByText('Employee User')).toBeInTheDocument()
        expect(screen.queryByText('Trainer User')).toBeNull()
        expect(screen.queryByText('Admin User')).toBeNull()
    })

    it('handles profile edit callback from profile view', async () => {
        const user = userEvent.setup()
        const onUpdateUser = vi.fn()

        renderPeople({ onUpdateUser })

        await user.click(screen.getByText('Trainer User'))

        await user.click(screen.getByRole('button', { name: /mock edit profile/i }))
        await user.click(screen.getByRole('button', { name: /mock save profile/i }))

        expect(onUpdateUser).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'u-trainer',
                name: 'Trainer User Updated',
            })
        )
    })

    it('completes delete confirmation flow from profile view', async () => {
        const user = userEvent.setup()
        const onDeleteUser = vi.fn()

        renderPeople({ onDeleteUser })

        await user.click(screen.getByText('Trainer User'))

        // Deletion is initiated in profile view and confirmed from the people list, matching the product flow.
        await user.click(screen.getByRole('button', { name: /mock delete person/i }))
        await user.click(screen.getByRole('button', { name: /back to people/i }))
        await user.click(screen.getByRole('button', { name: /mock confirm delete/i }))

        expect(onDeleteUser).toHaveBeenCalledWith('u-trainer')
    })

    it('shows empty state when no users match filters', async () => {
        const user = userEvent.setup()
        renderPeople()

        await user.type(screen.getByPlaceholderText(/search people/i), 'no-match-user')

        expect(screen.getByText(/no people found/i)).toBeInTheDocument()
    })

    it('syncs selectedUser when the users prop updates with changed data', async () => {
        const user = userEvent.setup()
        const adminUser = createUser({ id: 'u-admin', name: 'Admin User', role: 'admin', email: 'admin@example.com' })
        const trainerUser = createUser({ id: 'u-trainer', name: 'Trainer User', role: 'trainer', email: 'trainer@example.com' })

        const { rerender } = render(
            <People
                users={[adminUser, trainerUser]}
                enrollments={[]}
                courses={[baseCourse]}
                sessions={[baseSession]}
                currentUser={adminUser}
                onNavigate={vi.fn()}
            />
        )

        await user.click(screen.getByText('Trainer User'))
        expect(screen.getByTestId('profile-name')).toHaveTextContent('Trainer User')

        const updatedTrainer = { ...trainerUser, name: 'Trainer User Renamed' }
        rerender(
            <People
                users={[adminUser, updatedTrainer]}
                enrollments={[]}
                courses={[baseCourse]}
                sessions={[baseSession]}
                currentUser={adminUser}
                onNavigate={vi.fn()}
            />
        )

        expect(screen.getByTestId('profile-name')).toHaveTextContent('Trainer User Renamed')
    })

    it('saves profile update in state when onUpdateUser is not provided', async () => {
        const user = userEvent.setup()
        renderPeople({ onUpdateUser: undefined })

        await user.click(screen.getByText('Trainer User'))
        await user.click(screen.getByRole('button', { name: /mock edit profile/i }))
        await user.click(screen.getByRole('button', { name: /mock save profile/i }))

        expect(screen.getByTestId('profile-name')).toHaveTextContent('Trainer User Updated')
    })

    it('does not expose edit or delete actions in profile view for non-admin viewers', async () => {
        const user = userEvent.setup()

        renderPeople({
            currentUser: createUser({ id: 'u-trainer-self', role: 'trainer', name: 'Trainer Self' }),
        })

        await user.click(screen.getByText('Trainer User'))

        expect(screen.getByTestId('profile-name')).toHaveTextContent('Trainer User')
        expect(screen.queryByRole('button', { name: /mock edit profile/i })).toBeNull()
        expect(screen.queryByRole('button', { name: /mock delete person/i })).toBeNull()
    })

    it('auto-opens target profile when navigation payload contains a userId', () => {
        renderPeople({ navigationPayload: { userId: 'u-trainer' } })

        expect(screen.getByTestId('profile-name')).toHaveTextContent('Trainer User')
    })

    it('does not auto-open a profile when payload userId is not found', () => {
        renderPeople({ navigationPayload: { userId: 'missing-user' } })

        expect(screen.getByText('Manage employees and training profiles')).toBeInTheDocument()
        expect(screen.queryByTestId('profile-name')).toBeNull()
    })


})
