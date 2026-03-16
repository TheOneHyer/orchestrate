import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ManageCertificationsDialog } from './ManageCertificationsDialog'
import type { CertificationRecord } from '@/lib/types'

function makeCert(overrides: Partial<CertificationRecord> = {}): CertificationRecord {
  return {
    certificationName: 'CPR Certification',
    issuedDate: '2024-01-01',
    expirationDate: '2026-01-01',
    status: 'active',
    renewalRequired: true,
    remindersSent: 0,
    renewalInProgress: false,
    notes: '',
    ...overrides,
  }
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  certifications: [],
  onSave: vi.fn(),
}

describe('ManageCertificationsDialog', () => {
  it('renders empty state when no certifications exist', () => {
    render(<ManageCertificationsDialog {...defaultProps} />)

    expect(screen.getByText(/no certifications added yet/i)).toBeInTheDocument()
  })

  it('shows existing certifications', () => {
    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[makeCert({ certificationName: 'Safety Training' })]}
      />
    )

    expect(screen.getByText('Safety Training')).toBeInTheDocument()
  })

  it('adds a new certification to the list', async () => {
    render(<ManageCertificationsDialog {...defaultProps} />)

    await userEvent.type(screen.getByLabelText(/certification name/i), 'OSHA Training')
    await userEvent.type(screen.getByLabelText(/issued date/i), '2024-06-01')
    await userEvent.type(screen.getByLabelText(/expiration date/i), '2026-06-01')
    await userEvent.click(screen.getByRole('button', { name: /^add certification$/i }))

    expect(screen.getByText('OSHA Training')).toBeInTheDocument()
  })

  it('does not add certification when required fields are missing', async () => {
    render(<ManageCertificationsDialog {...defaultProps} />)

    // Add button should be disabled when fields are empty
    const addBtn = screen.getByRole('button', { name: /^add certification$/i })
    expect(addBtn).toBeDisabled()
  })

  it('deletes a certification from the list', async () => {
    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[makeCert({ certificationName: 'First Aid' })]}
      />
    )

    expect(screen.getByText('First Aid')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '' })) // X delete button

    expect(screen.queryByText('First Aid')).not.toBeInTheDocument()
    expect(screen.getByText(/no certifications added yet/i)).toBeInTheDocument()
  })

  it('enters edit mode when Edit button is clicked', async () => {
    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[makeCert({ certificationName: 'Advanced Training' })]}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))

    expect(screen.getByRole('button', { name: /update certification/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel edit/i })).toBeInTheDocument()
  })

  it('cancels edit mode when Cancel Edit is clicked', async () => {
    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[makeCert({ certificationName: 'Advanced Training' })]}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel edit/i }))

    expect(screen.getByRole('button', { name: /^add certification$/i })).toBeInTheDocument()
  })

  it('calls onSave with current certifications when Save Changes is clicked', async () => {
    const onSave = vi.fn()
    const cert = makeCert({ certificationName: 'CPR' })

    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[cert]}
        onSave={onSave}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith([cert])
  })

  it('calls onOpenChange when Cancel is clicked', async () => {
    const onOpenChange = vi.fn()
    render(<ManageCertificationsDialog {...defaultProps} onOpenChange={onOpenChange} />)

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows Renewal in Progress badge when cert has renewalInProgress', () => {
    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[makeCert({ certificationName: 'Fire Safety', renewalInProgress: true })]}
      />
    )

    expect(screen.getAllByText(/renewal in progress/i).length).toBeGreaterThan(0)
  })
})
