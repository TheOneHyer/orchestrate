import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TrainerProfileDialog } from './TrainerProfileDialog'
import type { CertificationRecord, User } from '@/lib/types'
import { calculateCertificationStatus } from '@/lib/certification-tracker'

vi.mock('@/lib/certification-tracker', () => ({
    calculateCertificationStatus: vi.fn(() => 'active'),
}))

vi.mock('@/components/ManageCertificationsDialog', () => ({
    ManageCertificationsDialog: ({
        open,
        certifications,
        onSave,
    }: {
        open: boolean
        certifications: CertificationRecord[]
        onSave: (records: CertificationRecord[]) => void
    }) =>
        open ? (
            <div>
                <button
                    onClick={() =>
                        onSave([
                            ...certifications,
                            {
                                certificationName: 'First Aid',
                                issuedDate: '2026-01-01T00:00:00.000Z',
                                expirationDate: '2027-01-01T00:00:00.000Z',
                                status: 'active',
                                renewalRequired: false,
                                remindersSent: 0,
                            },
                        ])
                    }
                >
                    Mock Save Certifications
                </button>
            </div>
        ) : null,
}))

function makeTrainer(overrides: Partial<User> = {}): User {
    return {
        id: 'trainer-1',
        name: 'Taylor Trainer',
        email: 'taylor@example.com',
        role: 'trainer',
        department: 'Operations',
        certifications: ['Safety'],
        hireDate: '2024-01-01T00:00:00.000Z',
        ...overrides,
    }
}

function makeTrainerWithCertification(record: CertificationRecord): User {
    return makeTrainer({
        trainerProfile: {
            authorizedRoles: ['trainer'],
            shiftSchedules: [],
            tenure: {
                hireDate: '2024-01-01T00:00:00.000Z',
                yearsOfService: 2,
                monthsOfService: 24,
            },
            specializations: [],
            certificationRecords: [record],
        },
    })
}

