import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AddCertificationDialog } from './AddCertificationDialog'
import type { User } from '@/lib/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

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

  it('submits successfully with valid data', async () => {
    const onAddCertification = vi.fn()
    render(<AddCertificationDialog users={trainers} onAddCertification={onAddCertification} />)
    await userEvent.click(screen.getByRole('button', { name: /add certification/i }))

    await userEvent.type(screen.getByLabelText(/certification name/i), 'CPR Training')
    await userEvent.type(screen.getByLabelText(/expiration date/i), '2028-01-01')
    await userEvent.click(screen.getByRole('checkbox', { name: /alex trainer/i }))

    await userEvent.click(screen.getByRole('button', { name: /^add certification$/i }))

    expect(onAddCertification).toHaveBeenCalledOnce()
    const [ids, cert] = onAddCertification.mock.calls[0]
    expect(ids).toContain('t-1')
    expect(cert.certificationName).toBe('CPR Training')
  })
})
