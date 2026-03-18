import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CertificationRecord, Notification, User } from '@/lib/types'
import * as certificationTracker from '@/lib/certification-tracker'

import { useCertificationNotifications } from './use-certification-notifications'

const SYSTEM_TIME = new Date('2026-03-16T10:00:00.000Z')

function expiresIn(days: number): string {
    const d = new Date(SYSTEM_TIME)
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
}

function daysAgoIso(days: number): string {
    return new Date(SYSTEM_TIME.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function createCertRecord(daysUntilExpiry: number, remindersSent = 0): CertificationRecord {
    return {
        certificationName: 'Forklift Safety',
        issuedDate: '2025-01-01',
        expirationDate: (() => {
            const d = new Date(SYSTEM_TIME)
            d.setDate(d.getDate() + daysUntilExpiry)
            return d.toISOString()
        })(),
        status: daysUntilExpiry <= 30 ? 'expiring-soon' : 'active',
        renewalRequired: true,
        remindersSent,
        renewalInProgress: false
    }
}

function createExactCertRecord(daysUntilExpiry: number, remindersSent = 0): CertificationRecord {
    const expirationDate = new Date(SYSTEM_TIME)
    expirationDate.setDate(expirationDate.getDate() + daysUntilExpiry)

    return {
        ...createCertRecord(daysUntilExpiry, remindersSent),
        expirationDate: expirationDate.toISOString(),
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
            lastReminderDate: daysAgoIso(3)
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
            lastReminderDate: daysAgoIso(7)
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
            lastReminderDate: daysAgoIso(8)
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
            lastReminderDate: daysAgoIso(2),
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
        expect(payloads).toHaveLength(2)
        expect(payloads.some(p => p.userId === eligibleTrainer.id)).toBe(true)
        expect(payloads.some(p => p.userId === 'admin')).toBe(true)
        expect(payloads.some(p => p.message.includes(eligibleTrainer.name))).toBe(true)

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

    it('uses reminder thresholds correctly between the 60-day and 30-day windows', () => {
        const sixtyOneDaysTrainer = createTrainer('trainer-61-days', createExactCertRecord(61, 1))
        const fiftyNineDaysTrainer = createTrainer('trainer-59-days', createExactCertRecord(59, 1))
        const thirtyOneDaysTrainer = createTrainer('trainer-31-days', createExactCertRecord(31, 2))
        const twentyNineDaysTrainer = createTrainer('trainer-29-days', createExactCertRecord(29, 2))
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications(
            [sixtyOneDaysTrainer, fiftyNineDaysTrainer, thirtyOneDaysTrainer, twentyNineDaysTrainer],
            onCreateNotification,
            onUpdateUsers
        ))

        expect(onCreateNotification).toHaveBeenCalledTimes(4)
        const payloads = vi.mocked(onCreateNotification).mock.calls.map((call) => call[0] as Omit<Notification, 'id' | 'createdAt'>)
        expect(payloads.some((payload) => payload.userId === fiftyNineDaysTrainer.id)).toBe(true)
        expect(payloads.some((payload) => payload.userId === twentyNineDaysTrainer.id)).toBe(true)
        expect(payloads.some((payload) => payload.userId === sixtyOneDaysTrainer.id)).toBe(false)
        expect(payloads.some((payload) => payload.userId === thirtyOneDaysTrainer.id)).toBe(false)

        expect(onUpdateUsers).toHaveBeenCalledOnce()
        const updatedUsers = vi.mocked(onUpdateUsers).mock.calls[0][0] as User[]
        const updated61 = updatedUsers.find((user) => user.id === sixtyOneDaysTrainer.id)
        const updated59 = updatedUsers.find((user) => user.id === fiftyNineDaysTrainer.id)
        const updated31 = updatedUsers.find((user) => user.id === thirtyOneDaysTrainer.id)
        const updated29 = updatedUsers.find((user) => user.id === twentyNineDaysTrainer.id)
        expect(updated61?.trainerProfile?.certificationRecords?.[0].remindersSent).toBe(1)
        expect(updated59?.trainerProfile?.certificationRecords?.[0].remindersSent).toBe(2)
        expect(updated31?.trainerProfile?.certificationRecords?.[0].remindersSent).toBe(2)
        expect(updated29?.trainerProfile?.certificationRecords?.[0].remindersSent).toBe(3)
    })

    it('skips expired certifications even when they are included in the expiring list', () => {
        const expiredTrainer = createTrainer('trainer-expired', createCertRecord(-2, 0))
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([expiredTrainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).not.toHaveBeenCalled()
        expect(onUpdateUsers).not.toHaveBeenCalled()
    })

    it('notifies at 90 days and skips at 91 and 92 days', () => {
        const trainer90 = createTrainer('trainer-90-days', createExactCertRecord(90, 0))
        const trainer91 = createTrainer('trainer-91-days', createExactCertRecord(91, 0))
        const trainer92 = createTrainer('trainer-92-days', createExactCertRecord(92, 0))
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications(
            [trainer90, trainer91, trainer92],
            onCreateNotification,
            onUpdateUsers
        ))

        expect(onCreateNotification).toHaveBeenCalledTimes(2)
        const payloads = vi.mocked(onCreateNotification).mock.calls.map((call) => call[0] as Omit<Notification, 'id' | 'createdAt'>)
        expect(payloads.some((payload) => payload.userId === trainer90.id)).toBe(true)
        expect(payloads.some((payload) => payload.userId === trainer91.id)).toBe(false)
        expect(payloads.some((payload) => payload.userId === trainer92.id)).toBe(false)

        expect(onUpdateUsers).toHaveBeenCalledOnce()
        const updatedUsers = vi.mocked(onUpdateUsers).mock.calls[0][0] as User[]
        const updated90 = updatedUsers.find((user) => user.id === trainer90.id)
        const updated91 = updatedUsers.find((user) => user.id === trainer91.id)
        const updated92 = updatedUsers.find((user) => user.id === trainer92.id)
        expect(updated90?.trainerProfile?.certificationRecords?.[0].remindersSent).toBe(1)
        expect(updated91?.trainerProfile?.certificationRecords?.[0].remindersSent).toBe(0)
        expect(updated92?.trainerProfile?.certificationRecords?.[0].remindersSent).toBe(0)
    })

    it('skips otherwise eligible certifications when renewal is already in progress', () => {
        const inProgressTrainer = createTrainer('trainer-renewal-in-progress', {
            ...createCertRecord(59, 1),
            renewalInProgress: true,
        })
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([inProgressTrainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).not.toHaveBeenCalled()
        expect(onUpdateUsers).not.toHaveBeenCalled()
    })

    it('defaults missing remindersSent to zero when calculating the next reminder count', () => {
        const missingRemindersSentRecord = {
            ...createExactCertRecord(5, 0),
            remindersSent: undefined,
        } as CertificationRecord
        const trainer = createTrainer('trainer-undefined-reminders', missingRemindersSentRecord)
        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).toHaveBeenCalledTimes(2)
        const payloads = vi.mocked(onCreateNotification).mock.calls.map((call) => call[0] as Omit<Notification, 'id' | 'createdAt'>)
        expect(payloads.every((payload) => payload.metadata?.remindersSent === 1)).toBe(true)

        expect(onUpdateUsers).toHaveBeenCalledOnce()
        const updatedUsers = vi.mocked(onUpdateUsers).mock.calls[0][0] as User[]
        expect(updatedUsers[0].trainerProfile?.certificationRecords?.[0].remindersSent).toBe(1)
    })

    it('does not mutate the original user objects or their certification records', () => {
        const cert = createCertRecord(45, 0)
        const trainer = createTrainer('trainer-clone', cert)
        const inputUsers = [trainer]
        const originalCertRef = trainer.trainerProfile!.certificationRecords![0]
        const originalRemindersSent = originalCertRef.remindersSent
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications(inputUsers, vi.fn(), onUpdateUsers))

        // The original certification record object must not have been modified
        expect(originalCertRef.remindersSent).toBe(originalRemindersSent)

        // The array and objects passed to onUpdateUsers are new (not the originals)
        const updatedUsers = vi.mocked(onUpdateUsers).mock.calls[0][0] as User[]
        expect(updatedUsers).not.toBe(inputUsers)
        expect(updatedUsers[0]).not.toBe(trainer)
        expect(updatedUsers[0].trainerProfile!.certificationRecords![0]).not.toBe(originalCertRef)
    })

    it('safely skips mocked alerts when a trainer profile has undefined certificationRecords', () => {
        const trainer = createTrainer('trainer-no-records', createCertRecord(45, 0))
        trainer.trainerProfile = {
            ...trainer.trainerProfile!,
            certificationRecords: undefined,
        }

        const expiringSpy = vi.spyOn(certificationTracker, 'getExpiringCertifications').mockReturnValue([
            {
                userId: trainer.id,
                userName: trainer.name,
                certification: createCertRecord(10, 0),
                daysUntilExpiration: 10,
                urgency: 'high',
            },
        ])

        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).not.toHaveBeenCalled()
        expect(onUpdateUsers).not.toHaveBeenCalled()

        expiringSpy.mockRestore()
    })

    it('safely skips mocked alerts when trainerProfile is missing entirely', () => {
        const trainerWithoutProfile: User = {
            id: 'trainer-no-profile',
            name: 'No Profile Trainer',
            email: 'no-profile@example.com',
            role: 'trainer',
            department: 'Operations',
            certifications: [],
            hireDate: '2020-01-01T00:00:00.000Z',
        }

        const expiringSpy = vi.spyOn(certificationTracker, 'getExpiringCertifications').mockReturnValue([
            {
                userId: trainerWithoutProfile.id,
                userName: trainerWithoutProfile.name,
                certification: createCertRecord(10, 0),
                daysUntilExpiration: 10,
                urgency: 'high',
            },
        ])

        const onCreateNotification = vi.fn()
        const onUpdateUsers = vi.fn()

        renderHook(() => useCertificationNotifications([trainerWithoutProfile], onCreateNotification, onUpdateUsers))

        expect(onCreateNotification).not.toHaveBeenCalled()
        expect(onUpdateUsers).not.toHaveBeenCalled()

        expiringSpy.mockRestore()
    })
})

