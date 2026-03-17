import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('resets local draft state when reopening from closed state', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <ManageCertificationsDialog
        {...defaultProps}
        open={false}
        certifications={[makeCert({ certificationName: 'Initial Cert' })]}
      />
    )

    rerender(
      <ManageCertificationsDialog
        {...defaultProps}
        open={true}
        certifications={[makeCert({ certificationName: 'Initial Cert' })]}
      />
    )

    await user.type(screen.getByLabelText(/certification name/i), 'Unsaved Draft')
    await user.type(screen.getByLabelText(/issued date/i), '2024-07-01')
    await user.type(screen.getByLabelText(/expiration date/i), '2026-07-01')
    await user.click(screen.getByRole('button', { name: /^add certification$/i }))
    expect(screen.getByText('Unsaved Draft')).toBeInTheDocument()

    rerender(
      <ManageCertificationsDialog
        {...defaultProps}
        open={false}
        certifications={[makeCert({ certificationName: 'Reopened Cert' })]}
      />
    )
    rerender(
      <ManageCertificationsDialog
        {...defaultProps}
        open={true}
        certifications={[makeCert({ certificationName: 'Reopened Cert' })]}
      />
    )

    expect(screen.queryByText('Unsaved Draft')).not.toBeInTheDocument()
    expect(screen.getByText('Reopened Cert')).toBeInTheDocument()
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

    const addBtn = screen.getByRole('button', { name: /^add certification$/i })
    expect(addBtn).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/certification name/i), 'OSHA Training')
    expect(addBtn).toBeDisabled()

    await userEvent.clear(screen.getByLabelText(/certification name/i))
    await userEvent.type(screen.getByLabelText(/issued date/i), '2024-06-01')
    await userEvent.type(screen.getByLabelText(/expiration date/i), '2026-06-01')
    expect(addBtn).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/certification name/i), 'OSHA Training')
    expect(addBtn).toBeEnabled()
  })

  it('deletes a certification from the list', async () => {
    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[makeCert({ certificationName: 'First Aid' })]}
      />
    )

    expect(screen.getByText('First Aid')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /delete certification first aid/i }))

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

    await userEvent.click(screen.getByRole('button', { name: /edit certification advanced training/i }))

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

    await userEvent.click(screen.getByRole('button', { name: /edit certification advanced training/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel edit/i }))

    expect(screen.getByRole('button', { name: /^add certification$/i })).toBeInTheDocument()
  })

  it('updates a certification through the edit flow and saves the updated value', async () => {
    const onSave = vi.fn()

    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[makeCert({ certificationName: 'Advanced Training' })]}
        onSave={onSave}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /edit certification advanced training/i }))
    await userEvent.clear(screen.getByLabelText(/certification name/i))
    await userEvent.type(screen.getByLabelText(/certification name/i), 'Updated Training')
    await userEvent.click(screen.getByRole('button', { name: /update certification/i }))

    expect(screen.getByText('Updated Training')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^add certification$/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ certificationName: 'Updated Training' })
    ])
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
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ certificationName: 'CPR' })
    ])
  })

  it('closes the dialog after save flow completes', async () => {
    const onSave = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[makeCert({ certificationName: 'CPR' })]}
        onSave={onSave}
        onOpenChange={onOpenChange}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('updates and deletes one certification without affecting others', async () => {
    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[
          makeCert({ certificationName: 'CPR' }),
          makeCert({ certificationName: 'Forklift Safety' }),
          makeCert({ certificationName: 'HazMat' }),
        ]}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /edit certification cpr/i }))
    await userEvent.clear(screen.getByLabelText(/certification name/i))
    await userEvent.type(screen.getByLabelText(/certification name/i), 'CPR Updated')
    await userEvent.click(screen.getByRole('button', { name: /update certification/i }))

    expect(screen.getByText('CPR Updated')).toBeInTheDocument()
    expect(screen.getByText('Forklift Safety')).toBeInTheDocument()
    expect(screen.getByText('HazMat')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /delete certification forklift safety/i }))

    expect(screen.getByText('CPR Updated')).toBeInTheDocument()
    expect(screen.queryByText('Forklift Safety')).not.toBeInTheDocument()
    expect(screen.getByText('HazMat')).toBeInTheDocument()
  })

  it('keeps edit mode aligned when deleting an earlier certification', async () => {
    const user = userEvent.setup()

    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[
          makeCert({ certificationName: 'CPR' }),
          makeCert({ certificationName: 'Forklift Safety' }),
          makeCert({ certificationName: 'HazMat' }),
        ]}
      />
    )

    await user.click(screen.getByRole('button', { name: /edit certification hazmat/i }))
    await user.click(screen.getByRole('button', { name: /delete certification cpr/i }))

    expect(screen.getByRole('button', { name: /update certification/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue('HazMat')).toBeInTheDocument()
    expect(screen.queryByText('CPR')).not.toBeInTheDocument()
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

    expect(screen.getByText(/renewal in progress/i, { selector: 'span' })).toBeInTheDocument()
  })

  it('applies fallback defaults when editing legacy certifications with missing fields', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const legacyCert = {
      certificationName: 'Legacy Cert',
      issuedDate: '2024-01-01',
      expirationDate: '2026-01-01',
      remindersSent: 0,
      renewalInProgress: false,
      notes: '',
    } as unknown as CertificationRecord

    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[legacyCert]}
        onSave={onSave}
      />
    )

    await user.click(screen.getByRole('button', { name: /edit certification legacy cert/i }))
    await user.click(screen.getByRole('button', { name: /update certification/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({
        certificationName: 'Legacy Cert',
        status: 'active',
        renewalRequired: true,
      }),
    ])
  })

  it('renders notes text and allows toggling renewal flags before add', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(<ManageCertificationsDialog {...defaultProps} onSave={onSave} />)

    await user.type(screen.getByLabelText(/certification name/i), 'Forklift Operator')
    await user.type(screen.getByLabelText(/issued date/i), '2024-08-10')
    await user.type(screen.getByLabelText(/expiration date/i), '2026-08-10')

    const renewalRequiredSwitch = screen.getByRole('switch', { name: /renewal required/i })
    const renewalInProgressSwitch = screen.getByRole('switch', { name: /renewal in progress/i })
    await user.click(renewalRequiredSwitch)
    await user.click(renewalInProgressSwitch)
    await user.type(screen.getByLabelText(/notes/i), 'Needs annual practical check')

    expect(screen.getByText(/^No$/)).toBeInTheDocument()
    expect(screen.getByText(/^Yes$/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^add certification$/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(screen.getByText(/needs annual practical check/i)).toBeInTheDocument()
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({
        certificationName: 'Forklift Operator',
        renewalRequired: false,
        renewalInProgress: true,
        notes: 'Needs annual practical check',
      }),
    ])
  })

  it('renders mixed status and renewal states without cross-item leakage', () => {
    render(
      <ManageCertificationsDialog
        {...defaultProps}
        certifications={[
          makeCert({
            certificationName: 'Expired Cert',
            status: 'expired',
            expirationDate: '2020-01-01',
            renewalRequired: false,
            renewalInProgress: false,
          }),
          makeCert({
            certificationName: 'Renewing Cert',
            status: 'expiring-soon',
            renewalRequired: true,
            renewalInProgress: true,
          }),
        ]}
      />
    )

    const expiredName = screen.getByText('Expired Cert')
    const renewingName = screen.getByText('Renewing Cert')
    expect(expiredName).toBeInTheDocument()
    expect(renewingName).toBeInTheDocument()
    expect(screen.getByText(/renewal in progress/i, { selector: 'span' })).toBeInTheDocument()

    const expiredContainer = screen.getByTestId('certification-item-expired-cert-0')
    const renewingContainer = screen.getByTestId('certification-item-renewing-cert-1')

    expect(within(renewingContainer).getByText(/renewal required/i, { selector: 'span' })).toBeInTheDocument()
    expect(within(expiredContainer).queryByText(/renewal required/i, { selector: 'span' })).not.toBeInTheDocument()
  })
})
