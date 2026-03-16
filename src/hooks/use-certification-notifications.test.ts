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

function createTrainer(id: string, certRecord: CertificationRecord | CertificationRecord[]): User {
    const certificationRecords = Array.isArray(certRecord) ? certRecord : [certRecord]

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
            certificationRecords
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
        expect(updated[0]).toBeDefined()
        expect(updated[0].trainerProfile).toBeDefined()
        expect(updated[0].trainerProfile?.certificationRecords).toBeDefined()
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

    it('includes the 90-day boundary and increments remindersSent on first notice', () => {
        const cert = createCertRecord(90, 0)
        const trainer = createTrainer('trainer-90', cert)
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).toHaveBeenCalledTimes(2)
        expect(onCreateNotification).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                metadata: expect.objectContaining({ remindersSent: 1 })
            })
        )
        expect(onCreateNotification).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                metadata: expect.objectContaining({ remindersSent: 1 })
            })
        )
        expect(onUpdateUsers).toHaveBeenCalledOnce()
    })

    it('includes the 60-day boundary when one reminder has already been sent', () => {
        const cert = createCertRecord(60, 1)
        const trainer = createTrainer('trainer-60', cert)
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).toHaveBeenCalledTimes(2)
        expect(onCreateNotification).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                metadata: expect.objectContaining({ remindersSent: 2 })
            })
        )
        expect(onCreateNotification).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                metadata: expect.objectContaining({ remindersSent: 2 })
            })
        )
        expect(onUpdateUsers).toHaveBeenCalledOnce()
    })

    it('includes the 30-day boundary when two reminders have already been sent', () => {
        const cert = createCertRecord(30, 2)
        const trainer = createTrainer('trainer-30', cert)
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).toHaveBeenCalledTimes(2)
        expect(onCreateNotification).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                metadata: expect.objectContaining({ remindersSent: 3 })
            })
        )
        expect(onCreateNotification).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                metadata: expect.objectContaining({ remindersSent: 3 })
            })
        )
        expect(onUpdateUsers).toHaveBeenCalledOnce()
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

    it('skips notification when last reminder was exactly 7 days ago', () => {
        const cert: CertificationRecord = {
            ...createCertRecord(45, 1),
            lastReminderDate: new Date(SYSTEM_TIME.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }
        const trainer = createTrainer('trainer-1', cert)
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).not.toHaveBeenCalled()
        expect(onUpdateUsers).not.toHaveBeenCalled()
    })

    it('sends notification when last reminder was 8 days ago', () => {
        const cert: CertificationRecord = {
            ...createCertRecord(45, 1),
            lastReminderDate: new Date(SYSTEM_TIME.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString()
        }
        const trainer = createTrainer('trainer-1', cert)
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).toHaveBeenCalledTimes(2)
        expect(onUpdateUsers).toHaveBeenCalledOnce()
    })

    it('handles multiple trainers and only updates users with eligible certifications', () => {
        const eligibleTrainer = createTrainer('trainer-eligible', createCertRecord(45, 0))
        const farExpiryTrainer = createTrainer('trainer-far', createCertRecord(120, 0))
        const recentReminderTrainer = createTrainer('trainer-recent', {
            ...createCertRecord(45, 1),
            lastReminderDate: new Date(SYSTEM_TIME.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        })
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications(
            [eligibleTrainer, farExpiryTrainer, recentReminderTrainer],
            onCreateNotification,
            onUpdateUsers
        ))

        expect(onCreateNotification).toHaveBeenCalledTimes(2)
        const payloads = vi.mocked(onCreateNotification).mock.calls.map((call) => call[0] as Omit<Notification, 'id' | 'createdAt'>)
        expect(payloads.every((payload) => payload.message.includes(eligibleTrainer.name) || payload.userId === eligibleTrainer.id || payload.userId === 'admin')).toBe(true)

        expect(onUpdateUsers).toHaveBeenCalledOnce()
        const updatedUsers = vi.mocked(onUpdateUsers).mock.calls[0][0] as User[]
        const updatedEligible = updatedUsers.find((user) => user.id === eligibleTrainer.id)
        const updatedFar = updatedUsers.find((user) => user.id === farExpiryTrainer.id)
        const updatedRecent = updatedUsers.find((user) => user.id === recentReminderTrainer.id)
        expect(updatedEligible?.trainerProfile?.certificationRecords?.[0].remindersSent).toBe(1)
        expect(updatedFar?.trainerProfile?.certificationRecords?.[0].remindersSent).toBe(0)
        expect(updatedRecent?.trainerProfile?.certificationRecords?.[0].remindersSent).toBe(1)
    })

    it('notifies only eligible records when one trainer has multiple certifications', () => {
        const records: CertificationRecord[] = [
            createCertRecord(45, 0),
            createCertRecord(140, 0),
            createCertRecord(25, 3),
        ]
        const trainer = createTrainer('trainer-multi', records)
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).toHaveBeenCalledTimes(2)
        expect(onUpdateUsers).toHaveBeenCalledOnce()

        const updated = vi.mocked(onUpdateUsers).mock.calls[0][0] as User[]
        const updatedRecords = updated[0].trainerProfile?.certificationRecords
        expect(updatedRecords).toBeDefined()
        expect(updatedRecords?.[0].remindersSent).toBe(1)
        expect(updatedRecords?.[1].remindersSent).toBe(0)
        expect(updatedRecords?.[2].remindersSent).toBe(3)
    })

    it('skips certifications with renewalInProgress set to true', () => {
        const renewingTrainer = createTrainer('trainer-renewing', {
            ...createCertRecord(45, 0),
            renewalInProgress: true,
        })
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([renewingTrainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).not.toHaveBeenCalled()
        expect(onUpdateUsers).not.toHaveBeenCalled()
    })
})
