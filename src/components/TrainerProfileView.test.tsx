import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TrainerProfileView } from './TrainerProfileView'
import type { User, Session, Course, Enrollment } from '@/lib/types'

vi.mock('@/components/UnconfiguredScheduleAlert', () => ({
  UnconfiguredScheduleAlert: () => <div>UnconfiguredScheduleAlert Mock</div>,
}))

vi.mock('@/lib/certification-tracker', () => ({
  calculateCertificationStatus: () => 'active',
}))

vi.mock('@/components/ManageCertificationsDialog', () => ({
  ManageCertificationsDialog: ({ open, certifications, onSave }: { open: boolean; certifications: any[]; onSave: (certs: any[]) => void }) => (
    open ? (
      <div>
        <button
          onClick={() => onSave([
            ...certifications,
            {
              certificationName: 'First Aid',
              issuedDate: '2026-01-01',
              expirationDate: '2027-01-01',
              status: 'active',
              renewalRequired: false,
              remindersSent: 0,
            },
          ])}
        >
          Save Certifications
        </button>
      </div>
    ) : null
  ),
}))

const trainerUser: User = {
  id: 'u-trainer',
  name: 'Taylor Trainer',
  email: 'taylor@example.com',
  role: 'trainer',
  badgeId: 'TR-1001',
  department: 'Training',
  certifications: ['CPR'],
  hireDate: '2021-01-01T00:00:00.000Z',
  trainerProfile: {
    authorizedRoles: ['Forklift Trainer'],
    shiftSchedules: [
      {
        shiftCode: 'DAY',
        daysWorked: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        startTime: '08:00',
        endTime: '16:00',
        totalHoursPerWeek: 40,
      },
    ],
    tenure: {
      hireDate: '2021-01-01T00:00:00.000Z',
      yearsOfService: 5,
      monthsOfService: 60,
    },
    specializations: ['Safety'],
    maxWeeklyHours: 45,
    preferredLocation: 'Plant A',
    notes: 'Strong classroom facilitator',
    certificationRecords: [
      {
        certificationName: 'CPR',
        issuedDate: '2025-01-01',
        expirationDate: '2027-01-01',
        status: 'active',
        renewalRequired: false,
        remindersSent: 0,
      },
    ],
  },
}

const sessions: Session[] = [
  {
    id: 's-upcoming',
    courseId: 'c-1',
    trainerId: 'u-trainer',
    title: 'Upcoming Session',
    startTime: '2099-01-01T09:00:00.000Z',
    endTime: '2099-01-01T10:00:00.000Z',
    location: 'Room A',
    capacity: 10,
    enrolledStudents: ['u-1'],
    status: 'scheduled',
  },
  {
    id: 's-complete',
    courseId: 'c-1',
    trainerId: 'u-trainer',
    title: 'Completed Session',
    startTime: '2025-01-01T09:00:00.000Z',
    endTime: '2025-01-01T10:00:00.000Z',
    location: 'Room B',
    capacity: 10,
    enrolledStudents: ['u-2'],
    status: 'completed',
  },
]

const courses: Course[] = [
  {
    id: 'c-1',
    title: 'Safety Foundations',
    description: 'Course',
    modules: ['Intro'],
    duration: 90,
    certifications: [],
    createdBy: 'u-trainer',
    createdAt: '2026-01-01T00:00:00.000Z',
    published: true,
    passScore: 80,
  },
]

describe('TrainerProfileView', () => {
  it('renders profile details and action sections', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()

    render(
      <TrainerProfileView
        user={trainerUser}
        sessions={sessions}
        courses={courses}
        enrollments={[] as Enrollment[]}
        onEdit={onEdit}
        onDelete={onDelete}
        onUpdateUser={vi.fn()}
      />
    )

    expect(screen.getByText(/taylor trainer/i)).toBeInTheDocument()
    expect(screen.getByText(/taylor@example.com/i)).toBeInTheDocument()
    expect(screen.getByText(/shift schedules/i)).toBeInTheDocument()
    expect(screen.getByText(/authorized teaching roles/i)).toBeInTheDocument()
    expect(screen.getByText(/additional information/i)).toBeInTheDocument()
    expect(screen.getByText(/unconfiguredschedulealert mock/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /edit profile/i }))
    await userEvent.click(screen.getByRole('button', { name: /delete person/i }))

    expect(onEdit).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('updates certification records through manage dialog save callback', async () => {
    const onUpdateUser = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()

    render(
      <TrainerProfileView
        user={trainerUser}
        sessions={sessions}
        courses={courses}
        enrollments={[] as Enrollment[]}
        onEdit={onEdit}
        onDelete={onDelete}
        onUpdateUser={onUpdateUser}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /manage/i }))
    await userEvent.click(screen.getByRole('button', { name: /save certifications/i }))

    expect(onUpdateUser).toHaveBeenCalledOnce()
    const updatedUser = onUpdateUser.mock.calls[0][0]
    expect(updatedUser.trainerProfile.certificationRecords).toHaveLength(2)
  })
})
