import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  trainers: [trainer],
  onSubmit: vi.fn(),
  currentUserId: 'admin-1',
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
    render(<CheckInScheduleDialog {...defaultProps} />)

    expect(screen.getByText(/create check-in schedule/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create schedule/i })).toBeInTheDocument()
  })

  it('renders in edit mode when existingSchedule is provided', () => {
    const existing = makeExistingSchedule({
      frequency: 'monthly',
      nextScheduledDate: '2026-02-01T00:00:00.000Z',
    })

    render(<CheckInScheduleDialog {...defaultProps} existingSchedule={existing} />)

    expect(screen.getByText(/edit check-in schedule/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update schedule/i })).toBeInTheDocument()
  })

  it('disables the trainer selector in edit mode', () => {
    const existing = makeExistingSchedule({ autoReminders: false })

    render(<CheckInScheduleDialog {...defaultProps} existingSchedule={existing} />)

    // In edit mode, the trainer select trigger should be disabled
    const triggerButton = screen.getByRole('combobox', { name: /trainer/i })
    expect(triggerButton).toBeDisabled()
  })

  it('hides reminder hours when notifications are disabled', async () => {
    render(<CheckInScheduleDialog {...defaultProps} />)

    // Initially both notification and reminder switches are on – reminder hours visible
    expect(screen.getByLabelText(/reminder time/i)).toBeInTheDocument()

    // Disable notifications
    await userEvent.click(screen.getByLabelText(/enable notifications/i))

    expect(screen.queryByLabelText(/reminder time/i)).not.toBeInTheDocument()
  })

  it('hides reminder hours when auto reminders are disabled', async () => {
    render(<CheckInScheduleDialog {...defaultProps} />)

    await userEvent.click(screen.getByLabelText(/automatic reminders/i))

    expect(screen.queryByLabelText(/reminder time/i)).not.toBeInTheDocument()
  })

  it('shows custom days input when editing a custom schedule', () => {
    const existing = makeExistingSchedule({ frequency: 'custom', customDays: 10 })

    render(<CheckInScheduleDialog {...defaultProps} existingSchedule={existing} />)

    expect(screen.getByLabelText(/custom days/i)).toBeInTheDocument()
  })

  it('hides custom days input in default weekly mode', () => {
    render(<CheckInScheduleDialog {...defaultProps} />)

    expect(screen.queryByLabelText(/custom days/i)).not.toBeInTheDocument()
  })

  it('submit button is disabled when no trainer is selected', () => {
    render(<CheckInScheduleDialog {...defaultProps} />)

    expect(screen.getByRole('button', { name: /create schedule/i })).toBeDisabled()
  })

  it('calls onSubmit with schedule data when a trainer is selected and form submitted', async () => {
    const onSubmit = vi.fn()
    const existing = makeExistingSchedule()

    render(
      <CheckInScheduleDialog
        {...defaultProps}
        existingSchedule={existing}
        onSubmit={onSubmit}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /update schedule/i }))

    expect(onSubmit).toHaveBeenCalledOnce()
    const arg = onSubmit.mock.calls[0][0]
    expect(arg.trainerId).toBe('t-1')
    expect(arg.frequency).toBe('weekly')
    expect(arg.createdBy).toBe('admin-1')
  })

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn()
    render(<CheckInScheduleDialog {...defaultProps} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
