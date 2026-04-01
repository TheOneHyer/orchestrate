import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Dashboard } from './Dashboard'
import type { User, Course, Session, Notification, Enrollment } from '@/lib/types'

const baseUser: User = {
  id: 'u-admin',
  name: 'Alex Admin',
  email: 'alex@example.com',
  role: 'admin',
  department: 'Operations',
  certifications: [],
  hireDate: '2024-01-10T00:00:00.000Z',
}

const baseCourse: Course = {
  id: 'c-1',
  title: 'Safety Foundations',
  description: 'Core safety training',
  modules: ['Intro'],
  duration: 90,
  certifications: [],
  createdBy: 'u-admin',
  createdAt: '2026-03-16T08:00:00.000Z',
  published: true,
  passScore: 80,
}

describe('Dashboard', () => {
  it('renders summary metrics and empty states', () => {
    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/welcome back, alex/i)).toBeInTheDocument()
    expect(screen.getByText(/^active courses$/i)).toBeInTheDocument()
    expect(screen.getByTestId('upcoming-sessions-heading')).toHaveTextContent(/^upcoming sessions$/i)
    expect(screen.getByText(/^notifications$/i)).toBeInTheDocument()
    expect(screen.getByText(/no upcoming sessions/i)).toBeInTheDocument()
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument()
  })

  it('navigates to a session when a session card is clicked', async () => {
    const onNavigate = vi.fn()

    const session: Session = {
      id: 's-1',
      courseId: baseCourse.id,
      trainerId: 'u-trainer',
      title: 'Morning Safety Session',
      startTime: '2026-03-17T09:00:00.000Z',
      endTime: '2026-03-17T10:30:00.000Z',
      location: 'Room A',
      capacity: 12,
      enrolledStudents: ['u-1', 'u-2'],
      status: 'scheduled',
    }

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[session]}
        notifications={[]}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={onNavigate}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /morning safety session/i }))

    expect(onNavigate).toHaveBeenCalledWith('schedule', { sessionId: 's-1' })
  })

  it('shows and uses view-all actions when lists exceed five items', async () => {
    const onNavigate = vi.fn()

    const sessions: Session[] = Array.from({ length: 6 }, (_, idx) => ({
      id: `s-${idx}`,
      courseId: baseCourse.id,
      trainerId: 'u-trainer',
      title: `Session ${idx + 1}`,
      startTime: `2026-03-${String(17 + idx).padStart(2, '0')}T09:00:00.000Z`,
      endTime: `2026-03-${String(17 + idx).padStart(2, '0')}T10:00:00.000Z`,
      location: 'Room A',
      capacity: 10,
      enrolledStudents: [],
      status: 'scheduled' as const,
    }))

    const notifications: Notification[] = Array.from({ length: 6 }, (_, idx) => ({
      id: `n-${idx}`,
      userId: baseUser.id,
      type: 'system' as const,
      title: `Notice ${idx + 1}`,
      message: 'System update',
      read: idx > 0,
      createdAt: `2026-03-${String(16 - idx).padStart(2, '0')}T12:00:00.000Z`,
    }))

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={sessions}
        notifications={notifications}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={onNavigate}
      />
    )

    expect(screen.queryByText(/session 6/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/notice 6/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /view all sessions/i }))
    await userEvent.click(screen.getByRole('button', { name: /view all notifications/i }))

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'schedule')
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'notifications')
  })
  it('displays different notification types appropriately', () => {
    const notifications: Notification[] = [
      { id: 'n1', userId: baseUser.id, type: 'system', title: 'System Update', message: 'Maintenance scheduled', read: false, createdAt: '2026-03-16T09:00:00.000Z' },
      { id: 'n2', userId: baseUser.id, type: 'reminder', title: 'Certification Expiring', message: 'CPR expires in 30 days', read: false, createdAt: '2026-03-16T10:00:00.000Z' },
      { id: 'n3', userId: baseUser.id, type: 'completion', title: 'Course Available', message: 'New course added', read: true, createdAt: '2026-03-16T11:00:00.000Z' },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={notifications}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/System Update/)).toBeInTheDocument()
    expect(screen.getByText(/Certification Expiring/)).toBeInTheDocument()
    expect(screen.getByText(/Course Available/)).toBeInTheDocument()
  })

  it('shows only unread notification count correctly', () => {
    const notifications: Notification[] = [
      { id: 'n1', userId: baseUser.id, type: 'system', title: 'Notice 1', message: 'Message', read: false, createdAt: '2026-03-16T09:00:00.000Z' },
      { id: 'n2', userId: baseUser.id, type: 'system', title: 'Notice 2', message: 'Message', read: false, createdAt: '2026-03-16T10:00:00.000Z' },
      { id: 'n3', userId: baseUser.id, type: 'system', title: 'Notice 3', message: 'Message', read: true, createdAt: '2026-03-16T11:00:00.000Z' },
      { id: 'n4', userId: baseUser.id, type: 'system', title: 'Notice 4', message: 'Message', read: true, createdAt: '2026-03-16T12:00:00.000Z' },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={notifications}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByTestId('unread-count')).toHaveTextContent('2')
    expect(screen.getByText(/unread messages/i)).toBeInTheDocument()
    expect(screen.getByText(/Notice 1/)).toBeInTheDocument()
    expect(screen.getByText(/Notice 2/)).toBeInTheDocument()
  })

  it('handles multiple courses in dashboard', () => {
    const courses: Course[] = [
      { id: 'c1', title: 'Course 1', description: 'Desc', modules: [], duration: 60, certifications: [], createdBy: 'u1', createdAt: '2026-01-01T00:00:00.000Z', published: true, passScore: 80 },
      { id: 'c2', title: 'Course 2', description: 'Desc', modules: [], duration: 90, certifications: [], createdBy: 'u1', createdAt: '2026-01-02T00:00:00.000Z', published: true, passScore: 75 },
      { id: 'c3', title: 'Course 3', description: 'Desc', modules: [], duration: 120, certifications: [], createdBy: 'u1', createdAt: '2026-01-03T00:00:00.000Z', published: false, passScore: 70 },
    ]

    const enrollments: Enrollment[] = [
      { id: 'e1', userId: baseUser.id, courseId: 'c1', status: 'in-progress', progress: 40, score: 0, enrolledAt: '2026-02-01T00:00:00.000Z' },
      { id: 'e2', userId: baseUser.id, courseId: 'c2', status: 'in-progress', progress: 65, score: 0, enrolledAt: '2026-02-02T00:00:00.000Z' },
      { id: 'e3', userId: baseUser.id, courseId: 'c3', status: 'completed', progress: 100, score: 88, enrolledAt: '2026-02-03T00:00:00.000Z' },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={enrollments}
        courses={courses}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/^active courses$/i)).toBeInTheDocument()
    expect(screen.getByText(/^2$/)).toBeInTheDocument()
    expect(screen.getByText(/1 completed/i)).toBeInTheDocument()
    expect(screen.getByText(/^in progress$/i)).toBeInTheDocument()
    expect(screen.getAllByText('Course 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Course 2').length).toBeGreaterThan(0)
    expect(screen.queryByText('Course 3')).not.toBeInTheDocument()
  })

  it('renders learning focus cards for in-progress enrollments', () => {
    const courses: Course[] = [
      { ...baseCourse, id: 'focus-course-1', title: 'Focus Course 1' },
      { ...baseCourse, id: 'focus-course-2', title: 'Focus Course 2' },
    ]

    const enrollments: Enrollment[] = [
      {
        id: 'focus-enrollment-risk',
        userId: baseUser.id,
        courseId: 'focus-course-1',
        status: 'in-progress',
        progress: 15,
        enrolledAt: '2026-02-01T00:00:00.000Z',
      },
      {
        id: 'focus-enrollment-watch',
        userId: baseUser.id,
        courseId: 'focus-course-2',
        status: 'in-progress',
        progress: 40,
        enrolledAt: '2026-03-01T00:00:00.000Z',
      },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={enrollments}
        courses={courses}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/^learning focus$/i)).toBeInTheDocument()
    const learningFocusCard = screen.getByText(/^learning focus$/i).closest('[data-slot="card"]')
    expect(learningFocusCard).not.toBeNull()

    if (!learningFocusCard) {
      throw new Error('Expected learning focus card to exist')
    }

    expect(within(learningFocusCard).getByText(/focus course 1/i)).toBeInTheDocument()
    expect(within(learningFocusCard).getByText(/focus course 2/i)).toBeInTheDocument()
    expect(screen.getAllByText(/gap to expected pace/i).length).toBeGreaterThan(0)
  })

  it('navigates to course details from learning focus cards', async () => {
    const onNavigate = vi.fn()

    const focusCourse: Course = {
      ...baseCourse,
      id: 'focus-course',
      title: 'Focus Course Navigation',
    }

    const enrollments: Enrollment[] = [
      {
        id: 'focus-enrollment',
        userId: baseUser.id,
        courseId: 'focus-course',
        status: 'in-progress',
        progress: 12,
        enrolledAt: '2026-02-01T00:00:00.000Z',
      },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={enrollments}
        courses={[focusCourse]}
        onNavigate={onNavigate}
      />
    )

    const learningFocusCard = screen.getByText(/^learning focus$/i).closest('[data-slot="card"]')
    expect(learningFocusCard).not.toBeNull()

    if (!learningFocusCard) {
      throw new Error('Expected learning focus card to exist')
    }

    await userEvent.click(within(learningFocusCard).getByRole('button', { name: /focus course navigation/i }))
    expect(onNavigate).toHaveBeenCalledWith('courses', { courseId: 'focus-course' })
  })

  it('renders deadline watch indicators for due-soon and overdue enrollments', () => {
    const courses: Course[] = [
      { ...baseCourse, id: 'deadline-course-1', title: 'Deadline Course 1' },
      { ...baseCourse, id: 'deadline-course-2', title: 'Deadline Course 2' },
    ]

    const enrollments: Enrollment[] = [
      {
        id: 'deadline-overdue',
        userId: baseUser.id,
        courseId: 'deadline-course-1',
        status: 'in-progress',
        progress: 20,
        enrolledAt: '2026-02-01T00:00:00.000Z',
        targetCompletionDate: '2026-03-15T00:00:00.000Z',
      },
      {
        id: 'deadline-soon',
        userId: baseUser.id,
        courseId: 'deadline-course-2',
        status: 'enrolled',
        progress: 10,
        enrolledAt: '2026-03-15T00:00:00.000Z',
        targetCompletionDate: '2026-04-05T00:00:00.000Z',
      },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={enrollments}
        courses={courses}
        onNavigate={vi.fn()}
      />
    )

    const deadlineWatchCard = screen.getByText(/^deadline watch$/i).closest('[data-slot="card"]')
    expect(deadlineWatchCard).not.toBeNull()

    if (!deadlineWatchCard) {
      throw new Error('Expected deadline watch card to exist')
    }

    expect(within(deadlineWatchCard).getByText(/^overdue$/i)).toBeInTheDocument()
    expect(within(deadlineWatchCard).getByText(/^due soon$/i)).toBeInTheDocument()
  })

  it('navigates from deadline watch items to course details', async () => {
    const onNavigate = vi.fn()
    const deadlineCourse: Course = {
      ...baseCourse,
      id: 'deadline-course-nav',
      title: 'Deadline Navigation Course',
    }

    const enrollments: Enrollment[] = [
      {
        id: 'deadline-navigation-enrollment',
        userId: baseUser.id,
        courseId: 'deadline-course-nav',
        status: 'in-progress',
        progress: 40,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        targetCompletionDate: '2026-04-04T00:00:00.000Z',
      },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={enrollments}
        courses={[deadlineCourse]}
        onNavigate={onNavigate}
      />
    )

    const deadlineWatchCard = screen.getByText(/^deadline watch$/i).closest('[data-slot="card"]')
    expect(deadlineWatchCard).not.toBeNull()

    if (!deadlineWatchCard) {
      throw new Error('Expected deadline watch card to exist')
    }

    await userEvent.click(within(deadlineWatchCard).getByRole('button', { name: /deadline navigation course/i }))
    expect(onNavigate).toHaveBeenCalledWith('courses', { courseId: 'deadline-course-nav' })
  })

  it('opens notifications pre-filtered to learning reminders from deadline watch', async () => {
    const onNavigate = vi.fn()
    const deadlineCourse: Course = {
      ...baseCourse,
      id: 'deadline-alert-course',
      title: 'Deadline Alert Course',
    }

    const enrollments: Enrollment[] = [
      {
        id: 'deadline-alert-enrollment',
        userId: baseUser.id,
        courseId: 'deadline-alert-course',
        status: 'in-progress',
        progress: 25,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        targetCompletionDate: '2026-04-04T00:00:00.000Z',
      },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={enrollments}
        courses={[deadlineCourse]}
        onNavigate={onNavigate}
      />
    )

    const deadlineWatchCard = screen.getByText(/^deadline watch$/i).closest('[data-slot="card"]')
    expect(deadlineWatchCard).not.toBeNull()

    if (!deadlineWatchCard) {
      throw new Error('Expected deadline watch card to exist')
    }

    await userEvent.click(within(deadlineWatchCard).getByRole('button', { name: /open learning alerts/i }))
    expect(onNavigate).toHaveBeenCalledWith('notifications', { tab: 'learning-reminders' })
  })

  it('renders recommended learning path items for missing certifications', () => {
    const courses: Course[] = [
      {
        ...baseCourse,
        id: 'learning-path-course-1',
        title: 'Leadership Pathway',
        certifications: ['Leadership'],
      },
      {
        ...baseCourse,
        id: 'learning-path-course-2',
        title: 'Quality Pathway',
        certifications: ['Quality'],
      },
    ]

    render(
      <Dashboard
        currentUser={{ ...baseUser, certifications: ['Safety'] }}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={[]}
        courses={courses}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/^recommended learning path$/i)).toBeInTheDocument()
    expect(screen.getByText(/leadership pathway/i)).toBeInTheDocument()
    expect(screen.getByText(/quality pathway/i)).toBeInTheDocument()
  })

  it('navigates to a course from recommended learning path', async () => {
    const onNavigate = vi.fn()
    const recommendedCourse: Course = {
      ...baseCourse,
      id: 'learning-path-nav-course',
      title: 'Leadership Navigation Path',
      certifications: ['Leadership'],
    }

    render(
      <Dashboard
        currentUser={{ ...baseUser, certifications: ['Safety'] }}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={[]}
        courses={[recommendedCourse]}
        onNavigate={onNavigate}
      />
    )

    const learningPathCard = screen.getByText(/^recommended learning path$/i).closest('[data-slot="card"]')
    expect(learningPathCard).not.toBeNull()

    if (!learningPathCard) {
      throw new Error('Expected recommended learning path card to exist')
    }

    await userEvent.click(within(learningPathCard).getByRole('button', { name: /leadership navigation path/i }))
    expect(onNavigate).toHaveBeenCalledWith('courses', { courseId: 'learning-path-nav-course' })
  })

  it('displays active vs completed enrollments appropriately', () => {
    const courses: Course[] = [
      { ...baseCourse, id: 'c1', title: 'Active Course 1' },
      { ...baseCourse, id: 'c2', title: 'Active Course 2' },
      { ...baseCourse, id: 'c3', title: 'Completed Course' },
      { ...baseCourse, id: 'c4', title: 'Failed Course' },
    ]

    const enrollments: Enrollment[] = [
      { id: 'e1', userId: baseUser.id, courseId: 'c1', status: 'in-progress', progress: 50, score: 0, enrolledAt: '2026-02-01T00:00:00.000Z' },
      { id: 'e2', userId: baseUser.id, courseId: 'c2', status: 'in-progress', progress: 75, score: 0, enrolledAt: '2026-02-02T00:00:00.000Z' },
      { id: 'e3', userId: baseUser.id, courseId: 'c3', status: 'completed', progress: 100, score: 85, enrolledAt: '2026-02-03T00:00:00.000Z' },
      { id: 'e4', userId: baseUser.id, courseId: 'c4', status: 'failed', progress: 100, score: 60, enrolledAt: '2026-02-04T00:00:00.000Z' },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={enrollments}
        courses={courses}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/^active courses$/i)).toBeInTheDocument()
    expect(screen.getByText(/^2$/)).toBeInTheDocument()
    expect(screen.getByText(/1 completed/i)).toBeInTheDocument()
    expect(screen.getAllByText('Active Course 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active Course 2').length).toBeGreaterThan(0)
    expect(screen.queryByText('Completed Course')).not.toBeInTheDocument()
    expect(screen.queryByText('Failed Course')).not.toBeInTheDocument()
  })

  it('skips in-progress enrollments when their course cannot be resolved', () => {
    const enrollments: Enrollment[] = [
      {
        id: 'e-missing-course',
        userId: baseUser.id,
        courseId: 'missing-course',
        status: 'in-progress',
        progress: 25,
        score: 0,
        enrolledAt: '2026-02-01T00:00:00.000Z',
      },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={enrollments}
        courses={[baseCourse]}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/^in progress$/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /safety foundations/i })).not.toBeInTheDocument()
  })

  it('handles sessions with various status types', () => {
    const sessions: Session[] = [
      { id: 's1', courseId: 'c1', trainerId: 'u1', title: 'Scheduled Session', startTime: '2026-03-20T09:00:00.000Z', endTime: '2026-03-20T10:00:00.000Z', location: 'Room A', capacity: 10, enrolledStudents: [], status: 'scheduled' },
      { id: 's2', courseId: 'c2', trainerId: 'u2', title: 'Completed Session', startTime: '2026-03-15T09:00:00.000Z', endTime: '2026-03-15T10:00:00.000Z', location: 'Room B', capacity: 15, enrolledStudents: ['u1', 'u2'], status: 'completed' },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={sessions}
        notifications={[]}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/Scheduled Session/i)).toBeInTheDocument()
    expect(screen.getByText(/Completed Session/i)).toBeInTheDocument()
  })

  it('handles trainer roles in dashboard', () => {
    const trainerUser: User = {
      ...baseUser,
      id: 'u-trainer',
      name: 'Jane Trainer',
      role: 'trainer',
      trainerProfile: {
        authorizedRoles: [],
        shiftSchedules: [{ shiftCode: 'DAY', shiftType: 'day', daysWorked: ['monday'], startTime: '08:00', endTime: '16:00', totalHoursPerWeek: 8 }],
        tenure: { hireDate: '2024-01-01', yearsOfService: 2, monthsOfService: 24 },
        specializations: [],
      },
    }

    render(
      <Dashboard
        currentUser={trainerUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/welcome back, jane/i)).toBeInTheDocument()
  })

  it('handles employee roles in dashboard', () => {
    const employeeUser: User = {
      ...baseUser,
      id: 'u-emp',
      name: 'Bob Employee',
      role: 'employee',
    }

    render(
      <Dashboard
        currentUser={employeeUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/welcome back, bob/i)).toBeInTheDocument()
  })

  it('renders with all empty lists', () => {
    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={[]}
        courses={[]}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
    expect(screen.getByText(/no upcoming sessions/i)).toBeInTheDocument()
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument()
  })

  it('handles special characters in user names and titles', () => {
    const specialCharUser: User = {
      ...baseUser,
      name: "O'Brien-Smith's Co.",
    }

    render(
      <Dashboard
        currentUser={specialCharUser}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/welcome back, o'brien-smith's/i)).toBeInTheDocument()
  })

  it('handles dismissing and marking notifications', async () => {
    const onDismissNotification = vi.fn()
    const onMarkNotificationAsRead = vi.fn()
    const user = userEvent.setup()

    const notifications: Notification[] = [
      { id: 'n1', userId: baseUser.id, type: 'system', title: 'Notice', message: 'Message', read: false, createdAt: '2026-03-16T09:00:00.000Z' },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={notifications}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={vi.fn()}
        onDismissNotification={onDismissNotification}
        onMarkNotificationAsRead={onMarkNotificationAsRead}
      />
    )

    await user.click(screen.getByRole('button', { name: /mark notice as read/i }))
    await user.click(screen.getByRole('button', { name: /dismiss notice/i }))

    expect(onMarkNotificationAsRead).toHaveBeenCalledWith('n1')
    expect(onDismissNotification).toHaveBeenCalledWith('n1')
  })

  it('does not navigate or render notification action buttons when link and callbacks are absent', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()

    const notifications: Notification[] = [
      { id: 'n1', userId: baseUser.id, type: 'system', title: 'Passive Notice', message: 'Read this update', read: false, createdAt: '2026-03-16T09:00:00.000Z' },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={notifications}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={onNavigate}
      />
    )

    await user.click(screen.getByRole('button', { name: /passive notice/i }))

    expect(onNavigate).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /mark passive notice as read/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dismiss passive notice/i })).not.toBeInTheDocument()
  })

  it('navigates linked notifications and hides mark-as-read for already read items', async () => {
    const onNavigate = vi.fn()
    const onDismissNotification = vi.fn()
    const onMarkNotificationAsRead = vi.fn()
    const user = userEvent.setup()

    const notifications: Notification[] = [
      {
        id: 'n-linked',
        userId: baseUser.id,
        type: 'completion',
        title: 'Linked Notice',
        message: 'Open the detailed view',
        read: true,
        createdAt: '2026-03-16T09:00:00.000Z',
        link: 'schedule',
      },
    ]

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[]}
        notifications={notifications}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={onNavigate}
        onMarkNotificationAsRead={onMarkNotificationAsRead}
        onDismissNotification={onDismissNotification}
      />
    )

    await user.click(screen.getAllByRole('button', { name: /linked notice/i })[0])

    expect(onNavigate).toHaveBeenCalledWith('schedule')
    expect(screen.queryByRole('button', { name: /mark linked notice as read/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss linked notice/i })).toBeInTheDocument()
  })

  it('renders upcoming sessions without duration metadata when the course cannot be resolved', () => {
    const session: Session = {
      id: 's-missing-course',
      courseId: 'missing-course',
      trainerId: 'u-trainer',
      title: 'Unmapped Session',
      startTime: '2026-03-17T09:00:00.000Z',
      endTime: '2026-03-17T10:30:00.000Z',
      location: 'Room Z',
      capacity: 12,
      enrolledStudents: ['u-1'],
      status: 'scheduled',
    }

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={[session]}
        notifications={[]}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /unmapped session/i })).toBeInTheDocument()
    expect(screen.queryByText(/1h 30m/i)).not.toBeInTheDocument()
  })

  it('limits displayed sessions to five when many sessions exist', () => {
    const sessions: Session[] = Array.from({ length: 20 }, (_, idx) => ({
      id: `s-${idx}`,
      courseId: 'c1',
      trainerId: 'u1',
      title: `Session ${idx + 1}`,
      startTime: `2026-03-${String(17 + Math.floor(idx / 5)).padStart(2, '0')}T${String(9 + (idx % 5)).padStart(2, '0')}:00:00.000Z`,
      endTime: `2026-03-${String(17 + Math.floor(idx / 5)).padStart(2, '0')}T${String(10 + (idx % 5)).padStart(2, '0')}:00:00.000Z`,
      location: `Room ${String.fromCharCode(65 + (idx % 5))}`,
      capacity: 10,
      enrolledStudents: [],
      status: 'scheduled' as const,
    }))

    render(
      <Dashboard
        currentUser={baseUser}
        upcomingSessions={sessions}
        notifications={[]}
        enrollments={[]}
        courses={[baseCourse]}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByTestId('upcoming-sessions-heading')).toBeInTheDocument()
    expect(screen.getByText(/^20$/)).toBeInTheDocument()
    expect(screen.getByText('Session 1')).toBeInTheDocument()
    expect(screen.getByText('Session 2')).toBeInTheDocument()
    expect(screen.getByText('Session 3')).toBeInTheDocument()
    expect(screen.getByText('Session 4')).toBeInTheDocument()
    expect(screen.getByText('Session 5')).toBeInTheDocument()
    expect(screen.queryByText('Session 6')).not.toBeInTheDocument()
    expect(screen.queryByText('Session 20')).not.toBeInTheDocument()
  })
})
