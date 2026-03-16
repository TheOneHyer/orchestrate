import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Dashboard } from './Dashboard'

const baseUser = {
  id: 'u-admin',
  name: 'Alex Admin',
  email: 'alex@example.com',
  role: 'admin',
  department: 'Operations',
  certifications: [],
  hireDate: '2024-01-10T00:00:00.000Z',
}

const baseCourse = {
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
        currentUser={baseUser as any}
        upcomingSessions={[]}
        notifications={[]}
        enrollments={[]}
        courses={[baseCourse] as any}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/welcome back, alex/i)).toBeInTheDocument()
    expect(screen.getAllByText(/active courses/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/upcoming sessions/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/notifications/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/no upcoming sessions/i)).toBeInTheDocument()
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument()
  })

  it('navigates to a session when a session card is clicked', () => {
    const onNavigate = vi.fn()

    const session = {
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
        currentUser={baseUser as any}
        upcomingSessions={[session] as any}
        notifications={[]}
        enrollments={[]}
        courses={[baseCourse] as any}
        onNavigate={onNavigate}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /morning safety session/i }))

    expect(onNavigate).toHaveBeenCalledWith('schedule', { sessionId: 's-1' })
  })

  it('shows and uses view-all actions when lists exceed five items', () => {
    const onNavigate = vi.fn()

    const sessions = Array.from({ length: 6 }, (_, idx) => ({
      id: `s-${idx}`,
      courseId: baseCourse.id,
      trainerId: 'u-trainer',
      title: `Session ${idx + 1}`,
      startTime: `2026-03-${String(17 + idx).padStart(2, '0')}T09:00:00.000Z`,
      endTime: `2026-03-${String(17 + idx).padStart(2, '0')}T10:00:00.000Z`,
      location: 'Room A',
      capacity: 10,
      enrolledStudents: [],
      status: 'scheduled',
    }))

    const notifications = Array.from({ length: 6 }, (_, idx) => ({
      id: `n-${idx}`,
      userId: baseUser.id,
      type: 'system',
      title: `Notice ${idx + 1}`,
      message: 'System update',
      read: idx > 0,
      createdAt: `2026-03-${String(16 - Math.min(idx, 5)).padStart(2, '0')}T12:00:00.000Z`,
    }))

    render(
      <Dashboard
        currentUser={baseUser as any}
        upcomingSessions={sessions as any}
        notifications={notifications as any}
        enrollments={[]}
        courses={[baseCourse] as any}
        onNavigate={onNavigate}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /view all sessions/i }))
    fireEvent.click(screen.getByRole('button', { name: /view all notifications/i }))

    expect(onNavigate).toHaveBeenCalledWith('schedule')
    expect(onNavigate).toHaveBeenCalledWith('notifications')
  })
})
