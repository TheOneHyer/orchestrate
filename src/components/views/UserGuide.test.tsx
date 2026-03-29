import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'

import { UserGuide } from './UserGuide'
import { getSectionOrFallback } from './user-guide-utils'

describe('getSectionOrFallback', () => {
  type SectionList = Parameters<typeof getSectionOrFallback>[0]
  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'notifications', label: 'Notifications' },
  ] as unknown as SectionList

  it('finds an existing section by key', () => {
    const result = getSectionOrFallback([...sections], 'notifications')

    expect(result).toEqual(expect.objectContaining({ id: 'notifications' }))
  })

  it('returns the first section when key is undefined', () => {
    const result = getSectionOrFallback([...sections])

    expect(result).toEqual(expect.objectContaining({ id: 'overview' }))
  })

  it('returns the first section when key does not match any section', () => {
    const result = getSectionOrFallback([...sections], 'missing')

    expect(result).toEqual(expect.objectContaining({ id: 'overview' }))
  })

  it('returns a safe fallback section for an empty section array', () => {
    const result = getSectionOrFallback([], 'overview')

    expect(result).toBeDefined()
    expect(result).toEqual(expect.objectContaining({ id: '', label: 'No Sections Available' }))
  })
})

describe('UserGuide', () => {
  it('renders overview section by default', () => {
    render(<UserGuide />)

    expect(screen.getByText(/user guide/i)).toBeInTheDocument()
    expect(screen.getByText(/what is orchestrate/i)).toBeInTheDocument()
    expect(screen.getByText(/a complete reference for every feature in orchestrate/i)).toBeInTheDocument()
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
    expect(await screen.findByTestId('role-badge-admin')).toBeInTheDocument()
  })

  it('lists all section navigation buttons in the sidebar', () => {
    render(<UserGuide />)

    const expectedLabels = [
      'Overview',
      'Dashboard',
      'Schedule',
      'Schedule Templates',
      'Courses',
      'People',
      'Analytics',
      'Trainer Availability',
      'Burnout Risk',
      'Wellness & Recovery',
      'Certifications',
      'Notifications',
      'Settings',
    ]

    for (const label of expectedLabels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('renders Dashboard section content with all subsections', async () => {
    const user = userEvent.setup()
    render(<UserGuide />)

    await user.click(screen.getByRole('button', { name: /^dashboard$/i }))

    expect(await screen.findByRole('heading', { name: /metric cards/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /upcoming sessions panel/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /recent notifications panel/i })).toBeInTheDocument()
  })

  it('renders Schedule section content including list items from GuideList', async () => {
    const user = userEvent.setup()
    render(<UserGuide />)

    await user.click(screen.getByRole('button', { name: /^schedule$/i }))

    expect(await screen.findByRole('heading', { name: /view modes/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /creating a session/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /session details panel/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /conflict detection/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /filtering/i })).toBeInTheDocument()
  })

  it('renders Courses section content', async () => {
    const user = userEvent.setup()
    render(<UserGuide />)

    await user.click(screen.getByRole('button', { name: /^courses$/i }))

    expect(await screen.findByRole('heading', { name: /course list/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /creating or editing a course/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /viewing course details/i })).toBeInTheDocument()
  })

  it('renders Schedule Templates section content', async () => {
    const user = userEvent.setup()
    render(<UserGuide />)

    await user.click(screen.getByRole('button', { name: /schedule templates/i }))

    expect(await screen.findByRole('heading', { name: /creating a template/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /applying a template/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /managing templates/i })).toBeInTheDocument()
  })

  it('renders Settings section content', async () => {
    const user = userEvent.setup()
    render(<UserGuide />)

    await user.click(screen.getByRole('button', { name: /settings/i }))

    expect(await screen.findByRole('heading', { name: /settings/i })).toBeInTheDocument()
  })

  it('shows role badges for multiple roles when a section is visible to all roles', async () => {
    const user = userEvent.setup()
    render(<UserGuide />)

    await user.click(screen.getByRole('button', { name: /^courses$/i }))

    expect(await screen.findByTestId('role-badge-admin')).toBeInTheDocument()
    expect(await screen.findByTestId('role-badge-trainer')).toBeInTheDocument()
    expect(await screen.findByTestId('role-badge-employee')).toBeInTheDocument()
  })

  it('falls back to the overview section when the initial section is invalid', () => {
    render(<UserGuide initialSection="missing-section" />)

    expect(screen.getByText(/what is orchestrate/i)).toBeInTheDocument()
  })
})
