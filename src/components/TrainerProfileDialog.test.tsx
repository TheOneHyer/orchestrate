import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TrainerProfileDialog } from './TrainerProfileDialog'
import type { CertificationRecord, User } from '@/lib/types'

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
})
