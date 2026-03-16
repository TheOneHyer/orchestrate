import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AddCertificationDialog } from './AddCertificationDialog'
import type { User } from '@/lib/types'

const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}))

function makeTrainer(id: string, name: string): User {
  return {
    id,
    name,
    email: `${id}@example.com`,
    role: 'trainer',
    department: 'Operations',
    certifications: [],
    hireDate: '2022-01-01T00:00:00.000Z',
  }
}

const trainers = [makeTrainer('t-1', 'Alex Trainer'), makeTrainer('t-2', 'Brook Trainer')]

describe('AddCertificationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Native date inputs are most reliable in jsdom when updated via change events.
  const setDateInput = (label: RegExp, value: string) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }

  it('renders the trigger button', () => {
    render(<AddCertificationDialog users={trainers} onAddCertification={vi.fn()} />)

    expect(screen.getByRole('button', { name: /add certification/i })).toBeInTheDocument()
  })

  it('opens the dialog when trigger button is clicked', async () => {
    render(<AddCertificationDialog users={trainers} onAddCertification={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/add a certification record to one or more trainers/i)).toBeInTheDocument()
  })

  it('shows all trainers as checkboxes', async () => {
    render(<AddCertificationDialog users={trainers} onAddCertification={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    expect(screen.getByLabelText(/alex trainer/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/brook trainer/i)).toBeInTheDocument()
  })

  it('shows empty state when no trainers exist', async () => {
    render(<AddCertificationDialog users={[]} onAddCertification={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    expect(screen.getByText(/no trainers found/i)).toBeInTheDocument()
  })

  it('selects a trainer checkbox', async () => {
    render(<AddCertificationDialog users={trainers} onAddCertification={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    const checkbox = screen.getByRole('checkbox', { name: /alex trainer/i })
    await userEvent.click(checkbox)

    expect(screen.getByText(/1 trainer selected/i)).toBeInTheDocument()
  })

  it('select-all button selects all trainers', async () => {
    render(<AddCertificationDialog users={trainers} onAddCertification={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    await userEvent.click(screen.getByRole('button', { name: /select all/i }))

    expect(screen.getByText(/2 trainers selected/i)).toBeInTheDocument()
  })

  it('select-all becomes deselect-all when all are selected', async () => {
    render(<AddCertificationDialog users={trainers} onAddCertification={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    await userEvent.click(screen.getByRole('button', { name: /select all/i }))

    expect(screen.getByRole('button', { name: /deselect all/i })).toBeInTheDocument()
  })

  it('deselect-all clears all selected trainers', async () => {
    render(<AddCertificationDialog users={trainers} onAddCertification={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    await userEvent.click(screen.getByRole('button', { name: /select all/i }))
    await userEvent.click(screen.getByRole('button', { name: /deselect all/i }))

    expect(screen.queryByText(/trainers selected/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument()

    // Assert individual trainer checkboxes are unchecked
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach(checkbox => {
      expect(checkbox).not.toBeChecked()
    })
  })

  it('submits successfully with valid data', async () => {
    const onAddCertification = vi.fn()
    const issuedDate = '2027-12-15'
    const expirationDate = '2028-01-01'

    render(<AddCertificationDialog users={trainers} onAddCertification={onAddCertification} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    await userEvent.type(screen.getByLabelText(/certification name/i), 'CPR Training')
    setDateInput(/issued date/i, issuedDate)
    setDateInput(/expiration date/i, expirationDate)
    await userEvent.click(screen.getByRole('checkbox', { name: /alex trainer/i }))

    await userEvent.click(screen.getByRole('button', { name: /^add certification$/i }))

    expect(onAddCertification).toHaveBeenCalledOnce()
    const [ids, cert] = onAddCertification.mock.calls[0]
    expect(ids).toEqual(['t-1'])
    expect(cert.certificationName).toBe('CPR Training')
    expect(cert.issuedDate).toBe(issuedDate)
    expect(cert.expirationDate).toBe(expirationDate)
    expect(toastSuccess).toHaveBeenCalledWith('Certification added to 1 trainer')
    expect(toastError).not.toHaveBeenCalled()

    // Assert the dialog closes after successful submit
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('submits successfully with valid data for multiple trainers', async () => {
    const onAddCertification = vi.fn()
    const issuedDate = '2027-12-15'
    const expirationDate = '2028-01-01'

    render(<AddCertificationDialog users={trainers} onAddCertification={onAddCertification} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    await userEvent.type(screen.getByLabelText(/certification name/i), 'CPR Training')
    setDateInput(/issued date/i, issuedDate)
    setDateInput(/expiration date/i, expirationDate)
    await userEvent.click(screen.getByRole('button', { name: /select all/i }))

    await userEvent.click(screen.getByRole('button', { name: /^add certification$/i }))

    expect(onAddCertification).toHaveBeenCalledOnce()
    const [ids, cert] = onAddCertification.mock.calls[0]
    expect(ids).toEqual(['t-1', 't-2'])
    expect(cert.certificationName).toBe('CPR Training')
    expect(cert.issuedDate).toBe(issuedDate)
    expect(cert.expirationDate).toBe(expirationDate)
    expect(toastSuccess).toHaveBeenCalledWith('Certification added to 2 trainers')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('resets form after successful submission', async () => {
    const onAddCertification = vi.fn()
    const issuedDate = '2027-12-15'
    const expirationDate = '2028-01-01'

    render(<AddCertificationDialog users={trainers} onAddCertification={onAddCertification} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    // Fill and submit the form
    await userEvent.type(screen.getByLabelText(/certification name/i), 'CPR Training')
    setDateInput(/issued date/i, issuedDate)
    setDateInput(/expiration date/i, expirationDate)
    await userEvent.click(screen.getByRole('checkbox', { name: /alex trainer/i }))

    await userEvent.click(screen.getByRole('button', { name: /^add certification$/i }))

    // Dialog should close
    expect(onAddCertification).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Reopen the dialog
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    // Assert form is reset (certification name and expiration date are cleared, issued date reset to today)
    expect(screen.getByLabelText(/certification name/i)).toHaveValue('')
    const issuedDateInput = screen.getByLabelText(/^issued date$/i) as HTMLInputElement
    const today = new Date().toISOString().split('T')[0]
    expect(issuedDateInput.value).toBe(today)
    expect(screen.getByLabelText(/^expiration date$/i)).toHaveValue('')

    // Assert no checkboxes remain checked
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach(checkbox => {
      expect(checkbox).not.toBeChecked()
    })
  })

  it('closes dialog when cancel button is clicked', async () => {
    const onAddCertification = vi.fn()

    render(<AddCertificationDialog users={trainers} onAddCertification={onAddCertification} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Click the close button (X button on the dialog)
    const closeButton = screen.getByRole('button', { name: /close/i })
    await userEvent.click(closeButton)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onAddCertification).not.toHaveBeenCalled()
  })

  it('shows validation error when expiration date omitted', async () => {
    const onAddCertification = vi.fn()
    const issuedDate = '2027-12-15'

    render(<AddCertificationDialog users={trainers} onAddCertification={onAddCertification} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    await userEvent.type(screen.getByLabelText(/certification name/i), 'Ongoing Training')
    setDateInput(/issued date/i, issuedDate)
    // Leave expiration date empty
    await userEvent.click(screen.getByRole('checkbox', { name: /alex trainer/i }))

    await userEvent.click(screen.getByRole('button', { name: /^add certification$/i }))

    // Should show validation error because expiration date is required in current implementation
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/expiration date/i))
    expect(onAddCertification).not.toHaveBeenCalled()
  })

  it('shows validation error when required fields are missing', async () => {
    const onAddCertification = vi.fn()

    render(<AddCertificationDialog users={trainers} onAddCertification={onAddCertification} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    await userEvent.click(screen.getByRole('button', { name: /^add certification$/i }))

    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/please enter.*certification name/i))
    expect(onAddCertification).not.toHaveBeenCalled()
  })

  it('shows validation error when no trainers are selected', async () => {
    const onAddCertification = vi.fn()

    render(<AddCertificationDialog users={trainers} onAddCertification={onAddCertification} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    await userEvent.type(screen.getByLabelText(/certification name/i), 'CPR Training')
    setDateInput(/issued date/i, '2027-12-15')
    setDateInput(/expiration date/i, '2028-01-01')

    await userEvent.click(screen.getByRole('button', { name: /^add certification$/i }))

    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/select.*trainer/i))
    expect(onAddCertification).not.toHaveBeenCalled()
  })

  it('shows validation error when expiration date is before issued date', async () => {
    const onAddCertification = vi.fn()

    render(<AddCertificationDialog users={trainers} onAddCertification={onAddCertification} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    await userEvent.type(screen.getByLabelText(/certification name/i), 'CPR Training')
    setDateInput(/issued date/i, '2028-01-02')
    setDateInput(/expiration date/i, '2028-01-01')
    await userEvent.click(screen.getByRole('checkbox', { name: /alex trainer/i }))

    await userEvent.click(screen.getByRole('button', { name: /^add certification$/i }))

    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/expiration date.*issued date/i))
    expect(onAddCertification).not.toHaveBeenCalled()
  })
})
