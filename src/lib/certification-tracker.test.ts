import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    calculateCertificationStatus,
    generateCertificationNotification,
    getCertificationSummary,
    getExpiringCertifications,
    shouldSendRenewalReminder,
    updateCertificationRecords,
    type CertificationAlert,
} from './certification-tracker'
import type { CertificationRecord, User } from './types'

const SYSTEM_TIME = new Date('2026-03-16T12:00:00.000Z')

function isoInDays(daysFromNow: number): string {
    const date = new Date(SYSTEM_TIME)
    date.setUTCDate(date.getUTCDate() + daysFromNow)
    return date.toISOString()
}

function createCertification(overrides: Partial<CertificationRecord> = {}): CertificationRecord {
    return {
        certificationName: 'Forklift Operator',
        issuedDate: '2025-03-16T12:00:00.000Z',
        expirationDate: isoInDays(45),
        status: 'active',
        renewalRequired: true,
        remindersSent: 0,
        ...overrides,
    }
}

function createTrainerWithCerts(
    id: string,
    certifications: CertificationRecord[],
    overrides: Partial<User> = {}
): User {
    return {
        id,
        name: `Trainer ${id}`,
        email: `${id}@example.com`,
        role: 'trainer',
        department: 'Operations',
        certifications: ['Forklift Operator'],
        hireDate: '2020-01-01T00:00:00.000Z',
        trainerProfile: {
            authorizedRoles: [],
            shiftSchedules: [],
            tenure: {
                hireDate: '2020-01-01T00:00:00.000Z',
                yearsOfService: 6,
                monthsOfService: 72,
            },
            specializations: [],
            certificationRecords: certifications,
        },
        ...overrides,
    }
}

