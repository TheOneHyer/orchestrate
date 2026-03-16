import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AddPersonDialog } from './AddPersonDialog'

const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('sonner', () => ({
    toast: {
        error: (...args: unknown[]) => toastError(...args),
        success: (...args: unknown[]) => toastSuccess(...args),
    },
}))

describe('AddPersonDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const baseProps = {
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
        existingEmails: [] as string[],
    }

    it('renders required form fields', () => {
        render(<AddPersonDialog {...baseProps} />)

        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/department/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /add person/i })).toBeInTheDocument()
    })

    it('shows validation errors and toast when required fields are missing', async () => {
        render(<AddPersonDialog {...baseProps} />)

        await userEvent.click(screen.getByRole('button', { name: /add person/i }))

        expect(screen.getByText(/name is required/i)).toBeInTheDocument()
        expect(screen.getByText(/email is required/i)).toBeInTheDocument()
        expect(screen.getByText(/department is required/i)).toBeInTheDocument()
        expect(screen.getByText(/at least one shift must be selected/i)).toBeInTheDocument()
        expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/please fix the errors/i))
    })

    it('validates duplicate email addresses case-insensitively', async () => {
        render(<AddPersonDialog {...baseProps} existingEmails={['alex@example.com']} />)

        await userEvent.type(screen.getByLabelText(/full name/i), 'Alex')
        await userEvent.type(screen.getByLabelText(/email address/i), 'ALEX@EXAMPLE.COM')
        await userEvent.type(screen.getByLabelText(/department/i), 'Ops')
        await userEvent.click(screen.getByRole('checkbox', { name: /day/i }))
        await userEvent.click(screen.getByRole('button', { name: /add person/i }))

        expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
    })

    it('adds and removes certifications from the badge list', async () => {
        render(<AddPersonDialog {...baseProps} />)

        await userEvent.type(screen.getByLabelText(/certifications/i), 'CPR')
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
        expect(screen.getByText('CPR')).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: /remove certification cpr/i }))
        expect(screen.queryByText('CPR')).not.toBeInTheDocument()
    })

    it('submits a valid person and normalizes email casing', async () => {
        const onSave = vi.fn()
        const onOpenChange = vi.fn()

        render(<AddPersonDialog {...baseProps} onSave={onSave} onOpenChange={onOpenChange} />)

        await userEvent.type(screen.getByLabelText(/full name/i), 'Jamie Doe')
        await userEvent.type(screen.getByLabelText(/email address/i), 'JAMIE.DOE@EXAMPLE.COM')
        await userEvent.type(screen.getByLabelText(/department/i), 'Operations')
        await userEvent.click(screen.getByRole('checkbox', { name: /day/i }))

        await userEvent.type(screen.getByLabelText(/certifications/i), 'Forklift')
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

        await userEvent.click(screen.getByRole('button', { name: /add person/i }))

        expect(onSave).toHaveBeenCalledOnce()
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Jamie Doe',
                email: 'jamie.doe@example.com',
                department: 'Operations',
                certifications: ['Forklift'],
            })
        )
        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/added successfully/i))
    })

    it('closes dialog when cancel is clicked', async () => {
        const onOpenChange = vi.fn()

        render(<AddPersonDialog {...baseProps} onOpenChange={onOpenChange} />)

        await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

        expect(onOpenChange).toHaveBeenCalledWith(false)
    })
})
