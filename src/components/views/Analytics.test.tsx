import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Analytics } from './Analytics'
import type { User, Course, Session, Enrollment } from '@/lib/types'

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-default',
    name: 'Default User',
    email: 'default@example.com',
    role: 'employee',
    department: 'Ops',
    certifications: [],
    hireDate: '2024-01-01',
    ...overrides,
  }
}

describe('Analytics', () => {
  it('calculates and renders top-level metrics from provided data', () => {
    const users: User[] = [
      createUser({ id: 'u1', name: 'E1', email: 'e1@example.com', role: 'employee' }),
      createUser({ id: 'u2', name: 'E2', email: 'e2@example.com', role: 'employee' }),
      createUser({ id: 'u3', name: 'T1', email: 't1@example.com', role: 'trainer' }),
    ]

    const courses: Course[] = [
      {
        id: 'c1',
        title: 'Compliance 101',
        description: 'Course',
        modules: ['Intro'],
        duration: 60,
        certifications: [],
        createdBy: 'u3',
        createdAt: '2026-01-01',
        published: true,
        passScore: 80,
      },
    ]

    const sessions: Session[] = [
      {
        id: 's1',
        courseId: 'c1',
        trainerId: 'u3',
        title: 'Session A',
        startTime: '2026-03-01T09:00:00.000Z',
        endTime: '2026-03-01T10:00:00.000Z',
        location: 'Room A',
        capacity: 10,
        enrolledStudents: ['u1', 'u2'],
        status: 'completed',
      },
      {
        id: 's2',
        courseId: 'c1',
        trainerId: 'u3',
        title: 'Session B',
        startTime: '2026-03-03T09:00:00.000Z',
        endTime: '2026-03-03T10:00:00.000Z',
        location: 'Room B',
        capacity: 10,
        enrolledStudents: [],
        status: 'scheduled',
      },
    ]

    const enrollments: Enrollment[] = [
      { id: 'e1', userId: 'u1', courseId: 'c1', status: 'completed', progress: 100, score: 92, enrolledAt: '2026-02-01' },
      { id: 'e2', userId: 'u2', courseId: 'c1', status: 'in-progress', progress: 40, score: 80, enrolledAt: '2026-02-10' },
    ]

    render(
      <Analytics
        users={users}
        courses={courses}
        sessions={sessions}
        enrollments={enrollments}
      />
    )

    expect(screen.getByTestId('employee-count')).toHaveTextContent('2')
    expect(screen.getByTestId('completion-rate')).toHaveTextContent('50%')
    expect(screen.getByTestId('average-score')).toHaveTextContent('86%')
    expect(screen.getByTestId('sessions-completed')).toHaveTextContent('1/2')
    expect(screen.getByText(/course performance/i)).toBeInTheDocument()
    expect(screen.getByText(/compliance 101/i)).toBeInTheDocument()
    expect(screen.getByText(/department distribution/i)).toBeInTheDocument()
    expect(screen.getByText(/trainer schedule status/i)).toBeInTheDocument()
  })

  it('handles empty data without NaN values', () => {
    render(
      <Analytics
        users={[]}
        enrollments={[]}
        sessions={[]}
        courses={[]}
      />
    )

    expect(screen.getByTestId('completion-rate')).toHaveTextContent('0%')
    expect(screen.getByTestId('average-score')).toHaveTextContent('0%')
    expect(screen.getByTestId('sessions-completed')).toHaveTextContent('0/0')
    expect(screen.queryByText(/NaN/)).toBeNull()
  })

  it('renders department distribution percentages for multiple departments', () => {
    const users: User[] = [
      createUser({ id: 'u1', name: 'E1', email: 'e1@example.com', role: 'employee', department: 'Ops' }),
      createUser({ id: 'u2', name: 'E2', email: 'e2@example.com', role: 'employee', department: 'Ops' }),
      createUser({ id: 'u3', name: 'E3', email: 'e3@example.com', role: 'employee', department: 'HR' }),
    ]

    render(<Analytics users={users} courses={[]} sessions={[]} enrollments={[]} />)

    expect(screen.getByTestId('department-ops')).toHaveTextContent('Ops')
    expect(screen.getByTestId('department-ops')).toHaveTextContent('67%')
    expect(screen.getByTestId('department-hr')).toHaveTextContent('HR')
    expect(screen.getByTestId('department-hr')).toHaveTextContent('33%')
  })

  it('renders trainer schedule status counts for configured and unconfigured trainers', () => {
    const users: User[] = [
      {
        ...createUser({ id: 't1', name: 'Trainer One', email: 't1@example.com', role: 'trainer' }),
        trainerProfile: {
          authorizedRoles: [],
          shiftSchedules: [{ shiftCode: 'DAY', daysWorked: ['monday'], startTime: '08:00', endTime: '16:00', totalHoursPerWeek: 8 }],
          tenure: { hireDate: '2024-01-01', yearsOfService: 2, monthsOfService: 24 },
          specializations: [],
        },
      },
      createUser({ id: 't2', name: 'Trainer Two', email: 't2@example.com', role: 'trainer' }),
    ]

    render(<Analytics users={users} courses={[]} sessions={[]} enrollments={[]} />)

    expect(screen.getByTestId('configured-trainers')).toHaveTextContent('1 trainer')
    expect(screen.getByTestId('configured-trainers')).toHaveTextContent('50%')
    expect(screen.getByTestId('unconfigured-trainers')).toHaveTextContent('1 trainer')
    expect(screen.getByTestId('unconfigured-trainers')).toHaveTextContent('50%')
  })

  it('shows 100% completion when all enrollments are completed', () => {
    const enrollments: Enrollment[] = [
      { id: 'e1', userId: 'u1', courseId: 'c1', status: 'completed', progress: 100, score: 90, enrolledAt: '2026-02-01' },
      { id: 'e2', userId: 'u2', courseId: 'c1', status: 'completed', progress: 100, score: 80, enrolledAt: '2026-02-02' },
    ]

    render(<Analytics users={[]} courses={[]} sessions={[]} enrollments={enrollments} />)

    expect(screen.getByTestId('completion-rate')).toHaveTextContent('100%')
    expect(screen.getByTestId('average-score')).toHaveTextContent('85%')
  })

  it('shows 0% completion when no enrollments are completed', () => {
    const enrollments: Enrollment[] = [
      { id: 'e1', userId: 'u1', courseId: 'c1', status: 'in-progress', progress: 50, score: 40, enrolledAt: '2026-02-01' },
      { id: 'e2', userId: 'u2', courseId: 'c1', status: 'in-progress', progress: 20, score: 0, enrolledAt: '2026-02-02' },
    ]

    render(<Analytics users={[]} courses={[]} sessions={[]} enrollments={enrollments} />)

    expect(screen.getByTestId('completion-rate')).toHaveTextContent('0%')
    expect(screen.getByTestId('average-score')).toHaveTextContent('20%')
  })
})
