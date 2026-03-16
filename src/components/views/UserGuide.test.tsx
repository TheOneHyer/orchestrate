import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UserGuide } from './UserGuide'

describe('UserGuide', () => {
  it('renders overview section by default', () => {
    render(<UserGuide />)

    expect(screen.getByText(/user guide/i)).toBeInTheDocument()
    expect(screen.getByText(/what is trainsync/i)).toBeInTheDocument()
    expect(screen.getByText(/a complete reference for every feature in trainsync/i)).toBeInTheDocument()
  })

  it('switches sections from the sidebar and shows updated content', () => {
    render(<UserGuide />)

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText(/notification types/i)).toBeInTheDocument()
    expect(screen.getByText(/priority levels/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /trainer availability/i }))
    expect(screen.getByText(/workload balance tab/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /coverage heatmap/i })).toBeInTheDocument()
  })

  it('shows role badges for the selected section', () => {
    render(<UserGuide />)

    fireEvent.click(screen.getByRole('button', { name: /certifications/i }))
    expect(screen.getByText(/^admin$/i)).toBeInTheDocument()
  })
})
