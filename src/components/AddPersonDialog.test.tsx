import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AddPersonDialog } from './AddPersonDialog'
import type { User } from '@/lib/types'

const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('sonner', () => ({
    toast: {
        error: (...args: unknown[]) => toastError(...args),
        success: (...args: unknown[]) => toastSuccess(...args),
    },
}))

describe('AddPersonDialog', () => {
    let baseProps: ComponentProps<typeof AddPersonDialog>

    beforeEach(() => {
        vi.clearAllMocks()
        baseProps = {
            open: true,
            onOpenChange: vi.fn<(open: boolean) => void>(),
            onSave: vi.fn<(user: User) => void>(),
            existingEmails: [],
        }
    })

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
        expect(baseProps.onSave).not.toHaveBeenCalled()
    })

    it('validates duplicate email addresses case-insensitively', async () => {
        render(<AddPersonDialog {...baseProps} existingEmails={['alex@example.com']} />)

        await userEvent.type(screen.getByLabelText(/full name/i), 'Alex')
        await userEvent.type(screen.getByLabelText(/email address/i), 'ALEX@EXAMPLE.COM')
        await userEvent.type(screen.getByLabelText(/department/i), 'Ops')
        await userEvent.click(screen.getByRole('checkbox', { name: /day/i }))
        await userEvent.click(screen.getByRole('button', { name: /add person/i }))

        expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
        expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/please fix the errors/i))
        expect(baseProps.onSave).not.toHaveBeenCalled()
    })

    it('adds and removes certifications from the badge list', async () => {
        render(<AddPersonDialog {...baseProps} />)

        await userEvent.type(screen.getByLabelText(/certifications/i), 'CPR')
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
        expect(screen.getByText('CPR')).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: /remove certification cpr/i }))
        expect(screen.queryByText('CPR')).not.toBeInTheDocument()
    })

    it('shows an error for invalid email format', async () => {
        render(<AddPersonDialog {...baseProps} />)

        await userEvent.type(screen.getByLabelText(/full name/i), 'Alex Example')
        await userEvent.type(screen.getByLabelText(/email address/i), 'not-an-email')
        await userEvent.type(screen.getByLabelText(/department/i), 'Ops')
        await userEvent.click(screen.getByRole('checkbox', { name: /day/i }))
        await userEvent.click(screen.getByRole('button', { name: /add person/i }))

        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument()
        expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/please fix the errors/i))
        expect(baseProps.onSave).not.toHaveBeenCalled()
    })

    it('creates a trainer profile with specializations when role is set to trainer', async () => {
        render(<AddPersonDialog {...baseProps} />)

        await userEvent.type(screen.getByLabelText(/full name/i), 'Taylor Trainer')
        await userEvent.type(screen.getByLabelText(/email address/i), 'Taylor.Trainer@Example.com')

        await userEvent.click(screen.getByRole('combobox'))
        await userEvent.click(await screen.findByRole('option', { name: /trainer/i }))

        expect(screen.getByText(/trainer profile will be created automatically/i)).toBeInTheDocument()

        await userEvent.type(screen.getByLabelText(/department/i), 'Operations')
        await userEvent.click(screen.getByRole('checkbox', { name: /evening/i }))

        await userEvent.type(screen.getByLabelText(/certifications/i), 'CPR')
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

        await userEvent.click(screen.getByRole('button', { name: /add person/i }))

        expect(baseProps.onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                role: 'trainer',
                email: 'taylor.trainer@example.com',
                shifts: ['evening'],
                certifications: ['CPR'],
                trainerProfile: expect.objectContaining({
                    authorizedRoles: [],
                    shiftSchedules: [],
                    specializations: ['CPR'],
                }),
            })
        )
    })

    it('supports enter-to-add certification', async () => {
        render(<AddPersonDialog {...baseProps} />)

        await userEvent.type(screen.getByLabelText(/full name/i), 'Morgan Learn')
        await userEvent.type(screen.getByLabelText(/email address/i), 'morgan@example.com')
        await userEvent.type(screen.getByLabelText(/department/i), 'Training')
        await userEvent.click(screen.getByRole('checkbox', { name: /day/i }))

        await userEvent.type(screen.getByLabelText(/certifications/i), 'CPR{Enter}')

        expect(screen.getByText('CPR')).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: /add person/i }))

        expect(baseProps.onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                certifications: ['CPR'],
            })
        )
    })

    it('ignores duplicate certifications when adding the same value twice', async () => {
        render(<AddPersonDialog {...baseProps} />)

        await userEvent.type(screen.getByLabelText(/certifications/i), 'CPR')
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
        await userEvent.type(screen.getByLabelText(/certifications/i), 'CPR')
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

        expect(screen.getAllByText('CPR')).toHaveLength(1)
    })

    it('removes previously selected shifts', async () => {
        render(<AddPersonDialog {...baseProps} />)

        await userEvent.type(screen.getByLabelText(/full name/i), 'Casey Change')
        await userEvent.type(screen.getByLabelText(/email address/i), 'casey@example.com')
        await userEvent.type(screen.getByLabelText(/department/i), 'Operations')

        await userEvent.click(screen.getByRole('checkbox', { name: /day/i }))
        await userEvent.click(screen.getByRole('checkbox', { name: /day/i }))
        await userEvent.click(screen.getByRole('checkbox', { name: /evening/i }))

        await userEvent.click(screen.getByRole('button', { name: /add person/i }))

        expect(baseProps.onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                shifts: ['evening'],
            })
        )
    })

    it('submits a valid person and normalizes email casing', async () => {
        render(<AddPersonDialog {...baseProps} />)

        await userEvent.type(screen.getByLabelText(/full name/i), 'Jamie Doe')
        await userEvent.type(screen.getByLabelText(/email address/i), 'JAMIE.DOE@EXAMPLE.COM')
        await userEvent.type(screen.getByLabelText(/department/i), 'Operations')
        await userEvent.click(screen.getByRole('checkbox', { name: /day/i }))

        await userEvent.type(screen.getByLabelText(/certifications/i), 'Forklift')
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

        await userEvent.click(screen.getByRole('button', { name: /add person/i }))

        expect(baseProps.onSave).toHaveBeenCalledOnce()
        expect(baseProps.onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Jamie Doe',
                email: 'jamie.doe@example.com',
                department: 'Operations',
                shifts: ['day'],
                certifications: ['Forklift'],
            })
        )
        expect(baseProps.onOpenChange).toHaveBeenCalledWith(false)
        expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/added successfully/i))
    })

    it('closes dialog when cancel is clicked', async () => {
        const onOpenChange = vi.fn()
        const onSave = vi.fn()

        render(<AddPersonDialog {...baseProps} onOpenChange={onOpenChange} onSave={onSave} />)

        await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(onSave).not.toHaveBeenCalled()
    })

    it('ignores whitespace-only certification input', async () => {
        render(<AddPersonDialog {...baseProps} />)

        await userEvent.type(screen.getByLabelText(/certifications/i), '   ')
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

        // No certification should be added
        expect(screen.queryByText(/^\s+$/)).not.toBeInTheDocument()
    })

    it('clears all form state when dialog is closed', async () => {
        const { rerender } = render(<AddPersonDialog {...baseProps} />)

        await userEvent.type(screen.getByLabelText(/full name/i), 'Test Person')
        await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com')
        await userEvent.type(screen.getByLabelText(/department/i), 'Ops')
        await userEvent.type(screen.getByLabelText(/certifications/i), 'CPR')
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

        await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

        // Reopen dialog and verify state is cleared
        baseProps.open = true
        rerender(<AddPersonDialog {...baseProps} />)

        expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe('')
        expect((screen.getByLabelText(/email address/i) as HTMLInputElement).value).toBe('')
        expect((screen.getByLabelText(/department/i) as HTMLInputElement).value).toBe('')
        expect((screen.getByLabelText(/certifications/i) as HTMLInputElement).value).toBe('')
    })

    it('creates user with role employee when role selection is not changed', async () => {
        render(<AddPersonDialog {...baseProps} />)

        await userEvent.type(screen.getByLabelText(/full name/i), 'Default Employee')
        await userEvent.type(screen.getByLabelText(/email address/i), 'employee@example.com')
        await userEvent.type(screen.getByLabelText(/department/i), 'Ops')
        await userEvent.click(screen.getByRole('checkbox', { name: /day/i }))

        await userEvent.click(screen.getByRole('button', { name: /add person/i }))

        expect(baseProps.onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                role: 'employee',
            })
        )
    })
})
