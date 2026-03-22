import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RecommendationDetailsDialog } from './RecommendationDetailsDialog'
import type { WorkloadRecommendation } from '@/lib/workload-balancer'
import type { User } from '@/lib/types'

const users: User[] = [
  {
    id: 't1',
    name: 'Taylor Trainer',
    email: 'taylor@example.com',
    role: 'trainer',
    department: 'Training',
    certifications: ['Safety'],
    hireDate: '2024-01-01',
  },
]

const recommendation: WorkloadRecommendation = {
  type: 'redistribute',
  priority: 'high',
  title: 'Redistribute workload',
  description: 'Move sessions to underutilized trainers.',
  affectedTrainers: ['t1'],
  potentialSavings: 4.5,
  actionable: true,
}

const advisoryRecommendation: WorkloadRecommendation = {
  ...recommendation,
  type: 'hire',
  title: 'Advisory recommendation',
  actionable: false,
  affectedTrainers: ['missing-trainer'],
}

describe('RecommendationDetailsDialog', () => {
  it('renders recommendation details when open', () => {
    render(
      <RecommendationDetailsDialog
        open
        onOpenChange={vi.fn()}
        recommendation={recommendation}
        users={users}
      />
    )

    expect(screen.getByRole('heading', { name: /redistribute workload/i })).toBeInTheDocument()
    expect(screen.getByText(/move sessions to underutilized trainers/i)).toBeInTheDocument()
    expect(screen.getByText(/4\.5 hours/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /taylor trainer/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /open schedule context/i })).not.toBeInTheDocument()
  })

  it('triggers actions for viewing trainer and opening schedule context', async () => {
    const user = userEvent.setup()
    const onViewTrainer = vi.fn()
    const onOpenScheduleContext = vi.fn()

    render(
      <RecommendationDetailsDialog
        open
        onOpenChange={vi.fn()}
        recommendation={recommendation}
        users={users}
        onViewTrainer={onViewTrainer}
        onOpenScheduleContext={onOpenScheduleContext}
      />
    )

    await user.click(screen.getByRole('button', { name: /taylor trainer/i }))
    expect(onViewTrainer).toHaveBeenCalledWith('t1')

    await user.click(screen.getByRole('button', { name: /open schedule context/i }))
    expect(onOpenScheduleContext).toHaveBeenCalledWith(recommendation)
  })

  it('renders nothing when recommendation is null and closes the dialog state', async () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <RecommendationDetailsDialog
        open
        onOpenChange={onOpenChange}
        recommendation={null}
        users={users}
      />
    )

    expect(container).toBeEmptyDOMElement()
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('hides schedule action button for non-actionable recommendations and shows missing trainer text', () => {
    render(
      <RecommendationDetailsDialog
        open
        onOpenChange={vi.fn()}
        recommendation={advisoryRecommendation}
        users={users}
      />
    )

    expect(screen.queryByRole('button', { name: /open schedule context/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no mapped trainer records/i)).toBeInTheDocument()
  })

  it('invokes onOpenChange with false when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <RecommendationDetailsDialog
        open
        onOpenChange={onOpenChange}
        recommendation={recommendation}
        users={users}
      />
    )

    const dialog = screen.getByRole('dialog')
    const closeButton = within(dialog).getByTestId('recommendation-dialog-close')
    await user.click(closeButton)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
