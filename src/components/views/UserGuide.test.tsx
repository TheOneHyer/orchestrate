import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UserGuide } from './UserGuide'

describe('UserGuide', () => {
  it('renders overview section by default', () => {
    render(<UserGuide />)

    expect(screen.getByText(/user guide/i)).toBeInTheDocument()
    expect(screen.getByText(/what is trainsync/i)).toBeInTheDocument()
    expect(screen.getByText(/a complete reference for every feature in trainsync/i)).toBeInTheDocument()
  })

  it('switches sections from the sidebar and shows updated content', async () => {
    const user = userEvent.setup()
    render(<UserGuide />)

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    expect(await screen.findByText(/notification types/i)).toBeInTheDocument()
    expect(await screen.findByText(/priority levels/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /trainer availability/i }))
    expect(await screen.findByText(/workload balance tab/i)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /coverage heatmap/i })).toBeInTheDocument()
  })

  it('shows role badges for the selected section', async () => {
    const user = userEvent.setup()
    render(<UserGuide />)

    await user.click(screen.getByRole('button', { name: /certifications/i }))
    expect(screen.getByText(/^admin$/i)).toBeInTheDocument()
  })
})