describe('TrainerProfileDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('initializes trainer profile when missing and renders core sections', async () => {
        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
            />
        )

        expect(await screen.findByText(/tenure information/i)).toBeInTheDocument()
        expect(screen.getAllByText(/shift schedules/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/authorized teaching roles/i).length).toBeGreaterThan(0)
    })

    it('recalculates weekly hours for overnight schedule updates', async () => {
        const user = userEvent.setup()

        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
            />
        )

        await user.click(await screen.findByRole('button', { name: /add schedule/i }))

        const startInput = screen.getByLabelText(/schedule 1 start time/i)
        const endInput = screen.getByLabelText(/schedule 1 end time/i)

        expect(startInput).toBeInTheDocument()
        expect(endInput).toBeInTheDocument()

        await user.clear(startInput)
        await user.type(startInput, '22:00')
        await user.clear(endInput)
        await user.type(endInput, '02:00')

        expect(screen.getByText(/20 hours\/week/i)).toBeInTheDocument()
    })

    it('updates certification records through the manage certifications flow', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 })

        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
            />
        )

        await user.click(await screen.findByRole('button', { name: /manage certifications/i }))
        await user.click(await screen.findByText(/mock save certifications/i))

        expect(screen.getByText('First Aid')).toBeInTheDocument()
        expect(screen.getByText(/active/i)).toBeInTheDocument()
    })

    it('saves role and specialization updates', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        const onOpenChange = vi.fn()

        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={onOpenChange}
                onSave={onSave}
            />
        )

        const roleInput = await screen.findByPlaceholderText(/add authorized role/i)
        await user.type(roleInput, 'Safety Instructor')
        await user.click(screen.getByRole('button', { name: /add role/i }))

        const specializationInput = screen.getByPlaceholderText(/add specialization/i)
        await user.type(specializationInput, 'Incident Response')
        await user.click(screen.getByRole('button', { name: /add specialization/i }))

        await user.click(screen.getByRole('button', { name: /save changes/i }))

        expect(onSave).toHaveBeenCalledOnce()
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                trainerProfile: expect.objectContaining({
                    authorizedRoles: expect.arrayContaining(['Safety Instructor']),
                    specializations: expect.arrayContaining(['Incident Response']),
                }),
            })
        )
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('adds authorized role and specialization with Enter key', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
            />
        )

        const roleInput = await screen.findByPlaceholderText(/add authorized role/i)
        await user.type(roleInput, 'HazMat Instructor{Enter}')

        const specializationInput = screen.getByPlaceholderText(/add specialization/i)
        await user.type(specializationInput, 'Warehouse Safety{Enter}')

        await user.click(screen.getByRole('button', { name: /save changes/i }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                trainerProfile: expect.objectContaining({
                    authorizedRoles: expect.arrayContaining(['HazMat Instructor']),
                    specializations: expect.arrayContaining(['Warehouse Safety']),
                }),
            })
        )
    })

    it('ignores blank authorized role and specialization input submissions', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
            />
        )

        const roleInput = await screen.findByPlaceholderText(/add authorized role/i)
        await user.type(roleInput, '   ')
        await user.click(screen.getByRole('button', { name: /add role/i }))

        const specializationInput = screen.getByPlaceholderText(/add specialization/i)
        await user.type(specializationInput, '   ')
        await user.click(screen.getByRole('button', { name: /add specialization/i }))

        await user.click(screen.getByRole('button', { name: /save changes/i }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                trainerProfile: expect.objectContaining({
                    authorizedRoles: [],
                    specializations: [],
                }),
            })
        )
    })

    it('removes role and specialization badges before save', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
            />
        )

        const roleInput = await screen.findByPlaceholderText(/add authorized role/i)
        await user.type(roleInput, 'Safety Instructor')
        await user.click(screen.getByRole('button', { name: /add role/i }))

        const specializationInput = screen.getByPlaceholderText(/add specialization/i)
        await user.type(specializationInput, 'Incident Response')
        await user.click(screen.getByRole('button', { name: /add specialization/i }))

        const roleBadge = screen.getByText('Safety Instructor').closest('[data-slot="badge"]')
        if (!(roleBadge instanceof HTMLElement)) {
            throw new Error('Role badge was not found')
        }

        const specBadge = screen.getByText('Incident Response').closest('[data-slot="badge"]')
        if (!(specBadge instanceof HTMLElement)) {
            throw new Error('Specialization badge was not found')
        }

        await user.click(within(roleBadge).getByRole('button', { name: /remove authorized role safety instructor/i }))
        await user.click(within(specBadge).getByRole('button', { name: /remove specialization incident response/i }))
        await user.click(screen.getByRole('button', { name: /save changes/i }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                trainerProfile: expect.objectContaining({
                    authorizedRoles: [],
                    specializations: [],
                }),
            })
        )
    })

    it('saves optional max hours, preferred location, and notes fields', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
            />
        )

        await user.type(await screen.findByPlaceholderText(/e\.g\., 40/i), '36')
        await user.type(screen.getByPlaceholderText(/building a, room 101/i), 'Building C, Room 204')
        await user.type(screen.getByPlaceholderText(/additional notes about this trainer/i), 'Prefers morning cohorts.')
        await user.click(screen.getByRole('button', { name: /save changes/i }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                trainerProfile: expect.objectContaining({
                    maxWeeklyHours: 36,
                    preferredLocation: 'Building C, Room 204',
                    notes: 'Prefers morning cohorts.',
                }),
            })
        )
    })

    it('clears max weekly hours to undefined when input is emptied', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(
            <TrainerProfileDialog
                user={makeTrainer({
                    trainerProfile: {
                        authorizedRoles: [],
                        shiftSchedules: [],
                        tenure: {
                            hireDate: '2024-01-01T00:00:00.000Z',
                            yearsOfService: 2,
                            monthsOfService: 24,
                        },
                        specializations: [],
                        maxWeeklyHours: 40,
                    },
                })}
                open
                onOpenChange={vi.fn()}
                onSave={onSave}
            />
        )

        const maxHoursInput = await screen.findByPlaceholderText(/e\.g\., 40/i)
        await user.clear(maxHoursInput)
        await user.click(screen.getByRole('button', { name: /save changes/i }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                trainerProfile: expect.objectContaining({
                    maxWeeklyHours: undefined,
                }),
            })
        )
    })

    it('calls onOpenChange(false) when Cancel button is clicked', async () => {
        const user = userEvent.setup()
        const onOpenChange = vi.fn()

        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={onOpenChange}
                onSave={vi.fn()}
            />
        )

        await user.click(await screen.findByRole('button', { name: /cancel/i }))
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('updates shift code and toggles a working day', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 })

        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
            />
        )

        await user.click(await screen.findByRole('button', { name: /add schedule/i }))

        const shiftCodeInput = screen.getByPlaceholderText(/e\.g\., SHIFT-A/i)
        await user.clear(shiftCodeInput)
        await user.type(shiftCodeInput, 'DAY-SHIFT')
        expect(shiftCodeInput).toHaveValue('DAY-SHIFT')

        // Saturday starts unchecked (default daysWorked = Mon–Fri); toggle it on
        const saturdayCheckbox = await screen.findByRole('checkbox', { name: /^sat$/i })
        expect(saturdayCheckbox).toHaveAttribute('aria-checked', 'false')
        await user.click(saturdayCheckbox)
        expect(saturdayCheckbox).toHaveAttribute('aria-checked', 'true')
    })

    it('removes a shift schedule', async () => {
        const user = userEvent.setup()

        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
            />
        )

        await user.click(await screen.findByRole('button', { name: /add schedule/i }))
        expect(screen.getByPlaceholderText(/e\.g\., SHIFT-A/i)).toBeInTheDocument()

        // The remove (trash) button uses an accessible aria-label
        const removeBtn = screen.getByRole('button', { name: /^remove schedule/i })
        await user.click(removeBtn)

        expect(screen.queryByPlaceholderText(/e\.g\., SHIFT-A/i)).not.toBeInTheDocument()
        expect(screen.getByText(/no shift schedules configured/i)).toBeInTheDocument()
    })

    it('removes an already-selected working day from the schedule', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 })

        render(
            <TrainerProfileDialog
                user={makeTrainer()}
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
            />
        )

        await user.click(await screen.findByRole('button', { name: /add schedule/i }))

        const mondayCheckbox = await screen.findByRole('checkbox', { name: /^mon$/i })
        expect(mondayCheckbox).toHaveAttribute('aria-checked', 'true')
        await user.click(mondayCheckbox)
        expect(mondayCheckbox).toHaveAttribute('aria-checked', 'false')
    })

    it('renders status badge colors for expiring-soon, expired, and unknown statuses', () => {
        const cert: CertificationRecord = {
            certificationName: 'Forklift Safety',
            issuedDate: '2025-01-01T00:00:00.000Z',
            expirationDate: '2026-12-01T00:00:00.000Z',
            status: 'active',
            renewalRequired: true,
            remindersSent: 0,
        }

        vi.mocked(calculateCertificationStatus)
            .mockReturnValueOnce('expiring-soon')
            .mockReturnValueOnce('expired')
            .mockReturnValueOnce('unknown' as CertificationRecord['status'])

        const { rerender } = render(
            <TrainerProfileDialog
                user={makeTrainerWithCertification(cert)}
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
            />
        )

        const expiringBadge = screen.getByText(/d left/i)
        expect(expiringBadge).toHaveAttribute('data-status', 'expiring-soon')

        rerender(
            <TrainerProfileDialog
                user={makeTrainerWithCertification(cert)}
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
            />
        )
        const expiredBadge = screen.getByText(/^expired$/i)
        expect(expiredBadge).toHaveAttribute('data-status', 'expired')

        rerender(
            <TrainerProfileDialog
                user={makeTrainerWithCertification(cert)}
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
            />
        )
        const unknownBadge = screen.getByText(/^Active$|^Expired$|^.*d left$|^Unknown$/)
        expect(unknownBadge).toHaveAttribute('data-status', 'unknown')
    })

    it('renders renewal in progress badge for certification records marked in progress', () => {
        const cert: CertificationRecord = {
            certificationName: 'Forklift Safety',
            issuedDate: '2025-01-01T00:00:00.000Z',
            expirationDate: '2026-12-01T00:00:00.000Z',
            status: 'active',
            renewalRequired: true,
            remindersSent: 0,
            renewalInProgress: true,
        }

        render(
            <TrainerProfileDialog
                user={makeTrainerWithCertification(cert)}
                open
                onOpenChange={vi.fn()}
                onSave={vi.fn()}
            />
        )

        expect(screen.getByText(/renewal in progress/i, { selector: 'span' })).toBeInTheDocument()
    })
})
