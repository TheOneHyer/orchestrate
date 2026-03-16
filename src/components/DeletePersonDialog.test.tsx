it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn()
    render(
        <DeletePersonDialog
            user={createUser({ role: 'trainer', name: 'Taylor' })}
            open={true}
            onOpenChange={onOpenChange}
            onConfirm={vi.fn()}
        />
    )
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    await userEvent.click(cancelBtn)
    expect(onOpenChange).toHaveBeenCalledWith(false)
})

it('calls onOpenChange(false) when overlay is clicked', async () => {
    const onOpenChange = vi.fn()
    render(
        <DeletePersonDialog
            user={createUser({ role: 'trainer', name: 'Taylor' })}
            open={true}
            onOpenChange={onOpenChange}
            onConfirm={vi.fn()}
        />
    )
    // Simulate clicking the overlay/backdrop if possible
    const overlay = screen.getByTestId('dialog-overlay')
    await userEvent.click(overlay)
    expect(onOpenChange).toHaveBeenCalledWith(false)
})

it('renders nothing when open is false', () => {
    render(
        <DeletePersonDialog
            user={createUser({ role: 'trainer', name: 'Taylor' })}
            open={false}
            onOpenChange={vi.fn()}
            onConfirm={vi.fn()}
        />
    )
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument()
})
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DeletePersonDialog } from './DeletePersonDialog'
import type { User } from '@/lib/types'

function createUser(overrides: Partial<User> = {}): User {
    return {
        id: 'user-1',
        name: 'Taylor Trainer',
        email: 'taylor@example.com',
        role: 'trainer',
        department: 'Operations',
        certifications: [],
        hireDate: '2020-01-01T00:00:00.000Z',
        ...overrides,
    }
}

describe('DeletePersonDialog', () => {
    it('renders nothing when no user is provided', () => {
        const { container } = render(
            <DeletePersonDialog
                user={null}
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />
        )

        expect(container).toBeEmptyDOMElement()
    })

    it('renders trainer-specific deletion warning', () => {
        render(
            <DeletePersonDialog
                user={createUser({ role: 'trainer', name: 'Taylor' })}
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />
        )

        expect(screen.getByText('Delete Taylor?')).toBeInTheDocument()
        expect(screen.getByText(/remove them from all assigned training sessions/i)).toBeInTheDocument()
    })

    it('renders employee-specific warning and confirms deletion', async () => {
        const onConfirm = vi.fn()

        render(
            <DeletePersonDialog
                user={createUser({ role: 'employee', name: 'Evan Employee' })}
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={onConfirm}
            />
        )

        expect(screen.getByText(/remove them from all enrolled courses/i)).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: /delete/i }))
        expect(onConfirm).toHaveBeenCalledOnce()
    })
})
