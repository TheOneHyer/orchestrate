import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

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
    expect(screen.getAllByText(/compliance 101/i)).not.toHaveLength(0)
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
          shiftSchedules: [{ shiftCode: 'DAY', shiftType: 'day', daysWorked: ['monday'], startTime: '08:00', endTime: '16:00', totalHoursPerWeek: 8 }],
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

  it('handles mixed enrollment statuses (completed, in-progress, failed)', () => {
    const enrollments: Enrollment[] = [
      { id: 'e1', userId: 'u1', courseId: 'c1', status: 'completed', progress: 100, score: 90, enrolledAt: '2026-02-01' },
      { id: 'e2', userId: 'u2', courseId: 'c1', status: 'in-progress', progress: 50, score: 50, enrolledAt: '2026-02-02' },
      { id: 'e3', userId: 'u3', courseId: 'c1', status: 'failed', progress: 100, score: 65, enrolledAt: '2026-02-03' },
    ]

    render(<Analytics users={[]} courses={[]} sessions={[]} enrollments={enrollments} />)

    expect(screen.getByTestId('completion-rate')).toHaveTextContent('33%')
    expect(screen.getByTestId('average-score')).toHaveTextContent('68%')
  })

  it('handles single enrollment correctly', () => {
    const enrollments: Enrollment[] = [
      { id: 'e1', userId: 'u1', courseId: 'c1', status: 'completed', progress: 100, score: 92, enrolledAt: '2026-02-01' },
    ]

    render(<Analytics users={[]} courses={[]} sessions={[]} enrollments={enrollments} />)

    expect(screen.getByTestId('completion-rate')).toHaveTextContent('100%')
    expect(screen.getByTestId('average-score')).toHaveTextContent('92%')
  })

  it('calculates sessions correctly with mixed statuses', () => {
    const sessions: Session[] = [
      { id: 's1', courseId: 'c1', trainerId: 'u1', title: 'Session 1', startTime: '2026-03-01T09:00:00.000Z', endTime: '2026-03-01T10:00:00.000Z', location: 'Room A', capacity: 10, enrolledStudents: [], status: 'completed' },
      { id: 's2', courseId: 'c1', trainerId: 'u1', title: 'Session 2', startTime: '2026-03-02T09:00:00.000Z', endTime: '2026-03-02T10:00:00.000Z', location: 'Room B', capacity: 10, enrolledStudents: [], status: 'completed' },
      { id: 's3', courseId: 'c1', trainerId: 'u1', title: 'Session 3', startTime: '2026-03-03T09:00:00.000Z', endTime: '2026-03-03T10:00:00.000Z', location: 'Room C', capacity: 10, enrolledStudents: [], status: 'scheduled' },
      { id: 's4', courseId: 'c1', trainerId: 'u1', title: 'Session 4', startTime: '2026-03-04T09:00:00.000Z', endTime: '2026-03-04T10:00:00.000Z', location: 'Room D', capacity: 10, enrolledStudents: [], status: 'cancelled' },
    ]

    render(<Analytics users={[]} courses={[]} sessions={sessions} enrollments={[]} />)

    expect(screen.getByTestId('sessions-completed')).toHaveTextContent('2/4')
  })

  it('handles multiple courses with varying enrollment numbers', () => {
    const courses: Course[] = [
      { id: 'c1', title: 'Analytics Course 1', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 'u1', createdAt: '2026-01-01', published: true, passScore: 80 },
      { id: 'c2', title: 'Analytics Course 2', description: 'Desc', modules: [], duration: 90, certifications: [], createdBy: 'u1', createdAt: '2026-01-02', published: true, passScore: 75 },
      { id: 'c3', title: 'Analytics Course 3', description: 'Desc', modules: [], duration: 120, certifications: [], createdBy: 'u1', createdAt: '2026-01-03', published: false, passScore: 70 },
    ]

    const enrollments: Enrollment[] = [
      // Intentional duplicate user-course pair to verify analytics aggregation handles duplicate enrollments safely.
      { id: 'e1', userId: 'u1', courseId: 'c1', status: 'completed', progress: 100, score: 90, enrolledAt: '2026-02-01' },
      { id: 'e2', userId: 'u1', courseId: 'c1', status: 'completed', progress: 100, score: 85, enrolledAt: '2026-02-02' },
      { id: 'e3', userId: 'u2', courseId: 'c2', status: 'in-progress', progress: 75, score: 60, enrolledAt: '2026-02-03' },
      { id: 'e4', userId: 'u3', courseId: 'c3', status: 'failed', progress: 100, score: 65, enrolledAt: '2026-02-04' },
    ]

    render(<Analytics users={[]} courses={courses} sessions={[]} enrollments={enrollments} />)

    // Component should handle multiple courses
    expect(screen.getAllByText('Analytics Course 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Analytics Course 2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Analytics Course 3').length).toBeGreaterThan(0)
  })

  it('handles departments with single trainer correctly', () => {
    const users: User[] = [
      createUser({ id: 't1', name: 'Single Trainer', email: 't1@example.com', role: 'trainer', department: 'Sales' }),
    ]

    render(<Analytics users={users} courses={[]} sessions={[]} enrollments={[]} />)

    expect(screen.getByText(/department distribution/i)).toBeInTheDocument()
    expect(screen.getByTestId('department-sales')).toHaveTextContent('Sales')
    expect(screen.getByTestId('department-sales')).toHaveTextContent('0 employees')
    expect(screen.getByTestId('department-sales')).toHaveTextContent('0%')
  })

  it('correctly calculates average score with decimal precision', () => {
    const enrollments: Enrollment[] = [
      { id: 'e1', userId: 'u1', courseId: 'c1', status: 'completed', progress: 100, score: 85.5, enrolledAt: '2026-02-01' },
      { id: 'e2', userId: 'u2', courseId: 'c1', status: 'completed', progress: 100, score: 92.3, enrolledAt: '2026-02-02' },
    ]

    render(<Analytics users={[]} courses={[]} sessions={[]} enrollments={enrollments} />)

    // Should handle decimal scores: 85.5 + 92.3 = 88.9 → 89%
    expect(screen.getByTestId('average-score')).toHaveTextContent('89%')
  })

  it('handles unpublished courses in analytics', () => {
    const courses: Course[] = [
      { id: 'c1', title: 'Published Course', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 'u1', createdAt: '2026-01-01', published: true, passScore: 80 },
      { id: 'c2', title: 'Unpublished Course', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 'u1', createdAt: '2026-01-02', published: false, passScore: 80 },
    ]

    render(<Analytics users={[]} courses={courses} sessions={[]} enrollments={[]} />)

    // Component should render both course titles
    expect(screen.getByText('Published Course')).toBeInTheDocument()
    expect(screen.getByText('Unpublished Course')).toBeInTheDocument()
  })

  it('renders correctly with no trainers but multiple employees', () => {
    const users: User[] = [
      createUser({ id: 'u1', name: 'Employee 1', email: 'e1@example.com', role: 'employee' }),
      createUser({ id: 'u2', name: 'Employee 2', email: 'e2@example.com', role: 'employee' }),
      createUser({ id: 'u3', name: 'Employee 3', email: 'e3@example.com', role: 'employee' }),
    ]

    render(<Analytics users={users} courses={[]} sessions={[]} enrollments={[]} />)

    expect(screen.getByTestId('employee-count')).toHaveTextContent('3')
  })

  it('handles all trainers being unconfigured', () => {
    const users: User[] = [
      createUser({ id: 't1', name: 'T1', email: 't1@example.com', role: 'trainer' }),
      createUser({ id: 't2', name: 'T2', email: 't2@example.com', role: 'trainer' }),
      createUser({ id: 't3', name: 'T3', email: 't3@example.com', role: 'trainer' }),
    ]

    render(<Analytics users={users} courses={[]} sessions={[]} enrollments={[]} />)

    expect(screen.getByTestId('unconfigured-trainers')).toHaveTextContent('3 trainers')
    expect(screen.getByTestId('unconfigured-trainers')).toHaveTextContent('100%')
  })

  it('handles all trainers being configured', () => {
    const users: User[] = [
      {
        ...createUser({ id: 't1', name: 'T1', email: 't1@example.com', role: 'trainer' }),
        trainerProfile: {
          authorizedRoles: [],
          shiftSchedules: [{ shiftCode: 'DAY', shiftType: 'day', daysWorked: ['monday'], startTime: '08:00', endTime: '16:00', totalHoursPerWeek: 8 }],
          tenure: { hireDate: '2024-01-01', yearsOfService: 2, monthsOfService: 24 },
          specializations: [],
        },
      },
      {
        ...createUser({ id: 't2', name: 'T2', email: 't2@example.com', role: 'trainer' }),
        trainerProfile: {
          authorizedRoles: [],
          shiftSchedules: [{ shiftCode: 'EVENING', shiftType: 'evening', daysWorked: ['tuesday'], startTime: '16:00', endTime: '23:00', totalHoursPerWeek: 7 }],
          tenure: { hireDate: '2024-01-01', yearsOfService: 1, monthsOfService: 12 },
          specializations: [],
        },
      },
    ]

    render(<Analytics users={users} courses={[]} sessions={[]} enrollments={[]} />)

    expect(screen.getByTestId('configured-trainers')).toHaveTextContent('2 trainers')
    expect(screen.getByTestId('configured-trainers')).toHaveTextContent('100%')
  })

  it('handles sessions with zero attendance', () => {
    const sessions: Session[] = [
      { id: 's1', courseId: 'c1', trainerId: 'u1', title: 'Empty Session', startTime: '2026-03-01T09:00:00.000Z', endTime: '2026-03-01T10:00:00.000Z', location: 'Room A', capacity: 10, enrolledStudents: [], status: 'completed' },
      { id: 's2', courseId: 'c1', trainerId: 'u1', title: 'Full Session', startTime: '2026-03-02T09:00:00.000Z', endTime: '2026-03-02T10:00:00.000Z', location: 'Room B', capacity: 10, enrolledStudents: ['u1', 'u2', 'u3'], status: 'completed' },
    ]

    render(<Analytics users={[]} courses={[]} sessions={sessions} enrollments={[]} />)

    expect(screen.getByTestId('sessions-completed')).toHaveTextContent('2/2')
  })

  it('handles large enrollments list correctly', () => {
    const enrollments: Enrollment[] = Array.from({ length: 100 }, (_, i) => ({
      id: `e${i}`,
      userId: `u${i}`,
      courseId: 'c1',
      status: i % 2 === 0 ? 'completed' : 'in-progress',
      progress: i % 2 === 0 ? 100 : 50,
      score: i,
      enrolledAt: '2026-02-01',
    }))

    render(<Analytics users={[]} courses={[]} sessions={[]} enrollments={enrollments} />)

    expect(screen.getByTestId('completion-rate')).toHaveTextContent('50%')
  })

  it('handles enrollment with extreme score values', () => {
    const enrollments: Enrollment[] = [
      { id: 'e1', userId: 'u1', courseId: 'c1', status: 'completed', progress: 100, score: 100, enrolledAt: '2026-02-01' },
      { id: 'e2', userId: 'u2', courseId: 'c1', status: 'completed', progress: 100, score: 0, enrolledAt: '2026-02-02' },
    ]

    render(<Analytics users={[]} courses={[]} sessions={[]} enrollments={enrollments} />)

    expect(screen.getByTestId('average-score')).toHaveTextContent('50%')
  })

  it('filters analytics metrics and operational highlights', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const users: User[] = [
      createUser({ id: 'u1', name: 'Ops Employee', email: 'ops@example.com', role: 'employee', department: 'Ops' }),
      createUser({ id: 'u2', name: 'HR Employee', email: 'hr@example.com', role: 'employee', department: 'HR' }),
      createUser({ id: 't1', name: 'Trainer', email: 'trainer@example.com', role: 'trainer', department: 'Ops' }),
      createUser({ id: 't2', name: 'HR Trainer', email: 'hr-trainer@example.com', role: 'trainer', department: 'HR' }),
    ]
    const courses: Course[] = [
      { id: 'c1', title: 'Safety', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 't1', createdAt: '2026-01-01', published: true, passScore: 80 },
      { id: 'c2', title: 'HR Compliance', description: 'Desc', modules: [], duration: 45, certifications: [], createdBy: 't1', createdAt: '2026-01-02', published: false, passScore: 85 },
    ]
    const sessions: Session[] = [
      { id: 's1', courseId: 'c1', trainerId: 't1', title: 'Open Safety Session', startTime: '2026-03-02T09:00:00.000Z', endTime: '2026-03-02T10:00:00.000Z', location: 'Room A', capacity: 10, enrolledStudents: ['u1'], status: 'scheduled' },
      { id: 's2', courseId: 'c2', trainerId: 't2', title: 'Completed HR Session', startTime: '2026-03-03T09:00:00.000Z', endTime: '2026-03-03T10:00:00.000Z', location: 'Room B', capacity: 10, enrolledStudents: ['u2'], status: 'completed' },
    ]
    const enrollments: Enrollment[] = [
      { id: 'e1', userId: 'u1', courseId: 'c1', status: 'in-progress', progress: 40, score: 0, enrolledAt: '2026-02-01' },
      { id: 'e2', userId: 'u2', courseId: 'c2', status: 'completed', progress: 100, score: 91, enrolledAt: '2026-02-02' },
    ]

    render(<Analytics users={users} courses={courses} sessions={sessions} enrollments={enrollments} />)

    await user.click(screen.getByRole('combobox', { name: /filter by department/i }))
    await user.click(screen.getByRole('option', { name: 'HR' }))
    expect(screen.getByTestId('employee-count')).toHaveTextContent('1')

    await user.click(screen.getByRole('combobox', { name: /filter by course/i }))
    await user.click(screen.getByRole('option', { name: /hr compliance/i }))

    await user.click(screen.getByRole('combobox', { name: /filter by status/i }))
    await user.click(screen.getByRole('option', { name: /^completed$/i }))

    expect(screen.getByText(/operational highlights/i)).toBeInTheDocument()
    expect(screen.getByTestId('employee-count')).toHaveTextContent('1')
    expect(screen.getByTestId('completion-rate')).toHaveTextContent('100%')
    expect(screen.getByText(/open sessions/i)).toBeInTheDocument()
    expect(screen.queryByText(/open safety session/i)).toBeNull()
  })

  it('excludes sessions whose trainer is not in the selected department', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const users: User[] = [
      createUser({ id: 't1', name: 'Ops Trainer', email: 'ops@example.com', role: 'trainer', department: 'Ops' }),
      createUser({ id: 't2', name: 'HR Trainer', email: 'hr@example.com', role: 'trainer', department: 'HR' }),
    ]
    const sessions: Session[] = [
      { id: 's1', courseId: 'c1', trainerId: 't1', title: 'Ops Session', startTime: '2026-03-01T09:00:00.000Z', endTime: '2026-03-01T10:00:00.000Z', location: 'Room A', capacity: 10, enrolledStudents: [], status: 'completed' },
      { id: 's2', courseId: 'c1', trainerId: 't2', title: 'HR Session', startTime: '2026-03-02T09:00:00.000Z', endTime: '2026-03-02T10:00:00.000Z', location: 'Room B', capacity: 10, enrolledStudents: [], status: 'scheduled' },
    ]

    render(<Analytics users={users} courses={[]} sessions={sessions} enrollments={[]} />)

    await user.click(screen.getByRole('combobox', { name: /filter by department/i }))
    await user.click(screen.getByRole('option', { name: 'HR' }))

    // Only the HR trainer's session should remain: 0 completed out of 1
    expect(screen.getByTestId('sessions-completed')).toHaveTextContent('0/1')
  })

  it('does not empty sessions KPI when failed enrollment-only status filter is selected', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const sessions: Session[] = [
      { id: 's1', courseId: 'c1', trainerId: 't1', title: 'Session A', startTime: '2026-03-01T09:00:00.000Z', endTime: '2026-03-01T10:00:00.000Z', location: 'Room A', capacity: 10, enrolledStudents: [], status: 'completed' },
      { id: 's2', courseId: 'c1', trainerId: 't1', title: 'Session B', startTime: '2026-03-02T09:00:00.000Z', endTime: '2026-03-02T10:00:00.000Z', location: 'Room B', capacity: 10, enrolledStudents: [], status: 'scheduled' },
    ]
    const enrollments: Enrollment[] = [
      { id: 'e1', userId: 'u1', courseId: 'c1', status: 'failed', progress: 100, score: 40, enrolledAt: '2026-02-01' },
    ]

    render(<Analytics users={[]} courses={[]} sessions={sessions} enrollments={enrollments} />)

    await user.click(screen.getByRole('combobox', { name: /filter by status/i }))
    await user.click(screen.getByRole('option', { name: /failed/i }))

    // Sessions should not be filtered to zero by an enrollment-only status
    expect(screen.getByTestId('sessions-completed')).toHaveTextContent('1/2')
  })

  it('filters by scheduled session status for both sessions and linked enrollments', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const users: User[] = [createUser({ id: 'u1', role: 'employee' })]
    const courses: Course[] = [
      { id: 'c1', title: 'Safety', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 't1', createdAt: '2026-01-01', published: true, passScore: 80 },
    ]
    const sessions: Session[] = [
      { id: 's1', courseId: 'c1', trainerId: 't1', title: 'Scheduled Session', startTime: '2026-03-01T09:00:00.000Z', endTime: '2026-03-01T10:00:00.000Z', location: 'Room A', capacity: 10, enrolledStudents: ['u1'], status: 'scheduled' },
      { id: 's2', courseId: 'c1', trainerId: 't1', title: 'Cancelled Session', startTime: '2026-03-02T09:00:00.000Z', endTime: '2026-03-02T10:00:00.000Z', location: 'Room B', capacity: 10, enrolledStudents: ['u1'], status: 'cancelled' },
    ]
    const enrollments: Enrollment[] = [
      { id: 'e1', userId: 'u1', courseId: 'c1', sessionId: 's1', status: 'in-progress', progress: 20, score: 10, enrolledAt: '2026-02-01' },
      { id: 'e2', userId: 'u1', courseId: 'c1', status: 'in-progress', progress: 50, score: 50, enrolledAt: '2026-02-02' },
    ]

    render(<Analytics users={users} courses={courses} sessions={sessions} enrollments={enrollments} />)

    await user.click(screen.getByRole('combobox', { name: /filter by status/i }))
    await user.click(screen.getByRole('option', { name: /^scheduled$/i }))

    expect(screen.getByTestId('sessions-completed')).toHaveTextContent('0/1')
    expect(screen.getByTestId('filtered-enrollments-value')).toHaveTextContent('1')
  })

  it('computes attendance rate from present and late attendance records', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const users: User[] = [
      createUser({ id: 't1', name: 'Ops Trainer', email: 'ops-trainer@example.com', role: 'trainer', department: 'Ops' }),
      createUser({ id: 't2', name: 'HR Trainer', email: 'hr-trainer@example.com', role: 'trainer', department: 'HR' }),
    ]
    const sessions: Session[] = [
      { id: 's1', courseId: 'c1', trainerId: 't1', title: 'Session 1', startTime: '2026-03-01T09:00:00.000Z', endTime: '2026-03-01T10:00:00.000Z', location: 'Room A', capacity: 10, enrolledStudents: [], status: 'completed' },
      { id: 's2', courseId: 'c1', trainerId: 't2', title: 'Session 2', startTime: '2026-03-02T09:00:00.000Z', endTime: '2026-03-02T10:00:00.000Z', location: 'Room B', capacity: 10, enrolledStudents: [], status: 'scheduled' },
    ]

    render(
      <Analytics
        users={users}
        courses={[]}
        sessions={sessions}
        enrollments={[]}
        attendanceRecords={[
          { id: 'a1', sessionId: 's1', userId: 'u1', status: 'present', markedAt: '2026-03-01T09:00:00.000Z', markedBy: 't1' },
          { id: 'a2', sessionId: 's1', userId: 'u2', status: 'late', markedAt: '2026-03-01T09:10:00.000Z', markedBy: 't1' },
          { id: 'a3', sessionId: 's1', userId: 'u3', status: 'absent', markedAt: '2026-03-01T09:05:00.000Z', markedBy: 't1' },
          { id: 'a4', sessionId: 's2', userId: 'u4', status: 'absent', markedAt: '2026-03-02T09:05:00.000Z', markedBy: 't1' },
        ]}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: /filter by department/i }))
    await user.click(screen.getByRole('option', { name: /^ops$/i }))

    expect(screen.getByTestId('attendance-rate')).toHaveTextContent('67%')
    expect(screen.getByText(/2 present\/late of 3 marks/i)).toBeInTheDocument()
  })

  it('shows due-soon and overdue enrollment counts in operational highlights', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-02T00:00:00.000Z'))

    const courses: Course[] = [
      { id: 'c1', title: 'Safety', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 't1', createdAt: '2026-01-01', published: true, passScore: 80 },
      { id: 'c2', title: 'Leadership', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 't1', createdAt: '2026-01-02', published: true, passScore: 80 },
    ]

    const enrollments: Enrollment[] = [
      {
        id: 'e-overdue',
        userId: 'u1',
        courseId: 'c1',
        status: 'in-progress',
        progress: 15,
        score: 0,
        enrolledAt: '2026-02-01T00:00:00.000Z',
        targetCompletionDate: '2026-03-10T00:00:00.000Z',
      },
      {
        id: 'e-due-soon',
        userId: 'u2',
        courseId: 'c2',
        status: 'enrolled',
        progress: 5,
        score: 0,
        enrolledAt: '2026-03-20T00:00:00.000Z',
        targetCompletionDate: '2026-04-06T00:00:00.000Z',
      },
    ]

    try {
      render(<Analytics users={[]} courses={courses} sessions={[]} enrollments={enrollments} />)

      expect(screen.getByTestId('due-soon-enrollments-value')).toHaveTextContent('1')
      expect(screen.getByTestId('overdue-enrollments-value')).toHaveTextContent('1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows learner skill-gap metrics in operational highlights', () => {
    const users: User[] = [
      createUser({ id: 'u1', role: 'employee', certifications: ['Safety'], department: 'Ops' }),
      createUser({ id: 'u2', role: 'employee', certifications: ['Safety', 'Leadership'], department: 'Ops' }),
      createUser({ id: 'u3', role: 'employee', certifications: ['Safety'], department: 'Ops' }),
    ]

    const courses: Course[] = [
      { id: 'c1', title: 'Leadership Path', description: 'Desc', modules: [], duration: 60, certifications: ['Leadership'], createdBy: 't1', createdAt: '2026-01-01', published: true, passScore: 80 },
      { id: 'c2', title: 'Quality Path', description: 'Desc', modules: [], duration: 60, certifications: ['Quality'], createdBy: 't1', createdAt: '2026-01-02', published: true, passScore: 80 },
    ]

    render(<Analytics users={users} courses={courses} sessions={[]} enrollments={[]} />)

    expect(screen.getByTestId('learners-with-gaps-value')).toHaveTextContent('3')
    expect(screen.getByTestId('top-missing-certification-value')).toHaveTextContent('Quality (3)')
  })

  it('shows stalled and critical stalled enrollment engagement metrics', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-02T00:00:00.000Z'))

    const users: User[] = [
      createUser({ id: 'u1', name: 'Learner One', role: 'employee', department: 'Ops' }),
      createUser({ id: 'u2', name: 'Learner Two', role: 'employee', department: 'Ops' }),
    ]
    const courses: Course[] = [
      { id: 'c1', title: 'Safety', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 't1', createdAt: '2026-01-01', published: true, passScore: 80 },
      { id: 'c2', title: 'Leadership', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 't1', createdAt: '2026-01-02', published: true, passScore: 80 },
    ]

    const enrollments: Enrollment[] = [
      {
        id: 'e-critical-stall',
        userId: 'u1',
        courseId: 'c1',
        status: 'in-progress',
        progress: 20,
        score: 0,
        enrolledAt: '2026-02-01T00:00:00.000Z',
        lastProgressAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'e-stall',
        userId: 'u2',
        courseId: 'c2',
        status: 'enrolled',
        progress: 8,
        score: 0,
        enrolledAt: '2026-03-10T00:00:00.000Z',
        lastProgressAt: '2026-03-24T00:00:00.000Z',
      },
    ]

    try {
      render(<Analytics users={users} courses={courses} sessions={[]} enrollments={enrollments} />)

      expect(screen.getByTestId('stalled-enrollments-value')).toHaveTextContent('1')
      expect(screen.getByTestId('critical-stalled-enrollments-value')).toHaveTextContent('1')
      expect(screen.getByText(/intervention queue/i)).toBeInTheDocument()
      expect(screen.getByTestId('intervention-e-critical-stall')).toHaveTextContent('Learner One')
      expect(screen.getByTestId('intervention-e-critical-stall')).toHaveTextContent('Critical stall')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows intervention SLA fields and triggers playbook navigation actions', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const users: User[] = [
      createUser({ id: 'u1', name: 'Learner One', role: 'employee', department: 'Ops' }),
      createUser({ id: 'manager-1', name: 'Manager One', role: 'admin', department: 'Ops' }),
    ]

    const courses: Course[] = [
      { id: 'c1', title: 'Safety', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 't1', createdAt: '2026-01-01', published: true, passScore: 80 },
    ]

    const enrollments: Enrollment[] = [
      {
        id: 'e-critical-stall',
        userId: 'u1',
        courseId: 'c1',
        status: 'in-progress',
        progress: 20,
        enrolledAt: '2026-02-01T00:00:00.000Z',
        lastProgressAt: '2026-03-01T00:00:00.000Z',
      },
    ]

    render(
      <Analytics
        users={users}
        courses={courses}
        sessions={[]}
        enrollments={enrollments}
        notifications={[
          {
            id: 'n-engagement-1',
            userId: 'u1',
            type: 'reminder',
            title: 'Critical Learning Stall — Safety',
            message: 'Reminder sent',
            read: false,
            createdAt: '2026-03-15T00:00:00.000Z',
            metadata: {
              engagementReminderKey: 'e-critical-stall:critical-stall',
              enrollmentId: 'e-critical-stall',
              ownerUserId: 'manager-1',
            },
          },
        ]}
        onNavigate={onNavigate}
      />,
    )

    const card = screen.getByTestId('intervention-e-critical-stall')
    expect(card).toHaveTextContent(/owner:\s*manager one/i)
    expect(card).toHaveTextContent(/first nudge:/i)
    expect(card).toHaveTextContent(/escalation age:/i)

    await user.click(screen.getByRole('button', { name: /open course/i }))
    await user.click(screen.getByRole('button', { name: /open learner/i }))

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'courses', { courseId: 'c1' })
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'people', { userId: 'u1' })
  })

  it('shows an empty intervention queue message when no stalled learners exist', () => {
    const users: User[] = [
      createUser({ id: 'u1', name: 'Learner One', role: 'employee', department: 'Ops' }),
    ]

    const courses: Course[] = [
      { id: 'c1', title: 'Safety', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 't1', createdAt: '2026-01-01', published: true, passScore: 80 },
    ]

    const enrollments: Enrollment[] = [
      {
        id: 'e-active',
        userId: 'u1',
        courseId: 'c1',
        status: 'in-progress',
        progress: 70,
        enrolledAt: '2026-03-20T00:00:00.000Z',
        lastProgressAt: '2026-03-30T00:00:00.000Z',
      },
    ]

    render(<Analytics users={users} courses={courses} sessions={[]} enrollments={enrollments} />)

    expect(screen.getByText(/no stalled learners in the current filter scope/i)).toBeInTheDocument()
  })
})
