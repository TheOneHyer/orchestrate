import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Analytics } from './Analytics'
import type { User, Course, Session, Enrollment } from '@/lib/types'

describe('Analytics', () => {
  it('calculates and renders top-level metrics from provided data', () => {
    const users: User[] = [
      { id: 'u1', name: 'E1', email: 'e1@example.com', role: 'employee', department: 'Ops', certifications: [], hireDate: '2024-01-01' },
      { id: 'u2', name: 'E2', email: 'e2@example.com', role: 'employee', department: 'Ops', certifications: [], hireDate: '2024-01-01' },
      { id: 'u3', name: 'T1', email: 't1@example.com', role: 'trainer', department: 'Ops', certifications: [], hireDate: '2024-01-01' },
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

    // 2 employees in the dataset
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    // 50% completion rate (1 of 2 enrollments completed)
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0)
    // 86% average score (avg of 92 and 80, rounded)
    expect(screen.getAllByText('86%').length).toBeGreaterThan(0)
    // 1/2 sessions completed
    expect(screen.getByText('1/2')).toBeInTheDocument()
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

    expect(screen.getAllByText('0%').length).toBeGreaterThan(0)
    expect(screen.getByText('0/0')).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).toBeNull()
  })
})
