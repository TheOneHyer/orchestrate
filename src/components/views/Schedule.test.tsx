import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Schedule } from './Schedule'
import type { User, Course, Session } from '@/lib/types'
import * as conflictDetection from '@/lib/conflict-detection'

const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}))

vi.mock('./AutoScheduler', () => ({
  AutoScheduler: ({
    onSessionsCreated,
    onClose,
  }: {
    onSessionsCreated: (sessions: Array<Partial<Session>>) => void
    onClose?: () => void
  }) => (
    <div>
      <div>AutoScheduler Mock</div>
      <button onClick={() => onSessionsCreated([{ id: 'auto-1', courseId: 'c-1', title: 'Auto Created Session' }])}>
        Create Auto Sessions
      </button>
      <button onClick={() => onClose?.()}>Close Auto Scheduler</button>
    </div>
  ),
}))

vi.mock('./GuidedScheduler', () => ({
  GuidedScheduler: ({
    onSessionsCreated,
    onClose,
  }: {
    onSessionsCreated: (sessions: Array<Partial<Session>>) => void
    onClose?: () => void
  }) => (
    <div>
      <div>GuidedScheduler Mock</div>
      <button onClick={() => onSessionsCreated([{ id: 'guided-1', courseId: 'c-1', title: 'Guided Created Session' }])}>
        Create Guided Sessions
      </button>
      <button onClick={() => onClose?.()}>Close Guided Scheduler</button>
    </div>
  ),
}))

