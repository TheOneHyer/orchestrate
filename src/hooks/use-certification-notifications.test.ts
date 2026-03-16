import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CertificationRecord, Notification, User } from '@/lib/types'

import { useCertificationNotifications } from './use-certification-notifications'

const SYSTEM_TIME = new Date('2026-03-16T10:00:00.000Z')

function expiresIn(days: number): string {
    const d = new Date(SYSTEM_TIME)
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
}

function createCertRecord(daysUntilExpiry: number, remindersSent = 0): CertificationRecord {
    return {
        certificationName: 'Forklift Safety',
        issuedDate: '2025-01-01',
        expirationDate: expiresIn(daysUntilExpiry),
        status: daysUntilExpiry <= 30 ? 'expiring-soon' : 'active',
        renewalRequired: true,
        remindersSent,
        renewalInProgress: false
    }
}

function createTrainer(id: string, certRecord: CertificationRecord): User {
    return {
        id,
        name: `Trainer ${id}`,
        email: `${id}@example.com`,
        role: 'trainer',
        department: 'Operations',
        certifications: ['Forklift Safety'],
        hireDate: '2020-01-01T00:00:00.000Z',
        trainerProfile: {
            authorizedRoles: ['trainer'],
            shiftSchedules: [],
            tenure: { hireDate: '2020-01-01T00:00:00.000Z', yearsOfService: 6, monthsOfService: 72 },
            specializations: [],
            certificationRecords: [certRecord]
        }
    }
}

describe('use-certification-notifications', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(SYSTEM_TIME)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('emits trainer and admin notifications for an expiring certification with no prior reminders', () => {
        // 45 days → inside the 30-60 day window, remindersSent=0 qualifies (threshold is <=1)
        const cert = createCertRecord(45, 0)
        const trainer = createTrainer('trainer-1', cert)
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).toHaveBeenCalledTimes(2)
        const notifPayloads = vi.mocked(onCreateNotification).mock.calls.map(c => c[0] as Omit<Notification, 'id' | 'createdAt'>)
        expect(notifPayloads.some(n => n.userId === trainer.id)).toBe(true)
        expect(notifPayloads.some(n => n.userId === 'admin')).toBe(true)
    })

    it('increments remindersSent and calls onUpdateUsers when a notification is sent', () => {
        const cert = createCertRecord(45, 0)
        const trainer = createTrainer('trainer-1', cert)
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], vi.fn(), onUpdateUsers))

        expect(onUpdateUsers).toHaveBeenCalledOnce()
        const updated = vi.mocked(onUpdateUsers).mock.calls[0][0] as User[]
        const updatedCert = updated[0].trainerProfile!.certificationRecords![0]
        expect(updatedCert.remindersSent).toBe(1)
    })

    it('does not fire notifications when no certifications are within the 90-day window', () => {
        const cert = createCertRecord(120, 0) // more than 90 days away — not eligible
        const trainer = createTrainer('trainer-1', cert)
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).not.toHaveBeenCalled()
        expect(onUpdateUsers).not.toHaveBeenCalled()
    })

    it('skips notification when a reminder was already sent within 7 days', () => {
        const cert: CertificationRecord = {
            ...createCertRecord(45, 1),
            lastReminderDate: new Date(SYSTEM_TIME.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
        }
        const trainer = createTrainer('trainer-1', cert)
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).not.toHaveBeenCalled()
        expect(onUpdateUsers).not.toHaveBeenCalled()
    })
})