it('emits no notifications when users array is empty', () => {
    const onCreateNotification = vi.fn()
    const onUpdateUsers = vi.fn()

    renderHook(() => useCertificationNotifications([], onCreateNotification, onUpdateUsers))

    expect(onCreateNotification).not.toHaveBeenCalled()
    expect(onUpdateUsers).not.toHaveBeenCalled()
})

it('ignores users without a trainerProfile without crashing', () => {
    const userWithoutProfile: User = {
        id: 'no-profile',
        name: 'No Profile User',
        email: 'no-profile@example.com',
        role: 'trainer',
        department: 'Operations',
        certifications: [],
        hireDate: '2020-01-01T00:00:00.000Z',
    }
    const onCreateNotification = vi.fn()
    const onUpdateUsers = vi.fn()

    renderHook(() => useCertificationNotifications([userWithoutProfile], onCreateNotification, onUpdateUsers))

    expect(onCreateNotification).not.toHaveBeenCalled()
    expect(onUpdateUsers).not.toHaveBeenCalled()
})

it('updates notifications when users array is updated via rerender', () => {
    const eligibleUser = createTrainer('trainer-eligible', createCertRecord(45, 0))
    const onCreateNotification = vi.fn()
    const onUpdateUsers = vi.fn()

    const { rerender } = renderHook(
        ({ users }: { users: User[] }) => useCertificationNotifications(users, onCreateNotification, onUpdateUsers),
        { initialProps: { users: [] as User[] } }
    )

    expect(onCreateNotification).not.toHaveBeenCalled()

    rerender({ users: [eligibleUser] })

    expect(onCreateNotification).toHaveBeenCalledTimes(2)
    expect(onUpdateUsers).toHaveBeenCalledOnce()
})

it('re-runs checkAndNotify when the 24-hour interval fires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(SYSTEM_TIME)
    const cert = createCertRecord(45, 0)
    const trainer = createTrainer('trainer-interval', cert)
    const onCreateNotification = vi.fn()
    const onUpdateUsers = vi.fn()

    renderHook(() => useCertificationNotifications([trainer], onCreateNotification, onUpdateUsers))

    // Initial mount fires checkAndNotify
    expect(onCreateNotification).toHaveBeenCalledTimes(2)
    onCreateNotification.mockClear()

    // Advance the clock by 24 hours to trigger the interval
    act(() => {
        vi.advanceTimersByTime(24 * 60 * 60 * 1000)
    })

    // The interval callback fires checkAndNotify with usersRef.current (original users)
    expect(onCreateNotification).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
})
