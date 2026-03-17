import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, formatISO } from 'date-fns'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CertificationDashboard } from './CertificationDashboard'
import type { CertificationRecord, User } from '@/lib/types'

const addCertificationDialogSpy = vi.fn()
const TEST_NOW = new Date('2026-03-16T00:00:00.000Z')

type AddCertificationDialogProps = {
    users: User[]
    onAddCertification: (trainerIds: string[], certification: Omit<CertificationRecord, 'status' | 'renewalRequired' | 'remindersSent'>) => void
}

vi.mock('@/components/AddCertificationDialog', () => ({
    AddCertificationDialog: ({ users, onAddCertification }: AddCertificationDialogProps) => {
        addCertificationDialogSpy(users)
        return (
            <button
                onClick={() =>
                    onAddCertification(['trainer-1'], {
                        certificationName: 'CPR',
                        issuedDate: '2025-01-01',
                        expirationDate: '2027-01-01',
                    })
                }
            >
                Mock Add Certification
            </button>
        )
    },
}))

function createTrainer(overrides: Partial<User> = {}, certificationRecords: CertificationRecord[] = []): User {
    return {
        id: 'trainer-default',
        name: 'Default Trainer',
        email: 'trainer@example.com',
        role: 'trainer',
        department: 'Training',
        certifications: [],
        hireDate: '2024-01-01',
        trainerProfile: {
            authorizedRoles: [],
            shiftSchedules: [],
            tenure: { hireDate: '2024-01-01', yearsOfService: 2, monthsOfService: 24 },
            specializations: [],
            certificationRecords,
        },
        ...overrides,
    }
}

function createRecord(overrides: Partial<CertificationRecord> = {}): CertificationRecord {
    return {
        certificationName: 'Safety',
        issuedDate: '2025-01-01',
        expirationDate: formatISO(addDays(TEST_NOW, 120)),
        status: 'active',
        renewalRequired: false,
        remindersSent: 0,
        ...overrides,
    }
}

