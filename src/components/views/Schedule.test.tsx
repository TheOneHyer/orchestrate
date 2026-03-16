import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Schedule } from './Schedule'

vi.mock('./AutoScheduler', () => ({
  AutoScheduler: () => <div>AutoScheduler Mock</div>,
}))

vi.mock('./GuidedScheduler', () => ({
  GuidedScheduler: () => <div>GuidedScheduler Mock</div>,
}))

vi.mock('@/components/EnrollStudentsDialog', () => ({
  EnrollStudentsDialog: ({ open }: { open: boolean }) => (open ? <div>EnrollStudentsDialog Mock</div> : null),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/conflict-detection', () => ({
  checkSessionConflicts: vi.fn(() => ({ hasConflicts: false, conflicts: [] })),
  formatConflictMessage: vi.fn(() => 'Conflict message'),
}))

const baseTrainer = {
  id: 'u-trainer',
  name: 'Taylor Trainer',
  email: 'taylor@example.com',
  role: 'trainer',
  department: 'Training',
  certifications: ['Safety'],
  hireDate: '2023-01-01',
}

const baseEmployee = {
  id: 'u-employee',
  name: 'Evan Employee',
  email: 'evan@example.com',
  role: 'employee',
  department: 'Operations',
  certifications: [],
  hireDate: '2024-01-01',
}

const baseCourse = {
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

const baseSession = {
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

describe('Schedule', () => {
  it('opens scheduler dialogs and triggers new session navigation', () => {
    const onNavigate = vi.fn()

    render(
      <Schedule
        sessions={[baseSession] as any}
        courses={[baseCourse] as any}
        users={[baseTrainer, baseEmployee] as any}
        currentUser={baseTrainer as any}
        onCreateSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onNavigate={onNavigate}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /auto-schedule/i }))
    expect(screen.getByText(/automatic trainer scheduler/i)).toBeInTheDocument()
    expect(screen.getByText(/autoscheduler mock/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    fireEvent.click(screen.getByRole('button', { name: /guided schedule/i }))
    expect(screen.getByText(/guided trainer scheduler/i)).toBeInTheDocument()
    expect(screen.getByText(/guidedscheduler mock/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    fireEvent.click(screen.getByRole('button', { name: /new session/i }))
    expect(onNavigate).toHaveBeenCalledWith('schedule', { create: true })
  })

  it('renders session data in the calendar view', () => {
    render(
      <Schedule
        sessions={[baseSession, { ...baseSession, id: 's-2', status: 'completed', title: 'Evening Safety Session' }] as any}
        courses={[baseCourse] as any}
        users={[baseTrainer, baseEmployee] as any}
        currentUser={baseTrainer as any}
        onCreateSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByRole('tab', { name: /calendar/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /list/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /board/i })).toBeInTheDocument()
    expect(screen.getByText(/morning safety session/i)).toBeInTheDocument()
    expect(screen.getByText(/evening safety session/i)).toBeInTheDocument()
  })

  it('supports calendar period switching controls', () => {
    render(
      <Schedule
        sessions={[baseSession] as any}
        courses={[baseCourse] as any}
        users={[baseTrainer, baseEmployee] as any}
        currentUser={baseTrainer as any}
        onCreateSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /^day$/i }))
    expect(screen.getByRole('button', { name: /previous day/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^week$/i }))
    expect(screen.getByRole('button', { name: /previous week/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^month$/i }))
    expect(screen.getByRole('button', { name: /previous month/i })).toBeInTheDocument()
  })
})
