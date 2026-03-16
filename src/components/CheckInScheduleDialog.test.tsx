import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { CheckInScheduleDialog } from './CheckInScheduleDialog'
import type { User, CheckInSchedule } from '@/lib/types'

function makeTrainer(id = 't-1', name = 'Alex Trainer'): User {
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

const trainer = makeTrainer()

function makeProps(overrides: Partial<ComponentProps<typeof CheckInScheduleDialog>> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    trainers: [trainer],
    onSubmit: vi.fn(),
    currentUserId: 'admin-1',
    ...overrides,
  }
}

describe('CheckInScheduleDialog', () => {
  function makeExistingSchedule(overrides: Partial<CheckInSchedule> = {}): CheckInSchedule {
    return {
      id: 'sched-1',
      trainerId: trainer.id,
      frequency: 'weekly',
      startDate: '2026-01-01T00:00:00.000Z',
      nextScheduledDate: '2026-01-08T00:00:00.000Z',
      status: 'active',
      notificationEnabled: true,
      autoReminders: true,
      reminderHoursBefore: 24,
      createdBy: 'admin-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      completedCheckIns: 0,
      missedCheckIns: 0,
      ...overrides,
    }
  }

  it('renders in create mode by default', () => {
    render(<CheckInScheduleDialog {...makeProps()} />)

    expect(screen.getByText(/create check-in schedule/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create schedule/i })).toBeInTheDocument()
  })

  it('renders in edit mode when existingSchedule is provided', () => {
    const existing = makeExistingSchedule({
      frequency: 'monthly',
      nextScheduledDate: '2026-02-01T00:00:00.000Z',
    })

    render(<CheckInScheduleDialog {...makeProps({ existingSchedule: existing })} />)

    expect(screen.getByText(/edit check-in schedule/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update schedule/i })).toBeInTheDocument()
  })

  it('disables the trainer selector in edit mode', () => {
    const existing = makeExistingSchedule()

    render(<CheckInScheduleDialog {...makeProps({ existingSchedule: existing })} />)

    // In edit mode, the trainer select trigger should be disabled
    const triggerButton = screen.getByRole('combobox', { name: /trainer/i })
    expect(triggerButton).toBeDisabled()
  })

  it('hides reminder hours when notifications are disabled', async () => {
    render(<CheckInScheduleDialog {...makeProps()} />)

    // Initially both notification and reminder switches are on – reminder hours visible
    expect(screen.getByLabelText(/reminder time/i)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /enable notifications/i })).toHaveAttribute('aria-checked', 'true')

    // Disable notifications
    await userEvent.click(screen.getByLabelText(/enable notifications/i))

    expect(screen.queryByLabelText(/reminder time/i)).not.toBeInTheDocument()
  })

  it('hides reminder hours when auto reminders are disabled', async () => {
    render(<CheckInScheduleDialog {...makeProps()} />)

    await userEvent.click(screen.getByLabelText(/automatic reminders/i))

    expect(screen.queryByLabelText(/reminder time/i)).not.toBeInTheDocument()
  })

  it('shows custom days input when editing a custom schedule', () => {
    const existing = makeExistingSchedule({ frequency: 'custom', customDays: 10 })

    render(<CheckInScheduleDialog {...makeProps({ existingSchedule: existing })} />)

    expect(screen.getByLabelText(/custom days/i)).toBeInTheDocument()
  })

  it('hides custom days input in default weekly mode', () => {
    render(<CheckInScheduleDialog {...makeProps()} />)

    expect(screen.queryByLabelText(/custom days/i)).not.toBeInTheDocument()
  })

  it('submit button is disabled when no trainer is selected', () => {
    // In this test, makeProps provides a trainer option list but no default trainer selection,
    // so the create action should remain disabled until a selection is made.
    render(<CheckInScheduleDialog {...makeProps()} />)

    expect(screen.getByRole('button', { name: /create schedule/i })).toBeDisabled()
  })

  it('submits edited schedule when existingSchedule is provided', async () => {
    const onSubmit = vi.fn()
    const existing = makeExistingSchedule()

    render(
      <CheckInScheduleDialog
        {...makeProps()}
        existingSchedule={existing}
        onSubmit={onSubmit}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /update schedule/i }))

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        trainerId: 't-1',
        frequency: 'weekly',
        createdBy: 'admin-1',
      })
    )
  })

  it('submits a new schedule when a trainer is selected in create mode', async () => {
    const onSubmit = vi.fn()

    render(<CheckInScheduleDialog {...makeProps({ onSubmit })} />)

    await userEvent.click(screen.getByRole('combobox', { name: /trainer/i }))
    await userEvent.click(await screen.findByRole('option', { name: /alex trainer/i }))
    await userEvent.click(screen.getByRole('button', { name: /create schedule/i }))

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        trainerId: 't-1',
        frequency: 'weekly',
        createdBy: 'admin-1',
      })
    )
  })

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn()
    render(<CheckInScheduleDialog {...makeProps({ onClose })} />)

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows custom days input when frequency is set to custom', async () => {
    render(<CheckInScheduleDialog {...makeProps()} />)

    // Select a trainer
    await userEvent.click(screen.getByRole('combobox', { name: /trainer/i }))
    await userEvent.click(await screen.findByRole('option', { name: /alex trainer/i }))

    // Initially custom days input should not be visible
    expect(screen.queryByLabelText(/custom days/i)).not.toBeInTheDocument()

    // Open frequency combobox and select custom
    await userEvent.click(screen.getByRole('combobox', { name: /Check-In Frequency/i }))
    await userEvent.click(await screen.findByRole('option', { name: /custom interval/i }))

    // Custom days input should now be visible
    expect(screen.getByLabelText(/custom days/i)).toBeInTheDocument()
  })
})
