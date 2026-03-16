import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Schedule } from './Schedule'
import type { User, Course, Session } from '@/lib/types'

vi.mock('./AutoScheduler', () => ({
  AutoScheduler: ({ onSessionsCreated }: { onSessionsCreated: (sessions: Array<Partial<Session>>) => void }) => (
    <div>
      <div>AutoScheduler Mock</div>
      <button onClick={() => onSessionsCreated([{ id: 'auto-1', courseId: 'c-1', title: 'Auto Created Session' }])}>
        Create Auto Sessions
      </button>
    </div>
  ),
}))

vi.mock('./GuidedScheduler', () => ({
  GuidedScheduler: ({ onSessionsCreated }: { onSessionsCreated: (sessions: Array<Partial<Session>>) => void }) => (
    <div>
      <div>GuidedScheduler Mock</div>
      <button onClick={() => onSessionsCreated([{ id: 'guided-1', courseId: 'c-1', title: 'Guided Created Session' }])}>
        Create Guided Sessions
      </button>
    </div>
  ),
}))

vi.mock('@/components/EnrollStudentsDialog', () => ({
  EnrollStudentsDialog: ({ open, onEnrollStudents }: { open: boolean; onEnrollStudents: (studentIds: string[]) => void }) => (
    open ? <button data-testid="confirm-enroll" onClick={() => onEnrollStudents(['u-new'])}>Confirm Enroll</button> : null
  ),
}))

const baseTrainer: User = {
  id: 'u-trainer',
  name: 'Taylor Trainer',
  email: 'taylor@example.com',
  role: 'trainer',
  department: 'Training',
  certifications: ['Safety'],
  hireDate: '2023-01-01',
}

const baseEmployee: User = {
  id: 'u-employee',
  name: 'Evan Employee',
  email: 'evan@example.com',
  role: 'employee',
  department: 'Operations',
  certifications: [],
  hireDate: '2024-01-01',
}

const baseCourse: Course = {
  id: 'c-1',
  title: 'Safety Foundations',
  description: 'Core safety training',
  modules: ['Intro'],
  duration: 90,
  certifications: [],
  createdBy: 'u-trainer',
  createdAt: '2026-01-01T00:00:00.000Z',
  published: true,
  passScore: 80,
}

const baseSession: Session = {
  id: 's-1',
  courseId: 'c-1',
  trainerId: 'u-trainer',
  title: 'Morning Safety Session',
  startTime: '2026-03-20T09:00:00.000Z',
  endTime: '2026-03-20T10:30:00.000Z',
  location: 'Room A',
  capacity: 2,
  enrolledStudents: ['u-employee'],
  status: 'scheduled',
}

const eveningSession: Session = {
  ...baseSession,
  id: 's-2',
  status: 'completed',
  title: 'Evening Safety Session',
  startTime: '2026-03-20T17:00:00.000Z',
  endTime: '2026-03-20T18:30:00.000Z',
}

function renderSchedule(overrides: Partial<ComponentProps<typeof Schedule>> = {}) {
  const defaultProps: ComponentProps<typeof Schedule> = {
    sessions: [baseSession],
    courses: [baseCourse],
    users: [baseTrainer, baseEmployee],
    currentUser: baseTrainer,
    onCreateSession: vi.fn(),
    onUpdateSession: vi.fn(),
    onNavigate: vi.fn(),
  }

  return render(<Schedule {...defaultProps} {...overrides} />)
}

describe('Schedule', () => {
  it('opens the Auto-Schedule dialog', async () => {
    const user = userEvent.setup()

    renderSchedule()

    await user.click(screen.getByRole('button', { name: /auto-schedule/i }))
    expect(screen.getByText(/automatic trainer scheduler/i)).toBeInTheDocument()
    expect(screen.getByText(/autoscheduler mock/i)).toBeInTheDocument()
  })

  it('opens the Guided Schedule dialog', async () => {
    const user = userEvent.setup()

    renderSchedule()

    await user.click(screen.getByRole('button', { name: /guided schedule/i }))
    expect(screen.getByText(/guided trainer scheduler/i)).toBeInTheDocument()
    expect(screen.getByText(/guidedscheduler mock/i)).toBeInTheDocument()
  })

  it('triggers new session navigation', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()

    renderSchedule({ onNavigate })

    await user.click(screen.getByRole('button', { name: /new session/i }))
    expect(onNavigate).toHaveBeenCalledWith('schedule', { create: true })
  })

  it('renders tabs and session titles', () => {
    renderSchedule({ sessions: [baseSession, eveningSession] })

    expect(screen.getByRole('tab', { name: /calendar/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /list/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /board/i })).toBeInTheDocument()
    expect(screen.getByText(/morning safety session/i)).toBeInTheDocument()
    expect(screen.getByText(/evening safety session/i)).toBeInTheDocument()
  })

  it('supports calendar period switching controls', async () => {
    const user = userEvent.setup()

    renderSchedule()

    await user.click(screen.getByRole('button', { name: /^day$/i }))
    expect(screen.getByRole('button', { name: /previous day/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^week$/i }))
    expect(screen.getByRole('button', { name: /previous week/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^month$/i }))
    expect(screen.getByRole('button', { name: /previous month/i })).toBeInTheDocument()
  })

  it('calls onCreateSession when auto scheduler creates sessions', async () => {
    const onCreateSession = vi.fn()
    const user = userEvent.setup()

    renderSchedule({ onCreateSession })

    await user.click(screen.getByRole('button', { name: /auto-schedule/i }))
    await user.click(screen.getByRole('button', { name: /create auto sessions/i }))

    expect(onCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'auto-1',
        courseId: 'c-1',
        title: 'Auto Created Session',
      })
    )
  })

  it('calls onUpdateSession when enrolling students from session details', async () => {
    const onUpdateSession = vi.fn()
    // pointerEventsCheck is disabled here because the session details panel renders over an overlay
    // in the test environment, causing pointer-events checks to fail even though clicks reach the correct targets.
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    renderSchedule({ sessions: [baseSession], onUpdateSession })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /enroll students/i }))
    await user.click(screen.getByTestId('confirm-enroll'))

    expect(onUpdateSession).toHaveBeenCalledWith(
      's-1',
      expect.objectContaining({
        enrolledStudents: expect.arrayContaining(['u-employee', 'u-new']),
      })
    )
  })
})
