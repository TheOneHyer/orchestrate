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
    const user = userEvent.setup()
    render(<CheckInScheduleDialog {...makeProps()} />)

    // Initially both notification and reminder switches are on – reminder hours visible
    expect(screen.getByLabelText(/reminder time/i)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /enable notifications/i })).toBeChecked()

    // Disable notifications
    await user.click(screen.getByLabelText(/enable notifications/i))

    expect(screen.queryByLabelText(/reminder time/i)).not.toBeInTheDocument()
  })

  it('hides reminder hours when auto reminders are disabled', async () => {
    const user = userEvent.setup()
    render(<CheckInScheduleDialog {...makeProps()} />)

    await user.click(screen.getByLabelText(/automatic reminders/i))

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

  it('initializes create-mode defaults when no existing schedule is provided', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-01T12:00:00.000Z'))

    try {
      render(<CheckInScheduleDialog {...makeProps()} />)

      expect((screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe('2026-02-01')
      expect((screen.getByLabelText(/end date/i) as HTMLInputElement).value).toBe('2026-05-02')
      expect(screen.getByRole('switch', { name: /enable notifications/i })).toBeChecked()
      expect(screen.getByRole('switch', { name: /automatic reminders/i })).toBeChecked()
      expect((screen.getByLabelText(/notes/i) as HTMLTextAreaElement).value).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('initializes edit-mode defaults from existing schedule and optional fallbacks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'))

    try {
      const existing = makeExistingSchedule({
        frequency: 'custom',
        customDays: undefined,
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: undefined,
        notificationEnabled: false,
        autoReminders: false,
        reminderHoursBefore: 12,
        notes: undefined,
      })

      render(<CheckInScheduleDialog {...makeProps({ existingSchedule: existing })} />)

      expect((screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe('2026-04-01')
      expect((screen.getByLabelText(/end date/i) as HTMLInputElement).value).toBe('2026-06-13')
      expect(screen.getByLabelText(/end date/i)).toBeDisabled()
      expect((screen.getByLabelText(/custom days/i) as HTMLInputElement).value).toBe('7')
      expect(screen.getByRole('switch', { name: /enable notifications/i })).not.toBeChecked()
      expect(screen.getByRole('switch', { name: /automatic reminders/i })).not.toBeChecked()
      expect((screen.getByLabelText(/notes/i) as HTMLTextAreaElement).value).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('submit button is disabled when no trainer is selected', () => {
    // In this test, makeProps provides a trainer option list but no default trainer selection,
    // so the create action should remain disabled until a selection is made.
    render(<CheckInScheduleDialog {...makeProps()} />)

    expect(screen.getByRole('button', { name: /create schedule/i })).toBeDisabled()
  })

  it('submits edited schedule when existingSchedule is provided', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const existing = makeExistingSchedule()

    render(
      <CheckInScheduleDialog
        {...makeProps()}
        existingSchedule={existing}
        onSubmit={onSubmit}
      />
    )

    await user.click(screen.getByRole('button', { name: /update schedule/i }))

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
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<CheckInScheduleDialog {...makeProps({ onSubmit })} />)

    await user.click(screen.getByRole('combobox', { name: /trainer/i }))
    await user.click(await screen.findByRole('option', { name: /alex trainer/i }))
    await user.click(screen.getByRole('button', { name: /create schedule/i }))

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
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CheckInScheduleDialog {...makeProps({ onClose })} />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows custom days input when frequency is set to custom', async () => {
    const user = userEvent.setup()
    render(<CheckInScheduleDialog {...makeProps()} />)

    // Select a trainer
    await user.click(screen.getByRole('combobox', { name: /trainer/i }))
    await user.click(await screen.findByRole('option', { name: /alex trainer/i }))

    // Initially custom days input should not be visible
    expect(screen.queryByLabelText(/custom days/i)).not.toBeInTheDocument()

    // Open frequency combobox and select custom
    await user.click(screen.getByRole('combobox', { name: /Check-In Frequency/i }))
    await user.click(await screen.findByRole('option', { name: /custom interval/i }))

    // Custom days input should now be visible
    expect(screen.getByLabelText(/custom days/i)).toBeInTheDocument()
  })

  it('shows validation errors for invalid existing schedule dates', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const existing = makeExistingSchedule({
      startDate: 'not-a-date',
      endDate: 'also-not-a-date',
    })

    render(
      <CheckInScheduleDialog
        {...makeProps({ onSubmit })}
        existingSchedule={existing}
      />
    )

    await user.click(screen.getByRole('button', { name: /update schedule/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/start date is invalid/i)).toBeInTheDocument()
    expect(screen.getByText(/end date is invalid/i)).toBeInTheDocument()
  })

  it('shows a validation error when custom days are below the minimum', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<CheckInScheduleDialog {...makeProps({ onSubmit })} />)

    await user.click(screen.getByRole('combobox', { name: /trainer/i }))
    await user.click(await screen.findByRole('option', { name: /alex trainer/i }))
    await user.click(screen.getByRole('combobox', { name: /check-in frequency/i }))
    await user.click(await screen.findByRole('option', { name: /custom interval/i }))

    await user.clear(screen.getByLabelText(/custom days/i))
    await user.type(screen.getByLabelText(/custom days/i), '0')
    await user.click(screen.getByRole('button', { name: /create schedule/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/custom days must be at least 1/i)).toBeInTheDocument()
  })

  it('requires an end date when the optional end date toggle is enabled', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<CheckInScheduleDialog {...makeProps({ onSubmit })} />)

    await user.click(screen.getByRole('combobox', { name: /trainer/i }))
    await user.click(await screen.findByRole('option', { name: /alex trainer/i }))
    await user.click(screen.getByTestId('end-date-switch'))
    await user.clear(screen.getByLabelText(/end date/i))
    await user.click(screen.getByRole('button', { name: /create schedule/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/end date is required/i)).toBeInTheDocument()
  })

  it('requires the end date to be after the start date', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<CheckInScheduleDialog {...makeProps({ onSubmit })} />)

    await user.click(screen.getByRole('combobox', { name: /trainer/i }))
    await user.click(await screen.findByRole('option', { name: /alex trainer/i }))
    await user.clear(screen.getByLabelText(/start date/i))
    await user.type(screen.getByLabelText(/start date/i), '2026-03-10')
    await user.click(screen.getByTestId('end-date-switch'))
    await user.clear(screen.getByLabelText(/end date/i))
    await user.type(screen.getByLabelText(/end date/i), '2026-03-05')
    await user.click(screen.getByRole('button', { name: /create schedule/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument()
  })

  it('updates reminder hours before submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<CheckInScheduleDialog {...makeProps({ onSubmit })} />)

    await user.click(screen.getByRole('combobox', { name: /trainer/i }))
    await user.click(await screen.findByRole('option', { name: /alex trainer/i }))
    await user.click(screen.getByRole('combobox', { name: /reminder time/i }))
    await user.click(await screen.findByRole('option', { name: /^4 hours before$/i }))
    await user.click(screen.getByRole('button', { name: /create schedule/i }))

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderHoursBefore: 4,
      })
    )
  })

  it('submits custom schedules with customDays, endDate, and trimmed notes', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<CheckInScheduleDialog {...makeProps({ onSubmit })} />)

    await user.click(screen.getByRole('combobox', { name: /trainer/i }))
    await user.click(await screen.findByRole('option', { name: /alex trainer/i }))

    await user.click(screen.getByRole('combobox', { name: /check-in frequency/i }))
    await user.click(await screen.findByRole('option', { name: /custom interval/i }))

    await user.clear(screen.getByLabelText(/custom days/i))
    await user.type(screen.getByLabelText(/custom days/i), '10')

    await user.clear(screen.getByLabelText(/start date/i))
    await user.type(screen.getByLabelText(/start date/i), '2026-03-01')

    const endDateSwitch = screen.getByTestId('end-date-switch')
    await user.click(endDateSwitch)
    await user.clear(screen.getByLabelText(/end date/i))
    await user.type(screen.getByLabelText(/end date/i), '2026-03-20')

    await user.type(screen.getByLabelText(/notes/i), '  Follow up with coach  ')
    await user.click(screen.getByRole('button', { name: /create schedule/i }))

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        trainerId: 't-1',
        frequency: 'custom',
        customDays: 10,
        startDate: expect.stringMatching(/^2026-03-01T00:00:00(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/),
        endDate: expect.stringMatching(/^2026-03-20T00:00:00(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/),
        notes: 'Follow up with coach',
      })
    )
  })

  it('uses existing endDate values in edit mode', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const existing = makeExistingSchedule({
      endDate: '2026-04-30T00:00:00.000Z',
    })

    render(
      <CheckInScheduleDialog
        {...makeProps({ onSubmit })}
        existingSchedule={existing}
      />
    )

    const endDateInput = screen.getByLabelText(/end date/i)
    expect(endDateInput).toBeEnabled()
    expect((endDateInput as HTMLInputElement).value).toBe('2026-04-30')

    await user.click(screen.getByRole('button', { name: /update schedule/i }))


    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        endDate: expect.stringMatching(/^2026-04-30T00:00:00(?:Z|[+-]\d{2}:\d{2})$/),
      })
    )
  })
})