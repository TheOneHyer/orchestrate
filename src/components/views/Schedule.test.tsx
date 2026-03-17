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

  it('opens edit dialog from session details and saves updates', async () => {
    const onUpdateSession = vi.fn()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    renderSchedule({ sessions: [baseSession], onUpdateSession })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    expect(screen.getByText(/edit session/i)).toBeInTheDocument()

    const titleInput = screen.getByLabelText(/^title/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Session Title')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(onUpdateSession).toHaveBeenCalledWith(
      's-1',
      expect.objectContaining({
        title: 'Updated Session Title',
      })
    )
  })

  it('displays sessions with various statuses', async () => {
    const user = userEvent.setup()
    const sessions: Session[] = [
      { ...baseSession, title: 'Scheduled Session', status: 'scheduled' },
      { ...baseSession, id: 's-2', title: 'Completed Session', status: 'completed', startTime: '2026-03-21T09:00:00.000Z', endTime: '2026-03-21T10:30:00.000Z' },
      { ...baseSession, id: 's-3', title: 'Cancelled Session', status: 'cancelled', startTime: '2026-03-22T09:00:00.000Z', endTime: '2026-03-22T10:30:00.000Z' },
    ]

    renderSchedule({ sessions })

    await user.click(screen.getByRole('tab', { name: /list/i }))

    expect(screen.getByText('Scheduled Session')).toBeInTheDocument()
    expect(screen.getByText('Completed Session')).toBeInTheDocument()
    expect(screen.getByText('Cancelled Session')).toBeInTheDocument()
    expect(screen.getByText(/^scheduled$/i)).toBeInTheDocument()
    expect(screen.getByText(/^completed$/i)).toBeInTheDocument()
    expect(screen.getByText(/^cancelled$/i)).toBeInTheDocument()
  })

  it('handles sessions with full capacity', async () => {
    const user = userEvent.setup()
    const fullCapacitySession: Session = {
      ...baseSession,
      id: 's-full',
      capacity: 2,
      enrolledStudents: ['u-employee', 'u-trainer'],
    }

    renderSchedule({ sessions: [fullCapacitySession] })

    expect(screen.getByText(/morning safety session/i)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))

    expect(screen.getByText(/2 \/ 2 enrolled/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enroll students/i })).toBeDisabled()
  })

  it('handles sessions with zero enrollment', async () => {
    const user = userEvent.setup()
    const emptySession: Session = {
      ...baseSession,
      id: 's-empty',
      enrolledStudents: [],
    }

    renderSchedule({ sessions: [emptySession] })

    expect(screen.getByText(/morning safety session/i)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))

    expect(screen.getByText(/0 \/ 2 enrolled/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enroll students/i })).toBeEnabled()
  })

  it('renders with no sessions', async () => {
    const user = userEvent.setup()
    renderSchedule({ sessions: [] })

    expect(screen.getByRole('tab', { name: /calendar/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^day$/i }))
    expect(screen.getByText(/no sessions scheduled for this day/i)).toBeInTheDocument()
  })

  it('handles multiple courses in schedule', async () => {
    const user = userEvent.setup()
    const courses: Course[] = [
      baseCourse,
      { ...baseCourse, id: 'c-2', title: 'Advanced Safety' },
      { ...baseCourse, id: 'c-3', title: 'Emergency Response' },
    ]
    const sessions: Session[] = [
      { ...baseSession, title: 'Safety Foundations Session', courseId: 'c-1' },
      { ...baseSession, id: 's-2', title: 'Advanced Safety Session', courseId: 'c-2', startTime: '2026-03-21T09:00:00.000Z', endTime: '2026-03-21T10:30:00.000Z' },
      { ...baseSession, id: 's-3', title: 'Emergency Response Session', courseId: 'c-3', startTime: '2026-03-22T09:00:00.000Z', endTime: '2026-03-22T10:30:00.000Z' },
    ]

    renderSchedule({ courses, sessions })

    await user.click(screen.getByRole('tab', { name: /list/i }))

    expect(screen.getByText('Safety Foundations Session')).toBeInTheDocument()
    expect(screen.getByText('Advanced Safety Session')).toBeInTheDocument()
    expect(screen.getByText('Emergency Response Session')).toBeInTheDocument()
  })

  it('handles sessions with special characters in titles', async () => {
    const user = userEvent.setup()
    const specialSession: Session = {
      ...baseSession,
      id: 's-special',
      title: "O'Brien's Safety & Health (Advanced)",
    }

    renderSchedule({ sessions: [specialSession] })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    expect(screen.getByText("O'Brien's Safety & Health (Advanced)")).toBeInTheDocument()
  })

  it('handles multiple sessions on the same day', async () => {
    const user = userEvent.setup()
    const sessions: Session[] = [
      baseSession,
      { ...baseSession, id: 's-2', startTime: '2026-03-20T12:00:00.000Z', endTime: '2026-03-20T13:00:00.000Z', title: 'Afternoon Session' },
      { ...baseSession, id: 's-3', startTime: '2026-03-20T15:00:00.000Z', endTime: '2026-03-20T16:00:00.000Z', title: 'Late Session' },
    ]

    renderSchedule({ sessions })

    await user.click(screen.getByRole('tab', { name: /list/i }))

    expect(screen.getByText(/morning safety session/i)).toBeInTheDocument()
    expect(screen.getByText('Afternoon Session')).toBeInTheDocument()
    expect(screen.getByText('Late Session')).toBeInTheDocument()
  })

  it('handles employee role viewing schedule', () => {
    renderSchedule({ currentUser: baseEmployee, sessions: [baseSession] })

    expect(screen.getByRole('tab', { name: /calendar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /auto-schedule/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new session/i })).not.toBeInTheDocument()
  })

  it('handles large number of sessions', async () => {
    const user = userEvent.setup()
    const sessions: Session[] = Array.from({ length: 15 }, (_, idx) => ({
      ...baseSession,
      id: `s-${idx}`,
      title: `Session ${idx + 1}`,
      startTime: `2026-03-${String(20 + Math.floor(idx / 5)).padStart(2, '0')}T${String(9 + (idx % 5)).padStart(2, '0')}:00:00.000Z`,
      endTime: `2026-03-${String(20 + Math.floor(idx / 5)).padStart(2, '0')}T${String(10 + (idx % 5)).padStart(2, '0')}:00:00.000Z`,
    }))

    renderSchedule({ sessions })

    await user.click(screen.getByRole('tab', { name: /list/i }))

    expect(screen.getByText('Session 1')).toBeInTheDocument()
    expect(screen.getByText('Session 8')).toBeInTheDocument()
    expect(screen.getByText('Session 15')).toBeInTheDocument()
  })

  it('handles sessions with various location names', async () => {
    const user = userEvent.setup()
    const sessions: Session[] = [
      { ...baseSession, id: 's-1', location: 'Building A, Room 101' },
      { ...baseSession, id: 's-2', location: 'Virtual Meeting', startTime: '2026-03-21T09:00:00.000Z', endTime: '2026-03-21T10:30:00.000Z' },
      { ...baseSession, id: 's-3', location: 'Outdoor Training Area', startTime: '2026-03-22T09:00:00.000Z', endTime: '2026-03-22T10:30:00.000Z' },
    ]

    renderSchedule({ sessions })

    await user.click(screen.getByRole('tab', { name: /list/i }))

    expect(screen.getByText('Building A, Room 101')).toBeInTheDocument()
    expect(screen.getByText('Virtual Meeting')).toBeInTheDocument()
    expect(screen.getByText('Outdoor Training Area')).toBeInTheDocument()
  })
})