vi.mock('@/components/EnrollStudentsDialog', () => ({
  EnrollStudentsDialog: ({ open, onEnrollStudents }: { open: boolean; onEnrollStudents: (studentIds: string[]) => void }) => (
    open ? (
      <>
        <button data-testid="confirm-enroll" onClick={() => onEnrollStudents(['u-new'])}>Confirm Enroll</button>
        <button data-testid="confirm-enroll-multi" onClick={() => onEnrollStudents(['u-new', 'u-second'])}>Confirm Enroll Multi</button>
      </>
    ) : null
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
  beforeEach(() => {
    vi.clearAllMocks()
    // Pin the clock to a fixed date so tests are not sensitive to the day they run.
    // baseSession is on 2026-03-20; anchoring to that date keeps the session visible
    // in day, week (March 15–21), and month (March 2026) calendar views.
    vi.useFakeTimers({ now: new Date('2026-03-20T12:00:00.000Z'), toFake: ['Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const setDateTimeInput = (label: RegExp, value: string) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }

  const createDragDataTransfer = () => ({
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: vi.fn(),
    getData: vi.fn(),
  }) as unknown as DataTransfer

  const getDropZoneForSessionTitle = (title: RegExp | string) => {
    const sessionCard = screen.getByText(title)
    const calendarBody = sessionCard.closest('[data-calendar-cell-body]')
    if (!(calendarBody instanceof HTMLElement) || !(calendarBody.parentElement instanceof HTMLElement)) {
      throw new Error('Could not locate calendar drop zone for session card')
    }

    return {
      sessionCard,
      dropZone: calendarBody.parentElement,
    }
  }

  it('opens the Auto-Schedule dialog', async () => {
    const user = userEvent.setup()

    renderSchedule()

    await user.click(screen.getByRole('button', { name: /auto-schedule/i }))
    expect(screen.getByText(/automatic trainer scheduler/i)).toBeInTheDocument()
    expect(screen.getByText(/autoscheduler mock/i)).toBeInTheDocument()
  })

  it('opens target session details from navigation payload sessionId', async () => {
    renderSchedule({ navigationPayload: { sessionId: 's-1' } })

    expect(await screen.findByRole('button', { name: /enroll students/i })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /morning safety session/i })).toBeInTheDocument()
  })

  it('does not open details when navigation payload sessionId is not found', () => {
    renderSchedule({ navigationPayload: { sessionId: 'missing-session' } })

    expect(screen.queryByRole('button', { name: /enroll students/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /morning safety session/i })).toBeNull()
  })

  it('opens the guided scheduler when navigation payload contains a create intent', async () => {
    renderSchedule({ navigationPayload: { create: true } })

    expect(await screen.findByText(/guidedscheduler mock/i)).toBeInTheDocument()
  })

  it('does not open guided scheduler when create payload is false', () => {
    renderSchedule({ navigationPayload: { create: false } })

    expect(screen.queryByText(/guidedscheduler mock/i)).not.toBeInTheDocument()
  })

  it('does not reopen details when sessions change for the same payload', async () => {
    const user = userEvent.setup()
    const payload = { sessionId: 's-1' }
    const { rerender } = renderSchedule({ navigationPayload: payload })

    expect(screen.getByRole('button', { name: /enroll students/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /enroll students/i })).toBeNull()
    })

    rerender(
      <Schedule
        sessions={[baseSession, eveningSession]}
        courses={[baseCourse]}
        users={[baseTrainer, baseEmployee]}
        currentUser={baseTrainer}
        onCreateSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onNavigate={vi.fn()}
        navigationPayload={payload}
      />
    )

    expect(screen.queryByRole('button', { name: /enroll students/i })).toBeNull()
  })

  it('reopens session details after the navigation payload is cleared and sent again', async () => {
    const user = userEvent.setup()
    const payload = { sessionId: 's-1' }
    const { rerender } = renderSchedule({ navigationPayload: payload })

    expect(screen.getByRole('button', { name: /enroll students/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /enroll students/i })).toBeNull()
    })

    rerender(
      <Schedule
        sessions={[baseSession]}
        courses={[baseCourse]}
        users={[baseTrainer, baseEmployee]}
        currentUser={baseTrainer}
        onCreateSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onNavigate={vi.fn()}
        navigationPayload={undefined}
      />
    )

    rerender(
      <Schedule
        sessions={[baseSession]}
        courses={[baseCourse]}
        users={[baseTrainer, baseEmployee]}
        currentUser={baseTrainer}
        onCreateSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onNavigate={vi.fn()}
        navigationPayload={{ sessionId: 's-1' }}
      />
    )

    expect(screen.getByRole('button', { name: /enroll students/i })).toBeInTheDocument()
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

  it('navigates day, week, and month periods including reset to today', async () => {
    const user = userEvent.setup()

    renderSchedule()

    await user.click(screen.getByRole('button', { name: /^day$/i }))
    const dailyHeading = () => screen.getByRole('heading', { level: 3 }).textContent
    const initialDayHeading = dailyHeading()

    await user.click(screen.getByRole('button', { name: /next day/i }))
    expect(dailyHeading()).not.toEqual(initialDayHeading)

    await user.click(screen.getByRole('button', { name: /today/i }))
    expect(dailyHeading()).toEqual(initialDayHeading)

    await user.click(screen.getByRole('button', { name: /^week$/i }))
    const weekHeadingBefore = screen.getByRole('heading', { level: 3 }).textContent
    await user.click(screen.getByRole('button', { name: /next week/i }))
    expect(screen.getByRole('heading', { level: 3 }).textContent).not.toEqual(weekHeadingBefore)

    await user.click(screen.getByRole('button', { name: /^month$/i }))
    const monthHeadingBefore = screen.getByRole('heading', { level: 3 }).textContent
    await user.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getByRole('heading', { level: 3 }).textContent).not.toEqual(monthHeadingBefore)
  })

  it('supports previous navigation in day, week, and month periods', async () => {
    const user = userEvent.setup()

    renderSchedule()

    await user.click(screen.getByRole('button', { name: /^day$/i }))
    const dayHeadingStart = screen.getByRole('heading', { level: 3 }).textContent
    await user.click(screen.getByRole('button', { name: /next day/i }))
    await user.click(screen.getByRole('button', { name: /previous day/i }))
    expect(screen.getByRole('heading', { level: 3 }).textContent).toEqual(dayHeadingStart)

    await user.click(screen.getByRole('button', { name: /^week$/i }))
    const weekHeadingStart = screen.getByRole('heading', { level: 3 }).textContent
    await user.click(screen.getByRole('button', { name: /next week/i }))
    await user.click(screen.getByRole('button', { name: /previous week/i }))
    expect(screen.getByRole('heading', { level: 3 }).textContent).toEqual(weekHeadingStart)

    await user.click(screen.getByRole('button', { name: /^month$/i }))
    const monthHeadingStart = screen.getByRole('heading', { level: 3 }).textContent
    await user.click(screen.getByRole('button', { name: /next month/i }))
    await user.click(screen.getByRole('button', { name: /previous month/i }))
    expect(screen.getByRole('heading', { level: 3 }).textContent).toEqual(monthHeadingStart)
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

  it('calls onUpdateSession and shows plural success copy when multiple students enroll', async () => {
    const onUpdateSession = vi.fn()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    renderSchedule({ sessions: [baseSession], onUpdateSession })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /enroll students/i }))
    await user.click(screen.getByTestId('confirm-enroll-multi'))

    expect(onUpdateSession).toHaveBeenCalledWith(
      's-1',
      expect.objectContaining({
        enrolledStudents: expect.arrayContaining(['u-employee', 'u-new', 'u-second']),
      })
    )
    expect(toastSuccess).toHaveBeenCalledWith('Students enrolled', expect.objectContaining({
      description: '2 students enrolled successfully',
    }))
  })

  it('calls onCreateSession when guided scheduler creates sessions', async () => {
    const onCreateSession = vi.fn()
    const user = userEvent.setup()

    renderSchedule({ onCreateSession })

    await user.click(screen.getByRole('button', { name: /guided schedule/i }))
    await user.click(screen.getByRole('button', { name: /create guided sessions/i }))

    expect(onCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'guided-1',
        courseId: 'c-1',
        title: 'Guided Created Session',
      })
    )
  })

  it('opens guided scheduler from an empty day cell for schedule managers', async () => {
    renderSchedule({ sessions: [] })

    fireEvent.click(screen.getByRole('button', { name: /^day$/i }))
    const dropZone = document.querySelector('[data-day-dropzone]')
    if (!(dropZone instanceof HTMLElement)) {
      throw new Error('Unable to find day drop-zone')
    }

    fireEvent.click(dropZone)

    expect(screen.getByText(/guided trainer scheduler/i)).toBeInTheDocument()
    expect(screen.getByText(/guidedscheduler mock/i)).toBeInTheDocument()
  })

  it('does not open guided scheduler from day cell for employees', async () => {
    renderSchedule({ currentUser: baseEmployee, sessions: [] })

    fireEvent.click(screen.getByRole('button', { name: /^day$/i }))
    const dropZone = document.querySelector('[data-day-dropzone]')
    if (!(dropZone instanceof HTMLElement)) {
      throw new Error('Unable to find day drop-zone')
    }

    fireEvent.click(dropZone)

    expect(screen.queryByText(/guided trainer scheduler/i)).not.toBeInTheDocument()
  })

  it('opens edit dialog from session details and saves updates', async () => {
    const onUpdateSession = vi.fn()
    // pointerEventsCheck is disabled to avoid test-environment pointer-events false negatives
    // when dialog/overlay layers are present while preserving real interaction behavior.
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

  it('navigates to course details from the session sheet', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    renderSchedule({ sessions: [baseSession], onNavigate })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /view course/i }))

    expect(onNavigate).toHaveBeenCalledWith('courses', { courseId: 'c-1' })
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

  it('shows only full-width view course action in sheet for employees', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    renderSchedule({ currentUser: baseEmployee, sessions: [baseSession], onNavigate })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))

    const viewCourseButton = screen.getByRole('button', { name: /view course/i })
    expect(viewCourseButton).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enroll students/i })).not.toBeInTheDocument()
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

  it('shows overflow count in monthly calendar cells when more than two sessions exist', () => {
    const crowdedDate = '2026-03-20'
    const sessions: Session[] = [
      { ...baseSession, id: 's-1', title: 'Session A', startTime: `${crowdedDate}T09:00:00.000Z`, endTime: `${crowdedDate}T10:00:00.000Z` },
      { ...baseSession, id: 's-2', title: 'Session B', startTime: `${crowdedDate}T11:00:00.000Z`, endTime: `${crowdedDate}T12:00:00.000Z` },
      { ...baseSession, id: 's-3', title: 'Session C', startTime: `${crowdedDate}T13:00:00.000Z`, endTime: `${crowdedDate}T14:00:00.000Z` },
    ]

    renderSchedule({ sessions })

    expect(screen.getByText('+1 more')).toBeInTheDocument()
  })

  it('groups in-progress sessions in board view', async () => {
    const user = userEvent.setup()
    const sessions: Session[] = [
      { ...baseSession, id: 's-in-progress', title: 'Live Session', status: 'in-progress' },
      { ...baseSession, id: 's-complete', title: 'Done Session', status: 'completed', startTime: '2026-03-21T09:00:00.000Z', endTime: '2026-03-21T10:00:00.000Z' },
    ]

    renderSchedule({ sessions })

    await user.click(screen.getByRole('tab', { name: /board/i }))

    expect(screen.getByRole('heading', { name: /in progress/i })).toBeInTheDocument()
    expect(screen.getByText('Live Session')).toBeInTheDocument()
    expect(screen.getByText('Done Session')).toBeInTheDocument()
  })

  it('shows conflict banner in daily view while dragging over a conflicting day', async () => {
    const user = userEvent.setup()
    const conflictSpy = vi.spyOn(conflictDetection, 'checkSessionConflicts').mockReturnValue({
      hasConflicts: true,
      conflicts: [
        {
          type: 'trainer',
          message: 'Drag conflict in daily view',
          severity: 'error',
          conflictingSessionId: 's-2',
          conflictingSessionTitle: 'Conflict Session',
        },
      ],
    })

    try {
      const today = new Date()
      const startTime = new Date(today)
      startTime.setHours(9, 0, 0, 0)
      const endTime = new Date(today)
      endTime.setHours(10, 30, 0, 0)

      const todaySession: Session = {
        ...baseSession,
        id: 's-today',
        title: 'Today Drag Session',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }

      renderSchedule({ sessions: [todaySession] })

      await user.click(screen.getByRole('button', { name: /^day$/i }))

      const { sessionCard, dropZone } = getDropZoneForSessionTitle(/today drag session/i)
      const dataTransfer = createDragDataTransfer()

      fireEvent.dragStart(sessionCard, { dataTransfer })
      fireEvent.dragOver(dropZone, { dataTransfer })

      expect(screen.getByText(/scheduling conflicts/i)).toBeInTheDocument()
      expect(screen.getByText(/drag conflict in daily view/i)).toBeInTheDocument()

      fireEvent.dragLeave(dropZone)
      expect(screen.queryByText(/scheduling conflicts/i)).not.toBeInTheDocument()
    } finally {
      conflictSpy.mockRestore()
    }
  })

  it('shows drag-over accent styling in daily view when conflicts are absent', async () => {
    const user = userEvent.setup()
    const conflictSpy = vi.spyOn(conflictDetection, 'checkSessionConflicts').mockReturnValue({
      hasConflicts: false,
      conflicts: [],
    })

    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const startTime = new Date(tomorrow)
      startTime.setHours(13, 0, 0, 0)
      const endTime = new Date(tomorrow)
      endTime.setHours(14, 0, 0, 0)

      const todaySession: Session = {
        ...baseSession,
        id: 's-daily-accent',
        title: 'Daily Accent Session',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }

      renderSchedule({ sessions: [todaySession] })

      await user.click(screen.getByRole('button', { name: /^day$/i }))
      await user.click(screen.getByRole('button', { name: /next day/i }))

      const { sessionCard, dropZone } = getDropZoneForSessionTitle(/daily accent session/i)
      const dataTransfer = createDragDataTransfer()

      fireEvent.dragStart(sessionCard, { dataTransfer })
      fireEvent.dragOver(dropZone, { dataTransfer })

      await waitFor(() => {
        expect(dropZone.className).toContain('border-accent')
      })
    } finally {
      conflictSpy.mockRestore()
    }
  })

  it('shows destructive drag-over styling in daily view conflicts on non-today dates', async () => {
    const user = userEvent.setup()
    const conflictSpy = vi.spyOn(conflictDetection, 'checkSessionConflicts').mockReturnValue({
      hasConflicts: true,
      conflicts: [
        {
          type: 'trainer',
          message: 'Non-today daily conflict',
          severity: 'error',
          conflictingSessionId: 's-2',
          conflictingSessionTitle: 'Conflict Session',
        },
      ],
    })

    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const startTime = new Date(tomorrow)
      startTime.setHours(10, 0, 0, 0)
      const endTime = new Date(tomorrow)
      endTime.setHours(11, 0, 0, 0)

      const tomorrowSession: Session = {
        ...baseSession,
        id: 's-daily-conflict-non-today',
        title: 'Daily Conflict Non Today',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }

      renderSchedule({ sessions: [tomorrowSession] })

      await user.click(screen.getByRole('button', { name: /^day$/i }))
      await user.click(screen.getByRole('button', { name: /next day/i }))

      const { sessionCard, dropZone } = getDropZoneForSessionTitle(/daily conflict non today/i)
      const dataTransfer = createDragDataTransfer()

      fireEvent.dragStart(sessionCard, { dataTransfer })
      fireEvent.dragOver(dropZone, { dataTransfer })

      expect(screen.getByText(/scheduling conflicts/i)).toBeInTheDocument()
      expect(dropZone.className).toContain('border-destructive')
    } finally {
      conflictSpy.mockRestore()
    }
  })

  it('shows conflict indicator in weekly view while dragging over a conflicting day', async () => {
    const user = userEvent.setup()
    const conflictSpy = vi.spyOn(conflictDetection, 'checkSessionConflicts').mockReturnValue({
      hasConflicts: true,
      conflicts: [
        {
          type: 'room',
          message: 'Weekly conflict',
          severity: 'error',
          conflictingSessionId: 's-2',
          conflictingSessionTitle: 'Conflict Session',
        },
      ],
    })

    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const startTime = new Date(tomorrow)
      startTime.setHours(11, 0, 0, 0)
      const endTime = new Date(tomorrow)
      endTime.setHours(12, 0, 0, 0)

      const weekSession: Session = {
        ...baseSession,
        id: 's-week',
        title: 'Weekly Drag Session',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }

      renderSchedule({ sessions: [weekSession] })

      await user.click(screen.getByRole('button', { name: /^week$/i }))

      const { sessionCard, dropZone } = getDropZoneForSessionTitle(/weekly drag session/i)
      const dataTransfer = createDragDataTransfer()

      fireEvent.dragStart(sessionCard, { dataTransfer })
      fireEvent.dragOver(dropZone, { dataTransfer })

      expect(screen.getByText(/conflict/i)).toBeInTheDocument()
      expect(dropZone.className).toContain('border-destructive')
    } finally {
      conflictSpy.mockRestore()
    }
  })

  it('does not run conflict detection during drag-over when no session is being dragged', async () => {
    const user = userEvent.setup()
    const conflictSpy = vi.spyOn(conflictDetection, 'checkSessionConflicts')

    renderSchedule({ sessions: [baseSession] })

    await user.click(screen.getByRole('button', { name: /^week$/i }))

    const { dropZone } = getDropZoneForSessionTitle(/morning safety session/i)
    fireEvent.dragOver(dropZone, { dataTransfer: createDragDataTransfer() })

    expect(conflictSpy).not.toHaveBeenCalled()

    conflictSpy.mockRestore()
  })

  it('shows drag-over accent styling in weekly and monthly views when conflicts are absent', async () => {
    const user = userEvent.setup()
    const conflictSpy = vi.spyOn(conflictDetection, 'checkSessionConflicts').mockReturnValue({
      hasConflicts: false,
      conflicts: [],
    })

    try {
      renderSchedule({ sessions: [baseSession] })

      await user.click(screen.getByRole('button', { name: /^week$/i }))
      let zoneInfo = getDropZoneForSessionTitle(/morning safety session/i)
      let dataTransfer = createDragDataTransfer()

      fireEvent.dragStart(zoneInfo.sessionCard, { dataTransfer })
      fireEvent.dragOver(zoneInfo.dropZone, { dataTransfer })

      await waitFor(() => {
        expect(zoneInfo.dropZone.className).toContain('border-accent')
      })
      fireEvent.dragEnd(zoneInfo.sessionCard, { dataTransfer })

      await user.click(screen.getByRole('button', { name: /^month$/i }))
      zoneInfo = getDropZoneForSessionTitle(/morning safety session/i)
      dataTransfer = createDragDataTransfer()

      fireEvent.dragStart(zoneInfo.sessionCard, { dataTransfer })
      fireEvent.dragOver(zoneInfo.dropZone, { dataTransfer })

      await waitFor(() => {
        expect(zoneInfo.dropZone.className).toContain('border-accent')
      })
    } finally {
      conflictSpy.mockRestore()
    }
  })

  it('shows conflict icon in monthly view while dragging over a conflicting day', () => {
    const conflictSpy = vi.spyOn(conflictDetection, 'checkSessionConflicts').mockReturnValue({
      hasConflicts: true,
      conflicts: [
        {
          type: 'student',
          message: 'Monthly conflict',
          severity: 'error',
          conflictingSessionId: 's-2',
          conflictingSessionTitle: 'Conflict Session',
        },
      ],
    })

    try {
      renderSchedule({ sessions: [baseSession] })

      const { sessionCard, dropZone } = getDropZoneForSessionTitle(/morning safety session/i)
      const dataTransfer = createDragDataTransfer()

      fireEvent.dragStart(sessionCard, { dataTransfer })
      fireEvent.dragOver(dropZone, { dataTransfer })

      expect(screen.getAllByText('⚠️').length).toBeGreaterThan(0)
      expect(dropZone.className).toContain('bg-destructive/10')
    } finally {
      conflictSpy.mockRestore()
    }
  })

  it('prevents drop when conflict detection returns errors', () => {
    const onUpdateSession = vi.fn()
    const conflictSpy = vi.spyOn(conflictDetection, 'checkSessionConflicts').mockReturnValue({
      hasConflicts: true,
      conflicts: [
        {
          type: 'trainer',
          message: 'Drop conflict',
          severity: 'error',
          conflictingSessionId: 's-2',
          conflictingSessionTitle: 'Conflict Session',
        },
      ],
    })

    try {
      renderSchedule({ sessions: [baseSession], onUpdateSession })

      const { sessionCard, dropZone } = getDropZoneForSessionTitle(/morning safety session/i)
      const dataTransfer = createDragDataTransfer()

      fireEvent.dragStart(sessionCard, { dataTransfer })
      fireEvent.drop(dropZone, { dataTransfer })

      expect(toastError).toHaveBeenCalledWith('Cannot move session', expect.any(Object))
      expect(onUpdateSession).not.toHaveBeenCalled()
    } finally {
      conflictSpy.mockRestore()
    }
  })

  it('ignores drop events when no dragged session is active', () => {
    const onUpdateSession = vi.fn()

    renderSchedule({ sessions: [baseSession], onUpdateSession })

    const { dropZone } = getDropZoneForSessionTitle(/morning safety session/i)
    fireEvent.drop(dropZone, { dataTransfer: createDragDataTransfer() })

    expect(onUpdateSession).not.toHaveBeenCalled()
  })

  it('allows drop when conflict detection returns no conflicts', () => {
    const onUpdateSession = vi.fn()
    const conflictSpy = vi.spyOn(conflictDetection, 'checkSessionConflicts').mockReturnValue({
      hasConflicts: false,
      conflicts: [],
    })

    try {
      renderSchedule({ sessions: [baseSession], onUpdateSession })

      const { sessionCard, dropZone } = getDropZoneForSessionTitle(/morning safety session/i)
      const dataTransfer = createDragDataTransfer()

      fireEvent.dragStart(sessionCard, { dataTransfer })
      fireEvent.drop(dropZone, { dataTransfer })

      expect(onUpdateSession).toHaveBeenCalledWith(
        's-1',
        expect.objectContaining({
          startTime: expect.any(String),
          endTime: expect.any(String),
        })
      )
      expect(toastSuccess).toHaveBeenCalledWith('Session rescheduled', expect.any(Object))
    } finally {
      conflictSpy.mockRestore()
    }
  })

  it('allows drop when only warning conflicts are returned', () => {
    const onUpdateSession = vi.fn()
    const conflictSpy = vi.spyOn(conflictDetection, 'checkSessionConflicts').mockReturnValue({
      hasConflicts: true,
      conflicts: [
        {
          type: 'room',
          message: 'Warning-only conflict',
          severity: 'warning',
          conflictingSessionId: 's-2',
          conflictingSessionTitle: 'Conflict Session',
        },
      ],
    })

    try {
      renderSchedule({ sessions: [baseSession], onUpdateSession })

      const { sessionCard, dropZone } = getDropZoneForSessionTitle(/morning safety session/i)
      const dataTransfer = createDragDataTransfer()

      fireEvent.dragStart(sessionCard, { dataTransfer })
      fireEvent.drop(dropZone, { dataTransfer })

      expect(onUpdateSession).toHaveBeenCalledWith(
        's-1',
        expect.objectContaining({
          startTime: expect.any(String),
          endTime: expect.any(String),
        })
      )
      expect(toastSuccess).toHaveBeenCalledWith('Session rescheduled', expect.any(Object))
    } finally {
      conflictSpy.mockRestore()
    }
  })

  it('updates status through edit dialog and saves selected value', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onUpdateSession = vi.fn()

    renderSchedule({ sessions: [baseSession], onUpdateSession })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    const editDialog = screen.getByRole('dialog', { name: /edit session/i })
    await user.click(within(editDialog).getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: /^cancelled$/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(onUpdateSession).toHaveBeenCalledWith(
      's-1',
      expect.objectContaining({ status: 'cancelled' })
    )
  })

  it('renders completed status in daily cards', async () => {
    const user = userEvent.setup()
    const today = new Date()
    const startTime = new Date(today)
    startTime.setHours(9, 0, 0, 0)
    const endTime = new Date(today)
    endTime.setHours(10, 0, 0, 0)

    const completedToday: Session = {
      ...baseSession,
      id: 's-completed-today',
      title: 'Completed Daily Session',
      status: 'completed',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    }

    renderSchedule({ sessions: [completedToday] })

    await user.click(screen.getByRole('button', { name: /^day$/i }))

    expect(screen.getByText(/completed daily session/i)).toBeInTheDocument()
    expect(screen.getByText(/^completed$/i)).toBeInTheDocument()
  })

  it('renders outline badge status in daily cards for non-scheduled and non-completed sessions', async () => {
    const user = userEvent.setup()
    const today = new Date()
    const startTime = new Date(today)
    startTime.setHours(11, 0, 0, 0)
    const endTime = new Date(today)
    endTime.setHours(12, 0, 0, 0)

    const cancelledToday: Session = {
      ...baseSession,
      id: 's-cancelled-today',
      title: 'Cancelled Daily Session',
      status: 'cancelled',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    }

    renderSchedule({ sessions: [cancelledToday] })

    await user.click(screen.getByRole('button', { name: /^day$/i }))

    expect(screen.getByText(/cancelled daily session/i)).toBeInTheDocument()
    expect(screen.getByText(/^cancelled$/i)).toBeInTheDocument()
  })

  it('closes scheduler dialogs when child onClose callbacks are triggered', async () => {
    const user = userEvent.setup()

    renderSchedule()

    await user.click(screen.getByRole('button', { name: /auto-schedule/i }))
    expect(screen.getByText(/autoscheduler mock/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /close auto scheduler/i }))
    expect(screen.queryByText(/autoscheduler mock/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /guided schedule/i }))
    expect(screen.getByText(/guidedscheduler mock/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /close guided scheduler/i }))
    expect(screen.queryByText(/guidedscheduler mock/i)).not.toBeInTheDocument()
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

  it('shows validation error when title is empty during edit', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onUpdateSession = vi.fn()

    renderSchedule({ sessions: [baseSession], onUpdateSession })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    await user.clear(screen.getByLabelText(/^title/i))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(toastError).toHaveBeenCalledWith('Title is required', expect.any(Object))
    expect(onUpdateSession).not.toHaveBeenCalled()
  })

  it('shows validation error when location is empty during edit', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onUpdateSession = vi.fn()

    renderSchedule({ sessions: [baseSession], onUpdateSession })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    await user.clear(screen.getByLabelText(/^location/i))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(toastError).toHaveBeenCalledWith('Location is required', expect.any(Object))
    expect(onUpdateSession).not.toHaveBeenCalled()
  })

  it('shows validation error for invalid time range during edit', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onUpdateSession = vi.fn()

    renderSchedule({ sessions: [baseSession], onUpdateSession })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    setDateTimeInput(/start time/i, '2026-03-20T11:00')
    setDateTimeInput(/end time/i, '2026-03-20T10:00')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(toastError).toHaveBeenCalledWith('Invalid time range', expect.any(Object))
    expect(onUpdateSession).not.toHaveBeenCalled()
  })

  it('shows validation error for invalid schedule time values during edit', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onUpdateSession = vi.fn()

    renderSchedule({ sessions: [baseSession], onUpdateSession })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    setDateTimeInput(/start time/i, '')
    setDateTimeInput(/end time/i, '')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(toastError).toHaveBeenCalledWith('Invalid schedule time', expect.any(Object))
    expect(onUpdateSession).not.toHaveBeenCalled()
  })

  it('shows validation error when capacity is zero during edit', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onUpdateSession = vi.fn()

    renderSchedule({ sessions: [baseSession], onUpdateSession })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    await user.clear(screen.getByLabelText(/capacity/i))
    await user.type(screen.getByLabelText(/capacity/i), '0')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(toastError).toHaveBeenCalledWith('Invalid capacity', expect.any(Object))
    expect(onUpdateSession).not.toHaveBeenCalled()
  })

  it('shows validation error when capacity is below enrolled student count', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onUpdateSession = vi.fn()
    const crowdedSession: Session = {
      ...baseSession,
      enrolledStudents: ['u-employee', 'u-trainer'],
      capacity: 3,
    }

    renderSchedule({ sessions: [crowdedSession], onUpdateSession })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    await user.clear(screen.getByLabelText(/capacity/i))
    await user.type(screen.getByLabelText(/capacity/i), '1')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(toastError).toHaveBeenCalledWith('Invalid capacity', expect.any(Object))
    expect(onUpdateSession).not.toHaveBeenCalled()
  })

  it('uses plural "students" in the capacity error message when multiple students are enrolled', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onUpdateSession = vi.fn()
    const crowdedSession: Session = {
      ...baseSession,
      enrolledStudents: ['u-employee', 'u-trainer'],
      capacity: 3,
    }

    renderSchedule({ sessions: [crowdedSession], onUpdateSession })

    await user.click(screen.getByRole('tab', { name: /list/i }))
    await user.click(screen.getByRole('button', { name: /morning safety session/i }))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    await user.clear(screen.getByLabelText(/capacity/i))
    await user.type(screen.getByLabelText(/capacity/i), '1')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(toastError).toHaveBeenCalledWith(
      'Invalid capacity',
      expect.objectContaining({
        description: 'Capacity cannot be less than the 2 currently enrolled students.',
      })
    )
    expect(onUpdateSession).not.toHaveBeenCalled()
  })

  it('blocks save when edited session conflicts with another session', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onUpdateSession = vi.fn()
    const conflictSpy = vi.spyOn(conflictDetection, 'checkSessionConflicts').mockReturnValue({
      hasConflicts: true,
      conflicts: [
        {
          type: 'trainer',
          message: 'Mock trainer conflict',
          severity: 'error',
          conflictingSessionId: 's-2',
          conflictingSessionTitle: 'Conflicting Session',
        },
      ],
    })
    const conflictSession: Session = {
      ...baseSession,
      id: 's-2',
      title: 'Conflicting Session',
      startTime: '2026-03-20T11:00:00.000Z',
      endTime: '2026-03-20T12:00:00.000Z',
      enrolledStudents: [],
      capacity: 10,
    }

    try {
      renderSchedule({ sessions: [baseSession, conflictSession], onUpdateSession })

      await user.click(screen.getByRole('tab', { name: /list/i }))
      await user.click(screen.getByRole('button', { name: /morning safety session/i }))
      await user.click(screen.getByRole('button', { name: /^edit$/i }))

      setDateTimeInput(/start time/i, '2026-03-20T11:15')
      setDateTimeInput(/end time/i, '2026-03-20T11:45')
      await user.click(screen.getByRole('button', { name: /save changes/i }))

      expect(conflictSpy).toHaveBeenCalled()
      const [editedSession, targetStartTime, targetEndTime, allSessions] = conflictSpy.mock.calls[0]
      expect(editedSession).toEqual(
        expect.objectContaining({
          id: baseSession.id,
          startTime: new Date('2026-03-20T11:15').toISOString(),
          endTime: new Date('2026-03-20T11:45').toISOString(),
        })
      )
      expect(targetStartTime).toEqual(new Date('2026-03-20T11:15'))
      expect(targetEndTime).toEqual(new Date('2026-03-20T11:45'))
      expect(allSessions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 's-2' })]))

      expect(toastError).toHaveBeenCalledWith('Cannot save session changes', expect.any(Object))
      expect(onUpdateSession).not.toHaveBeenCalled()
    } finally {
      conflictSpy.mockRestore()
    }
  })
})
