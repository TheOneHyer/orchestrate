import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TrainerProfileView } from './TrainerProfileView'
import type { User, Session, Course, Enrollment, CertificationRecord } from '@/lib/types'

const mockCalculateCertificationStatus = vi.fn()

vi.mock('@/components/UnconfiguredScheduleAlert', () => ({
  UnconfiguredScheduleAlert: () => <div>UnconfiguredScheduleAlert Mock</div>,
}))

vi.mock('@/lib/certification-tracker', () => ({
  calculateCertificationStatus: (cert: CertificationRecord) => mockCalculateCertificationStatus(cert),
}))

vi.mock('@/components/ManageCertificationsDialog', () => ({
  ManageCertificationsDialog: ({ open, certifications, onSave }: { open: boolean; certifications: CertificationRecord[]; onSave: (certs: CertificationRecord[]) => void }) => (
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
  beforeEach(() => {
    mockCalculateCertificationStatus.mockReset()
    mockCalculateCertificationStatus.mockReturnValue('active')
  })

  it('renders profile details and action sections', () => {
    render(
      <TrainerProfileView
        user={trainerUser}
        sessions={sessions}
        courses={courses}
        enrollments={[] as Enrollment[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onUpdateUser={vi.fn()}
      />
    )

    expect(screen.getByText(/taylor trainer/i)).toBeInTheDocument()
    expect(screen.getByText(/taylor@example.com/i)).toBeInTheDocument()
    expect(screen.getByText(/shift schedules/i)).toBeInTheDocument()
    expect(screen.getByText(/authorized teaching roles/i)).toBeInTheDocument()
    expect(screen.getByText(/additional information/i)).toBeInTheDocument()
    expect(screen.getByText(/unconfiguredschedulealert mock/i)).toBeInTheDocument()
  })

  it('calls edit and delete callbacks from action buttons', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const user = userEvent.setup()

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

    await user.click(screen.getByRole('button', { name: /edit profile/i }))
    await user.click(screen.getByRole('button', { name: /delete person/i }))

    expect(onEdit).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('updates certification records through manage dialog save callback', async () => {
    const onUpdateUser = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const user = userEvent.setup()
    const initialCount = trainerUser.trainerProfile?.certificationRecords?.length ?? 0

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

    await user.click(screen.getByRole('button', { name: /manage/i }))
    await user.click(screen.getByRole('button', { name: /save certifications/i }))

    expect(onUpdateUser).toHaveBeenCalledOnce()
    const updatedUser = onUpdateUser.mock.calls[0][0]
    expect(updatedUser.trainerProfile.certificationRecords).toHaveLength(initialCount + 1)
    const newRecord = updatedUser.trainerProfile.certificationRecords[initialCount]
    expect(newRecord).toEqual(
      expect.objectContaining({
        certificationName: 'First Aid',
        issuedDate: '2026-01-01',
        expirationDate: '2027-01-01',
        status: 'active',
        renewalRequired: false,
      })
    )
  })

  it('renders string certifications for a non-trainer user without a trainerProfile', () => {
    const employeeWithCerts: User = {
      id: 'u-employee',
      name: 'Jordan Employee',
      email: 'jordan@example.com',
      role: 'employee',
      department: 'Operations',
      certifications: ['CPR', 'First Aid'],
      hireDate: '2024-01-01T00:00:00.000Z',
    }

    render(
      <TrainerProfileView
        user={employeeWithCerts}
        sessions={[]}
        courses={[]}
        enrollments={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onUpdateUser={vi.fn()}
      />
    )

    expect(screen.getByText('CPR')).toBeInTheDocument()
    expect(screen.getByText('First Aid')).toBeInTheDocument()
  })

  it('renders months of service and no certifications for a recently hired non-trainer', () => {
    const recentHireDate = new Date()
    recentHireDate.setMonth(recentHireDate.getMonth() - 2)

    const employeeWithoutCerts: User = {
      id: 'u-recent',
      name: 'Recent Hire',
      email: 'recent@example.com',
      role: 'employee',
      department: 'Operations',
      certifications: [],
      hireDate: recentHireDate.toISOString(),
    }

    render(
      <TrainerProfileView
        user={employeeWithoutCerts}
        sessions={[]}
        courses={[]}
        enrollments={[]}
      />
    )

    expect(screen.getByText(/months/i)).toBeInTheDocument()
    expect(screen.getByText(/no certifications/i)).toBeInTheDocument()
  })

  it('renders expired and expiring certification statuses with renewal badge', () => {
    mockCalculateCertificationStatus.mockImplementation((cert: CertificationRecord) => {
      if (cert.certificationName === 'Expired Cert') return 'expired'
      if (cert.certificationName === 'Expiring Cert') return 'expiring-soon'
      return 'active'
    })

    const trainerWithMixedStatuses: User = {
      ...trainerUser,
      trainerProfile: {
        ...trainerUser.trainerProfile!,
        certificationRecords: [
          {
            certificationName: 'Expired Cert',
            issuedDate: '2024-01-01',
            expirationDate: '2024-06-01',
            status: 'expired',
            renewalRequired: true,
            renewalInProgress: true,
            remindersSent: 2,
          },
          {
            certificationName: 'Expiring Cert',
            issuedDate: '2025-01-01',
            expirationDate: '2099-01-10',
            status: 'active',
            renewalRequired: true,
            remindersSent: 1,
          },
          {
            certificationName: 'Active Cert',
            issuedDate: '2025-01-01',
            expirationDate: '2099-12-31',
            status: 'active',
            renewalRequired: false,
            remindersSent: 0,
          },
        ],
      },
    }

    render(
      <TrainerProfileView
        user={trainerWithMixedStatuses}
        sessions={sessions}
        courses={courses}
        enrollments={[]}
        onUpdateUser={vi.fn()}
      />
    )

    expect(screen.getByText(/renewal/i)).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.getByText(/d left/i)).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders empty trainer sections and hides additional information when optional fields are absent', () => {
    const trainerWithEmptySections: User = {
      ...trainerUser,
      certifications: [],
      trainerProfile: {
        ...trainerUser.trainerProfile!,
        shiftSchedules: [],
        authorizedRoles: [],
        specializations: [],
        maxWeeklyHours: undefined,
        preferredLocation: undefined,
        notes: undefined,
        certificationRecords: [],
      },
    }

    render(
      <TrainerProfileView
        user={trainerWithEmptySections}
        sessions={sessions}
        courses={courses}
        enrollments={[]}
        onUpdateUser={vi.fn()}
      />
    )

    expect(screen.getByText(/no shift schedules configured/i)).toBeInTheDocument()
    expect(screen.getByText(/no authorized roles configured/i)).toBeInTheDocument()
    expect(screen.getByText(/no certifications/i)).toBeInTheDocument()
    expect(screen.queryByText(/additional information/i)).not.toBeInTheDocument()
  })

  it('shows additional information when only preferred location is configured', () => {
    const trainerWithLocationOnly: User = {
      ...trainerUser,
      trainerProfile: {
        ...trainerUser.trainerProfile!,
        maxWeeklyHours: undefined,
        preferredLocation: 'Plant B',
        notes: undefined,
      },
    }

    render(
      <TrainerProfileView
        user={trainerWithLocationOnly}
        sessions={sessions}
        courses={courses}
        enrollments={[]}
      />
    )

    expect(screen.getByText(/additional information/i)).toBeInTheDocument()
    expect(screen.getByText(/preferred location/i)).toBeInTheDocument()
    expect(screen.getByText(/plant b/i)).toBeInTheDocument()
  })

  it('shows additional information when only notes are configured', () => {
    const trainerWithNotesOnly: User = {
      ...trainerUser,
      trainerProfile: {
        ...trainerUser.trainerProfile!,
        maxWeeklyHours: undefined,
        preferredLocation: undefined,
        notes: 'Needs ergonomic chair setup',
      },
    }

    render(
      <TrainerProfileView
        user={trainerWithNotesOnly}
        sessions={sessions}
        courses={courses}
        enrollments={[]}
      />
    )

    expect(screen.getByText(/additional information/i)).toBeInTheDocument()
    expect(screen.getByText(/notes/i)).toBeInTheDocument()
    expect(screen.getByText(/needs ergonomic chair setup/i)).toBeInTheDocument()
  })

  it('passes an empty certification array to manage dialog when trainer profile is missing', async () => {
    const user = userEvent.setup()
    const onUpdateUser = vi.fn()
    const trainerWithoutProfile: User = {
      id: 'u-no-profile',
      name: 'No Profile Trainer',
      email: 'no-profile@example.com',
      role: 'trainer',
      department: 'Training',
      certifications: ['Orientation'],
      hireDate: '2023-01-01T00:00:00.000Z',
    }

    render(
      <TrainerProfileView
        user={trainerWithoutProfile}
        sessions={[]}
        courses={[]}
        enrollments={[]}
        onUpdateUser={onUpdateUser}
      />
    )

    await user.click(screen.getByRole('button', { name: /manage/i }))
    await user.click(screen.getByRole('button', { name: /save certifications/i }))

    const updatedUser = onUpdateUser.mock.calls[0][0]
    expect(updatedUser.trainerProfile.certificationRecords).toHaveLength(1)
    expect(updatedUser.trainerProfile.certificationRecords[0]).toEqual(
      expect.objectContaining({ certificationName: 'First Aid' })
    )
  })
})
