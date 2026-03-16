import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WellnessCheckInDialog } from './WellnessCheckInDialog'

let defaultProps!: {
  open: boolean
  onClose: ReturnType<typeof vi.fn>
  trainerId: string
  trainerName: string
  onSubmit: ReturnType<typeof vi.fn>
}

describe('WellnessCheckInDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    defaultProps = {
      open: true,
      onClose: vi.fn(),
      trainerId: 'trainer-1',
      trainerName: 'Alex Trainer',
      onSubmit: vi.fn(),
    }
  })

  it('renders trainer name in the dialog title', () => {
    render(<WellnessCheckInDialog {...defaultProps} />)

    expect(screen.getByText(/wellness check-in: alex trainer/i)).toBeInTheDocument()
  })

  it('renders all section labels', () => {
    render(<WellnessCheckInDialog {...defaultProps} />)

    expect(screen.getByText(/overall mood/i)).toBeInTheDocument()
    expect(screen.getByText(/stress level/i)).toBeInTheDocument()
    expect(screen.getByText(/energy level/i)).toBeInTheDocument()
  })

  it('renders stress level radio options', () => {
    render(<WellnessCheckInDialog {...defaultProps} />)

    expect(screen.getByLabelText(/low - manageable/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/moderate/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/high - concerning/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/critical - urgent/i)).toBeInTheDocument()
  })

  it('renders energy level radio options', () => {
    render(<WellnessCheckInDialog {...defaultProps} />)

    expect(screen.getByLabelText(/exhausted/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tired/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/neutral/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/energized/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/excellent/i)).toBeInTheDocument()
  })

  it('renders concern checkboxes', () => {
    render(<WellnessCheckInDialog {...defaultProps} />)

    expect(screen.getByLabelText(/too many sessions scheduled/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/work-life balance/i)).toBeInTheDocument()
  })

  it('includes current utilization in submit payload when provided', async () => {
    const onSubmit = vi.fn()
    render(
      <WellnessCheckInDialog
        {...defaultProps}
        onSubmit={onSubmit}
        currentUtilization={85}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /submit check-in/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ utilizationAtCheckIn: 85 })
    )
  })

  it('selects and deselects a concern checkbox', async () => {
    render(<WellnessCheckInDialog {...defaultProps} />)

    const checkbox = screen.getByRole('checkbox', { name: /too many sessions scheduled/i })
    expect(checkbox).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(checkbox)
    expect(checkbox).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(checkbox)
    expect(checkbox).toHaveAttribute('aria-checked', 'false')
  })

  it('submits with correct trainerId and default values', async () => {
    const onSubmit = vi.fn()
    render(<WellnessCheckInDialog {...defaultProps} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /submit check-in/i }))

    expect(onSubmit).toHaveBeenCalledOnce()
    const arg = onSubmit.mock.calls[0][0]
    expect(arg.trainerId).toBe('trainer-1')
    expect(arg.mood).toBe(3)
    expect(arg.stress).toBe('moderate')
    expect(arg.energy).toBe('neutral')
    expect(arg.followUpRequired).toBe(false)
  })

  it('includes selected concerns in submit payload', async () => {
    const onSubmit = vi.fn()
    render(<WellnessCheckInDialog {...defaultProps} onSubmit={onSubmit} />)

    // Click the "Work-life balance" checkbox
    await userEvent.click(screen.getByRole('checkbox', { name: /work-?life balance/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit check-in/i }))

    const arg = onSubmit.mock.calls[0][0]
    expect(arg.concerns).toContain('Work-life balance')
  })

  it('includes follow-up flag when checked', async () => {
    const onSubmit = vi.fn()
    render(<WellnessCheckInDialog {...defaultProps} onSubmit={onSubmit} />)

    const followUp = screen.getByRole('checkbox', { name: /i would like to discuss these concerns/i })
    await userEvent.click(followUp)
    await userEvent.click(screen.getByRole('button', { name: /submit check-in/i }))

    expect(onSubmit.mock.calls[0][0].followUpRequired).toBe(true)
  })

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn()
    render(<WellnessCheckInDialog {...defaultProps} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('submits with selected concerns and close callbacks called', async () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(<WellnessCheckInDialog {...defaultProps} onSubmit={onSubmit} onClose={onClose} />)

    await userEvent.click(screen.getByRole('checkbox', { name: /too many sessions scheduled/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /i would like to discuss these concerns/i }))
    await userEvent.click(screen.getByRole('radio', { name: /high - concerning/i }))
    await userEvent.click(screen.getByRole('radio', { name: /^tired$/i }))
    await userEvent.type(screen.getByLabelText(/additional comments/i), 'Need a break')
    await userEvent.click(screen.getByRole('button', { name: /submit check-in/i }))

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('resets form state after closing and reopening', async () => {
    const Wrapper = () => {
      const [open, setOpen] = React.useState(true)

      return (
        <>
          <button onClick={() => setOpen(true)}>Reopen Dialog</button>
          <WellnessCheckInDialog
            {...defaultProps}
            open={open}
            onClose={() => {
              defaultProps.onClose()
              setOpen(false)
            }}
          />
        </>
      )
    }

    render(<Wrapper />)

    await userEvent.click(screen.getByRole('checkbox', { name: /too many sessions scheduled/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /i would like to discuss these concerns/i }))
    await userEvent.click(screen.getByRole('radio', { name: /high - concerning/i }))
    await userEvent.click(screen.getByRole('radio', { name: /^tired$/i }))
    await userEvent.type(screen.getByLabelText(/additional comments/i), 'Need a break')
    await userEvent.click(screen.getByRole('button', { name: /submit check-in/i }))

    expect(defaultProps.onSubmit).toHaveBeenCalledOnce()
    expect(defaultProps.onClose).toHaveBeenCalledOnce()

    await userEvent.click(screen.getByRole('button', { name: /reopen dialog/i }))

    // Mood slider should be reset to 3
    // Note: The mood slider is the first slider on the page. The Radix UI Slider
    // component doesn't expose aria-label as the accessible name to role=slider.
    // Consider enhancing Slider API to support aria-labelledby for better accessibility.
    const moodSlider = screen.getAllByRole('slider')[0]
    expect(moodSlider).toHaveAttribute('aria-valuenow', '3')
    expect(await screen.findByRole('radio', { name: /moderate/i })).toBeChecked()
    expect(await screen.findByRole('radio', { name: /^neutral$/i })).toBeChecked()
    expect(await screen.findByLabelText(/additional comments/i)).toHaveValue('')
    expect(await screen.findByRole('checkbox', { name: /too many sessions scheduled/i })).toHaveAttribute('aria-checked', 'false')
    expect(await screen.findByRole('checkbox', { name: /i would like to discuss these concerns/i })).toHaveAttribute('aria-checked', 'false')
  })
})
