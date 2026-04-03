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
                shiftSchedules: [{
                    shiftCode: 'DAY', daysWorked: ['monday'], startTime: '08:00', endTime: '16:00', totalHoursPerWeek: 8,
                    shiftType: 'day'
                }],
                tenure: { hireDate: '2024-01-01', yearsOfService: 2, monthsOfService: 24 },
                specializations: [],
            },
        }),
        createUser({ id: 'u-employee', name: 'Employee User', role: 'employee', email: 'employee@example.com', department: 'HR' }),
    ]

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
            onUpdateUser={options?.onUpdateUser}
            onAddUser={options?.onAddUser}
            onDeleteUser={options?.onDeleteUser}
            navigationPayload={options?.navigationPayload}
        />
    )

    return {
        ...renderResult,
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

    it('shows certification gap counts for users', () => {
        const users: User[] = [
            createUser({ id: 'u-admin', name: 'Admin User', role: 'admin', certifications: ['Safety', 'Leadership'] }),
            createUser({ id: 'u-employee', name: 'Employee User', role: 'employee', certifications: ['Safety'] }),
        ]

        const courses: Course[] = [
            { ...baseCourse, id: 'c1', certifications: ['Safety'] },
            { ...baseCourse, id: 'c2', certifications: ['Leadership'] },
            { ...baseCourse, id: 'c3', certifications: ['Quality'] },
        ]

        render(
            <People
                users={users}
                enrollments={[]}
                courses={courses}
                sessions={[baseSession]}
                currentUser={createUser({ id: 'u-admin', role: 'admin' })}
            />
        )

        const employeeRow = screen.getByText('Employee User').closest('tr')
        expect(employeeRow).not.toBeNull()
        if (!employeeRow) {
            throw new Error('Expected employee row to exist')
        }

        expect(employeeRow).toHaveTextContent('1 cert')
        expect(employeeRow).toHaveTextContent('2 gaps')

        const adminRow = screen.getByText('Admin User').closest('tr')
        expect(adminRow).not.toBeNull()
        if (!adminRow) {
            throw new Error('Expected admin row to exist')
        }

        expect(adminRow).toHaveTextContent('2 certs')
        expect(adminRow).toHaveTextContent('1 gap')
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

        expect(screen.getByRole('tablist', { name: /filter people by role/i })).toBeInTheDocument()
        expect(screen.getByRole('table', { name: /people directory/i })).toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: /trainers/i }))

        expect(screen.getByText('Trainer User')).toBeInTheDocument()
        expect(screen.queryByText('Admin User')).toBeNull()
        expect(screen.queryByText('Employee User')).toBeNull()

        await user.click(screen.getByRole('tab', { name: /admins/i }))

        expect(screen.getByText('Admin User')).toBeInTheDocument()
        expect(screen.queryByText('Trainer User')).toBeNull()
        expect(screen.queryByText('Employee User')).toBeNull()
    })

    it('opens a profile from keyboard button interaction', async () => {
        const user = userEvent.setup()
        renderPeople()

        const profileButton = screen.getByRole('button', { name: /view profile for trainer user/i })
        profileButton.focus()
        await user.keyboard('{Enter}')

        expect(screen.getByTestId('profile-name')).toHaveTextContent('Trainer User')
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

    it('closes the add-person flow even when no add callback is provided', async () => {
        const user = userEvent.setup()

        renderPeople({ onAddUser: undefined })

        await user.click(screen.getByRole('button', { name: /add person/i }))
        expect(screen.getByRole('button', { name: /mock confirm add person/i })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /mock confirm add person/i }))

        expect(screen.queryByRole('button', { name: /mock confirm add person/i })).not.toBeInTheDocument()
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

    it('handles users prop update when no user is selected (null short-circuit)', () => {
        // Exercises the early-return guard in the setSelectedUser callback when
        // currentSelectedUser is already null and the users prop changes.
        const adminUser = createUser({ id: 'u-admin', name: 'Admin User', role: 'admin', email: 'admin@example.com' })

        const { rerender } = renderPeople({ users: [adminUser] })

        // No user is selected — the people list should still be visible
        expect(screen.getByText('Manage employees and training profiles')).toBeInTheDocument()

        // Change users while no user is selected; component must not crash
        rerender(
            <People
                users={[{ ...adminUser, department: 'Updated Dept' }]}
                enrollments={[]}
                courses={[baseCourse]}
                sessions={[baseSession]}
                currentUser={adminUser}
            />
        )

        expect(screen.getByText('Manage employees and training profiles')).toBeInTheDocument()
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

    it('gracefully handles empty navigation payload', () => {
        renderPeople({ navigationPayload: {} })

        expect(screen.getByText('Manage employees and training profiles')).toBeInTheDocument()
        expect(screen.queryByTestId('profile-name')).toBeNull()
    })

    it('gracefully handles navigation payload with null userId', () => {
        renderPeople({ navigationPayload: { userId: null } })

        expect(screen.getByText('Manage employees and training profiles')).toBeInTheDocument()
        expect(screen.queryByTestId('profile-name')).toBeNull()
    })

    it('calls onNavigationPayloadConsumed only when the userId is found', () => {
        const onNavigationPayloadConsumed = vi.fn()

        render(
            <People
                users={[createUser({ id: 'u-admin', name: 'Admin User', role: 'admin', email: 'admin@example.com' })]}
                enrollments={[]}
                courses={[]}
                sessions={[]}
                currentUser={createUser({ id: 'u-admin', role: 'admin' })}
                navigationPayload={{ userId: 'u-admin' }}
                onNavigationPayloadConsumed={onNavigationPayloadConsumed}
            />
        )

        expect(onNavigationPayloadConsumed).toHaveBeenCalledTimes(1)
    })

    it('does not call onNavigationPayloadConsumed when the userId is not found', () => {
        const onNavigationPayloadConsumed = vi.fn()

        render(
            <People
                users={[createUser({ id: 'u-admin', name: 'Admin User', role: 'admin', email: 'admin@example.com' })]}
                enrollments={[]}
                courses={[]}
                sessions={[]}
                currentUser={createUser({ id: 'u-admin', role: 'admin' })}
                navigationPayload={{ userId: 'missing-user' }}
                onNavigationPayloadConsumed={onNavigationPayloadConsumed}
            />
        )

        expect(onNavigationPayloadConsumed).not.toHaveBeenCalled()
    })

    it('does not re-consume the same userId payload when users change', () => {
        const onNavigationPayloadConsumed = vi.fn()
        const payload = { userId: 'u-admin' }
        const adminUser = createUser({ id: 'u-admin', name: 'Admin User', role: 'admin', email: 'admin@example.com' })

        const { rerender } = render(
            <People
                users={[adminUser]}
                enrollments={[]}
                courses={[]}
                sessions={[]}
                currentUser={createUser({ id: 'u-admin', role: 'admin' })}
                navigationPayload={payload}
                onNavigationPayloadConsumed={onNavigationPayloadConsumed}
            />
        )

        expect(onNavigationPayloadConsumed).toHaveBeenCalledTimes(1)

        rerender(
            <People
                users={[{ ...adminUser, department: 'Operations' }]}
                enrollments={[]}
                courses={[]}
                sessions={[]}
                currentUser={createUser({ id: 'u-admin', role: 'admin' })}
                navigationPayload={payload}
                onNavigationPayloadConsumed={onNavigationPayloadConsumed}
            />
        )

        expect(onNavigationPayloadConsumed).toHaveBeenCalledTimes(1)
    })

    it('clears selectedUser when that user is removed from the users prop', async () => {
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
            />
        )

        await user.click(screen.getByText('Trainer User'))
        expect(screen.getByTestId('profile-name')).toHaveTextContent('Trainer User')

        // Re-render without trainerUser — triggers the `if (!updatedUser) return null` branch
        rerender(
            <People
                users={[adminUser]}
                enrollments={[]}
                courses={[baseCourse]}
                sessions={[baseSession]}
                currentUser={adminUser}
            />
        )

        expect(screen.queryByTestId('profile-name')).toBeNull()
        expect(screen.getByText('Manage employees and training profiles')).toBeInTheDocument()
    })

    it('closes delete dialog without invoking onDeleteUser when prop is absent', async () => {
        const user = userEvent.setup()

        // Render WITHOUT onDeleteUser — exercises the false branch of `if (userToDelete && onDeleteUser)`.
        renderPeople({ onDeleteUser: undefined })

        await user.click(screen.getByText('Trainer User'))
        await user.click(screen.getByRole('button', { name: /mock delete person/i }))
        await user.click(screen.getByRole('button', { name: /back to people/i }))

        // Delete dialog should be open; confirm it without an onDeleteUser handler
        await user.click(screen.getByRole('button', { name: /mock confirm delete/i }))

        // Component should not crash and dialog should close
        expect(screen.getByText('Manage employees and training profiles')).toBeInTheDocument()
    })

})