describe('certification-tracker', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(SYSTEM_TIME)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('calculates certification status at key expiration boundaries', () => {
        expect(calculateCertificationStatus(createCertification({ expirationDate: isoInDays(-1) }))).toBe('expired')
        expect(calculateCertificationStatus(createCertification({ expirationDate: isoInDays(0) }))).toBe('expiring-soon')
        expect(calculateCertificationStatus(createCertification({ expirationDate: isoInDays(30) }))).toBe('expiring-soon')
        expect(calculateCertificationStatus(createCertification({ expirationDate: isoInDays(31) }))).toBe('active')
    })

    it.each([
        ['first reminder in 61-90 day window', createCertification({ expirationDate: isoInDays(80), remindersSent: 0 }), true],
        ['second reminder allowed in 31-60 day window', createCertification({ expirationDate: isoInDays(45), remindersSent: 1 }), true],
        ['third reminder allowed in 15-30 day window', createCertification({ expirationDate: isoInDays(20), remindersSent: 2 }), true],
        ['fourth reminder allowed in 8-14 day window', createCertification({ expirationDate: isoInDays(10), remindersSent: 3 }), true],
        ['always reminds in last 7 days', createCertification({ expirationDate: isoInDays(5), remindersSent: 10 }), true],
        ['does not remind outside all windows', createCertification({ expirationDate: isoInDays(120), remindersSent: 0 }), false],
        ['does not remind after expiration', createCertification({ expirationDate: isoInDays(-3), remindersSent: 0 }), false],
        ['blocks reminder if sent less than 7 days ago', createCertification({ expirationDate: isoInDays(20), remindersSent: 0, lastReminderDate: isoInDays(-3) }), false],
        ['allows reminder if last reminder was at least 7 days ago', createCertification({ expirationDate: isoInDays(20), remindersSent: 0, lastReminderDate: isoInDays(-8) }), true],
    ])('shouldSendRenewalReminder: %s', (_label, cert, expected) => {
        expect(shouldSendRenewalReminder(cert)).toBe(expected)
    })

    it('collects and sorts expiring certification alerts with urgency', () => {
        const users: User[] = [
            createTrainerWithCerts('trainer-1', [
                createCertification({ certificationName: 'CPR', expirationDate: isoInDays(-1) }),
                createCertification({ certificationName: 'Safety', expirationDate: isoInDays(10) }),
                createCertification({ certificationName: 'Forklift Operator', expirationDate: isoInDays(45) }),
                createCertification({ certificationName: 'Lean Manufacturing', expirationDate: isoInDays(80) }),
                createCertification({ certificationName: 'Advanced Forklift', expirationDate: isoInDays(120) }),
            ]),
            {
                id: 'admin-1',
                name: 'Admin',
                email: 'admin@example.com',
                role: 'admin',
                department: 'Operations',
                certifications: [],
                hireDate: '2019-01-01T00:00:00.000Z',
            },
        ]

        const alerts = getExpiringCertifications(users)

        expect(alerts).toHaveLength(4)
        expect(alerts.map(alert => alert.daysUntilExpiration)).toEqual([-1, 10, 45, 80])
        expect(alerts.map(alert => alert.urgency)).toEqual(['critical', 'critical', 'medium', 'low'])
        expect(alerts[0].userId).toBe('trainer-1')
    })

    it('builds expired admin notification with critical priority', () => {
        const alert: CertificationAlert = {
            userId: 'trainer-1',
            userName: 'Taylor Trainer',
            certification: createCertification({ certificationName: 'CPR', expirationDate: isoInDays(-5) }),
            daysUntilExpiration: -5,
            urgency: 'critical',
        }

        const notification = generateCertificationNotification(alert, true)

        expect(notification).toMatchObject({
            userId: 'admin',
            type: 'reminder',
            priority: 'critical',
            read: false,
            link: '/people/trainer-1',
        })
        expect(notification.title).toContain("Taylor Trainer's CPR Certification Expired")
        expect(notification.message).toContain('expired 5 days ago')
    })

    it('builds expired trainer notification copy with renewal guidance', () => {
        const alert: CertificationAlert = {
            userId: 'trainer-1',
            userName: 'Taylor Trainer',
            certification: createCertification({ certificationName: 'CPR', expirationDate: isoInDays(-5) }),
            daysUntilExpiration: -5,
            urgency: 'critical',
        }

        const notification = generateCertificationNotification(alert, false)

        expect(notification.userId).toBe('trainer-1')
        expect(notification.title).toBe('Your CPR Certification Has Expired')
        expect(notification.message).toContain('Please renew immediately.')
    })

    it('builds same-day trainer notification with critical priority', () => {
        const alert: CertificationAlert = {
            userId: 'trainer-1',
            userName: 'Taylor Trainer',
            certification: createCertification({ certificationName: 'Safety', expirationDate: isoInDays(0) }),
            daysUntilExpiration: 0,
            urgency: 'critical',
        }

        const notification = generateCertificationNotification(alert, false)

        expect(notification).toMatchObject({
            userId: 'trainer-1',
            type: 'reminder',
            priority: 'critical',
            link: '/people',
        })
        expect(notification.title).toBe('Your Safety Certification Expires Today')
    })

    it('builds same-day admin notification with explicit trainer action text', () => {
        const alert: CertificationAlert = {
            userId: 'trainer-1',
            userName: 'Taylor Trainer',
            certification: createCertification({ certificationName: 'Safety', expirationDate: isoInDays(0) }),
            daysUntilExpiration: 0,
            urgency: 'critical',
        }

        const notification = generateCertificationNotification(alert, true)

        expect(notification.userId).toBe('admin')
        expect(notification.title).toBe("Taylor Trainer's Safety Expires Today")
        expect(notification.message).toContain('Taylor Trainer must renew this certification today')
    })

    it('builds medium-priority notice for 60-day horizon', () => {
        const alert: CertificationAlert = {
            userId: 'trainer-1',
            userName: 'Taylor Trainer',
            certification: createCertification({ certificationName: 'Forklift Operator', expirationDate: isoInDays(45) }),
            daysUntilExpiration: 45,
            urgency: 'medium',
        }

        const notification = generateCertificationNotification(alert)

        expect(notification.priority).toBe('medium')
        expect(notification.title).toContain('Expires in 6 Weeks')
    })

    it('builds high-priority renewal notice for the 14-day threshold', () => {
        const alert: CertificationAlert = {
            userId: 'trainer-1',
            userName: 'Taylor Trainer',
            certification: createCertification({ certificationName: 'CPR', expirationDate: isoInDays(14) }),
            daysUntilExpiration: 14,
            urgency: 'high',
        }

        const notification = generateCertificationNotification(alert, false)

        expect(notification.priority).toBe('high')
        expect(notification.title).toContain('Expires in 14 Days')
        expect(notification.message).toContain('Please initiate your certification renewal process.')
    })

    it('recomputes certification statuses when updating records', () => {
        const users: User[] = [
            createTrainerWithCerts('trainer-1', [
                createCertification({ certificationName: 'A', expirationDate: isoInDays(-2), status: 'active' }),
                createCertification({ certificationName: 'B', expirationDate: isoInDays(12), status: 'active' }),
                createCertification({ certificationName: 'C', expirationDate: isoInDays(75), status: 'expired' }),
            ]),
            {
                id: 'employee-1',
                name: 'Employee',
                email: 'employee@example.com',
                role: 'employee',
                department: 'Operations',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
        ]

        const updated = updateCertificationRecords(users)
        expect(updated[0].trainerProfile).toBeDefined()
        expect(updated[0].trainerProfile?.certificationRecords).toBeDefined()
        const statuses = updated[0].trainerProfile!.certificationRecords!.map(record => record.status)

        expect(statuses).toEqual(['expired', 'expiring-soon', 'active'])
        expect(updated[1]).toEqual(users[1])
    })

    it('summarizes certification compliance counts and rate', () => {
        const users: User[] = [
            createTrainerWithCerts('trainer-1', [
                createCertification({ expirationDate: isoInDays(90) }),
                createCertification({ expirationDate: isoInDays(10) }),
                createCertification({ expirationDate: isoInDays(-1) }),
            ]),
            createTrainerWithCerts('trainer-2', [
                createCertification({ expirationDate: isoInDays(120) }),
            ]),
        ]

        const summary = getCertificationSummary(users)

        expect(summary).toEqual({
            totalCertifications: 4,
            activeCertifications: 2,
            expiringSoon: 1,
            expired: 1,
            complianceRate: 50,
        })
    })

    it('returns 100% compliance when no trainer certifications exist', () => {
        const summary = getCertificationSummary([
            {
                id: 'employee-1',
                name: 'Employee',
                email: 'employee@example.com',
                role: 'employee',
                department: 'Ops',
                certifications: [],
                hireDate: '2024-01-01T00:00:00.000Z',
            },
        ])

        expect(summary.complianceRate).toBe(100)
        expect(summary.totalCertifications).toBe(0)
    })

    it('counts expired certifications explicitly in the compliance summary', () => {
        const summary = getCertificationSummary([
            createTrainerWithCerts('trainer-expired', [
                createCertification({ expirationDate: isoInDays(-2) }),
                createCertification({ expirationDate: isoInDays(-10), certificationName: 'CPR' }),
            ]),
        ])

        expect(summary.expired).toBe(2)
        expect(summary.activeCertifications).toBe(0)
        expect(summary.expiringSoon).toBe(0)
    })
})