describe('CertificationDashboard', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(TEST_NOW)
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders summary metrics for certifications', () => {
        const users: User[] = [
            createTrainer(
                { id: 'trainer-1', name: 'Trainer One', email: 't1@example.com' },
                [
                    createRecord({ certificationName: 'Active Cert', expirationDate: '2026-09-01T00:00:00.000Z' }),
                    createRecord({ certificationName: 'Expiring Cert', expirationDate: '2026-03-25T00:00:00.000Z' }),
                    createRecord({ certificationName: 'Expired Cert', expirationDate: '2026-03-10T00:00:00.000Z' }),
                ]
            ),
            createTrainer(
                { id: 'trainer-2', name: 'Trainer Two', email: 't2@example.com' },
                [
                    createRecord({ certificationName: 'Active Cert 2', expirationDate: '2026-11-01T00:00:00.000Z' }),
                    createRecord({ certificationName: 'Expiring Cert 2', expirationDate: '2026-04-10T00:00:00.000Z' }),
                ]
            ),
        ]

        render(
            <CertificationDashboard
                users={users}
                onNavigate={vi.fn()}
                onAddCertification={vi.fn()}
            />
        )

        const totalCard = screen.getByTestId('total-card')
        const activeCard = screen.getByTestId('active-card')
        const expiringCard = screen.getByTestId('expiring-card')
        const expiredCard = screen.getByTestId('expired-card')
        const complianceCard = screen.getByTestId('compliance-card')

        expect(within(totalCard).getByText('5')).toBeInTheDocument()
        expect(within(activeCard).getByText('2')).toBeInTheDocument()
        expect(within(expiringCard).getByText('2')).toBeInTheDocument()
        expect(within(expiredCard).getByText('1')).toBeInTheDocument()
        expect(within(complianceCard).getByText('40%')).toBeInTheDocument()
    })

    it('renders critical and high-priority alert sections and navigates on alert click', async () => {
        const user = userEvent.setup({
            delay: null,
            advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
        })
        expect(user).toBeTruthy()
        const onNavigate = vi.fn()

        const users: User[] = [
            createTrainer(
                { id: 'trainer-critical', name: 'Critical Trainer', email: 'critical@example.com' },
                [createRecord({ certificationName: 'Forklift', expirationDate: '2026-03-20T00:00:00.000Z' })]
            ),
            createTrainer(
                { id: 'trainer-high', name: 'High Trainer', email: 'high@example.com' },
                [createRecord({ certificationName: 'CPR', expirationDate: '2026-04-08T00:00:00.000Z' })]
            ),
        ]

        render(
            <CertificationDashboard
                users={users}
                onNavigate={onNavigate}
                onAddCertification={vi.fn()}
            />
        )

        expect(screen.getByText(/critical alerts/i)).toBeInTheDocument()
        expect(screen.getByText(/high priority/i)).toBeInTheDocument()

        fireEvent.click(within(screen.getByTestId('critical-alert-trainer-critical')).getByText('Critical Trainer'))
        fireEvent.click(within(screen.getByTestId('high-alert-trainer-high')).getByText('High Trainer'))

        expect(onNavigate).toHaveBeenCalledWith('people', { userId: 'trainer-critical' })
        expect(onNavigate).toHaveBeenCalledWith('people', { userId: 'trainer-high' })
    })

    it('renders all trainer certifications with calculated statuses', () => {
        const users: User[] = [
            createTrainer(
                { id: 'trainer-1', name: 'Status Trainer', email: 'status@example.com' },
                [
                    createRecord({ certificationName: 'Expired Cert', expirationDate: '2026-03-01T00:00:00.000Z' }),
                    createRecord({ certificationName: 'Soon Cert', expirationDate: '2026-03-28T00:00:00.000Z', renewalInProgress: true }),
                    createRecord({ certificationName: 'Active Cert', expirationDate: '2026-08-01T00:00:00.000Z' }),
                ]
            ),
        ]

        render(
            <CertificationDashboard
                users={users}
                onNavigate={vi.fn()}
                onAddCertification={vi.fn()}
            />
        )

        expect(screen.getAllByText('Status Trainer')).toHaveLength(3)
        expect(screen.getAllByText('Expired Cert')).toHaveLength(2)
        expect(screen.getAllByText('Soon Cert')).toHaveLength(2)
        expect(screen.getAllByText('Active Cert')).toHaveLength(1)
        expect(screen.getAllByText('Expired')).toHaveLength(2)
        expect(screen.getByText(/d left/i)).toBeInTheDocument()
        expect(screen.getAllByText('Active')).toHaveLength(2)
        expect(screen.getByText(/renewal in progress/i)).toBeInTheDocument()
    })

    it('renders empty trainer certification state when there are no certification records', () => {
        render(
            <CertificationDashboard
                users={[createTrainer({ id: 'trainer-1', name: 'No Certs', email: 'nocerts@example.com' }, [])]}
                onNavigate={vi.fn()}
                onAddCertification={vi.fn()}
            />
        )

        expect(screen.getByText(/no certification records found/i)).toBeInTheDocument()
        expect(screen.getByText(/add certification records to trainer profiles/i)).toBeInTheDocument()
    })

    it('wires add certification callback through AddCertificationDialog', async () => {
        const user = userEvent.setup({
            delay: null,
            advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
        })
        expect(user).toBeTruthy()
        const onAddCertification = vi.fn()
        const users = [createTrainer({ id: 'trainer-1', name: 'Trainer One' }, [])]

        render(
            <CertificationDashboard
                users={users}
                onNavigate={vi.fn()}
                onAddCertification={onAddCertification}
            />
        )

        expect(addCertificationDialogSpy).toHaveBeenCalledWith(users)

        fireEvent.click(screen.getByRole('button', { name: /mock add certification/i }))

        expect(onAddCertification).toHaveBeenCalledWith(
            ['trainer-1'],
            expect.objectContaining({
                certificationName: 'CPR',
                issuedDate: '2025-01-01',
                expirationDate: '2027-01-01',
            })
        )
    })
})
