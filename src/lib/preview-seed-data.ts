import { addDays, addHours, subDays } from 'date-fns'
import {
    CheckInSchedule,
    Course,
    Enrollment,
    Notification,
    RecoveryPlan,
    ScheduleTemplate,
    Session,
    User,
    WellnessCheckIn
} from '@/lib/types'
import { RiskHistorySnapshot } from '@/lib/risk-history-tracker'

export const PREVIEW_SEED_VERSION = 'preview-seed-v1'

export interface PreviewSeedData {
    users: User[]
    sessions: Session[]
    courses: Course[]
    enrollments: Enrollment[]
    notifications: Notification[]
    wellnessCheckIns: WellnessCheckIn[]
    recoveryPlans: RecoveryPlan[]
    checkInSchedules: CheckInSchedule[]
    scheduleTemplates: ScheduleTemplate[]
    riskHistorySnapshots: RiskHistorySnapshot[]
    targetTrainerCoverage: number
}

function iso(date: Date): string {
    return date.toISOString()
}

export function createPreviewSeedData(referenceDate = new Date()): PreviewSeedData {
    const now = referenceDate

    const users: User[] = [
        {
            id: 'admin-1',
            name: 'Admin User',
            email: 'admin@trainsync.test',
            role: 'admin',
            department: 'Operations',
            certifications: [],
            hireDate: iso(subDays(now, 1200))
        },
        {
            id: 'trainer-1',
            name: 'Avery Stone',
            email: 'avery.stone@trainsync.test',
            role: 'trainer',
            department: 'Warehouse Training',
            certifications: ['Forklift Operator', 'Safety Training'],
            hireDate: iso(subDays(now, 900)),
            trainerProfile: {
                authorizedRoles: ['Forklift Operator', 'Warehouse Associate'],
                shiftSchedules: [
                    {
                        shiftCode: 'DAY-A-1',
                        daysWorked: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                        startTime: '08:00',
                        endTime: '16:00',
                        totalHoursPerWeek: 40
                    }
                ],
                tenure: {
                    hireDate: iso(subDays(now, 900)),
                    yearsOfService: 2,
                    monthsOfService: 6
                },
                specializations: ['Forklift Operations', 'Safety'],
                maxWeeklyHours: 42,
                preferredLocation: 'Plant A',
                certificationRecords: [
                    {
                        certificationName: 'Forklift Operator',
                        issuedDate: iso(subDays(now, 500)),
                        expirationDate: iso(addDays(now, 20)),
                        status: 'expiring-soon',
                        renewalRequired: true,
                        remindersSent: 2,
                        renewalInProgress: true
                    },
                    {
                        certificationName: 'Safety Training',
                        issuedDate: iso(subDays(now, 430)),
                        expirationDate: iso(addDays(now, 160)),
                        status: 'active',
                        renewalRequired: false,
                        remindersSent: 0
                    }
                ]
            }
        },
        {
            id: 'trainer-2',
            name: 'Jordan Kim',
            email: 'jordan.kim@trainsync.test',
            role: 'trainer',
            department: 'Quality Training',
            certifications: ['Quality Control', 'Lean Manufacturing'],
            hireDate: iso(subDays(now, 700)),
            trainerProfile: {
                authorizedRoles: ['Quality Inspector', 'Production Associate'],
                shiftSchedules: [
                    {
                        shiftCode: 'EVE-B-1',
                        daysWorked: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                        startTime: '16:00',
                        endTime: '00:00',
                        totalHoursPerWeek: 40
                    }
                ],
                tenure: {
                    hireDate: iso(subDays(now, 700)),
                    yearsOfService: 1,
                    monthsOfService: 11
                },
                specializations: ['Quality Controls', 'Lean'],
                maxWeeklyHours: 40,
                preferredLocation: 'Plant B',
                certificationRecords: [
                    {
                        certificationName: 'Quality Control',
                        issuedDate: iso(subDays(now, 420)),
                        expirationDate: iso(subDays(now, 7)),
                        status: 'expired',
                        renewalRequired: true,
                        remindersSent: 4,
                        notes: 'Expired for edge-case testing'
                    },
                    {
                        certificationName: 'Lean Manufacturing',
                        issuedDate: iso(subDays(now, 300)),
                        expirationDate: iso(addDays(now, 75)),
                        status: 'active',
                        renewalRequired: false,
                        remindersSent: 0
                    }
                ]
            }
        },
        {
            id: 'trainer-3',
            name: 'Casey Brooks',
            email: 'casey.brooks@trainsync.test',
            role: 'trainer',
            department: 'Safety and Compliance',
            certifications: ['Safety Training', 'First Aid'],
            hireDate: iso(subDays(now, 450)),
            trainerProfile: {
                authorizedRoles: ['Safety Officer', 'Supervisor'],
                shiftSchedules: [
                    {
                        shiftCode: 'DAY-A-2',
                        daysWorked: ['monday', 'tuesday', 'wednesday', 'thursday'],
                        startTime: '07:00',
                        endTime: '15:00',
                        totalHoursPerWeek: 32
                    }
                ],
                tenure: {
                    hireDate: iso(subDays(now, 450)),
                    yearsOfService: 1,
                    monthsOfService: 2
                },
                specializations: ['Incident Response', 'Safety'],
                maxWeeklyHours: 36,
                preferredLocation: 'Plant C',
                certificationRecords: [
                    {
                        certificationName: 'Safety Training',
                        issuedDate: iso(subDays(now, 360)),
                        expirationDate: iso(addDays(now, 12)),
                        status: 'expiring-soon',
                        renewalRequired: true,
                        remindersSent: 3,
                        renewalInProgress: true
                    },
                    {
                        certificationName: 'First Aid',
                        issuedDate: iso(subDays(now, 200)),
                        expirationDate: iso(addDays(now, 250)),
                        status: 'active',
                        renewalRequired: false,
                        remindersSent: 0
                    }
                ]
            }
        },
        {
            id: 'employee-1',
            name: 'Taylor Brown',
            email: 'taylor.brown@trainsync.test',
            role: 'employee',
            department: 'Warehouse',
            certifications: [],
            hireDate: iso(subDays(now, 230))
        },
        {
            id: 'employee-2',
            name: 'Jamie Flores',
            email: 'jamie.flores@trainsync.test',
            role: 'employee',
            department: 'Warehouse',
            certifications: [],
            hireDate: iso(subDays(now, 180))
        },
        {
            id: 'employee-3',
            name: 'Devin Wright',
            email: 'devin.wright@trainsync.test',
            role: 'employee',
            department: 'Production',
            certifications: [],
            hireDate: iso(subDays(now, 140))
        },
        {
            id: 'employee-4',
            name: 'Alex Martinez',
            email: 'alex.martinez@trainsync.test',
            role: 'employee',
            department: 'Production',
            certifications: [],
            hireDate: iso(subDays(now, 310))
        },
        {
            id: 'employee-5',
            name: 'Robin Kim',
            email: 'robin.kim@trainsync.test',
            role: 'employee',
            department: 'Logistics',
            certifications: [],
            hireDate: iso(subDays(now, 260))
        },
        {
            id: 'employee-6',
            name: 'Drew Wilson',
            email: 'drew.wilson@trainsync.test',
            role: 'employee',
            department: 'Logistics',
            certifications: [],
            hireDate: iso(subDays(now, 95))
        }
    ]

    const courses: Course[] = [
        {
            id: 'course-1',
            title: 'Forklift Basics',
            description: 'Foundational forklift safety and operation.',
            modules: ['module-1', 'module-2'],
            duration: 180,
            certifications: ['Forklift Operator'],
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 250)),
            published: true,
            passScore: 80
        },
        {
            id: 'course-2',
            title: 'Safety Fundamentals',
            description: 'Core plant safety practices and response drills.',
            modules: ['module-3', 'module-4'],
            duration: 200,
            certifications: ['Safety Training'],
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 220)),
            published: true,
            passScore: 85
        },
        {
            id: 'course-3',
            title: 'Quality Control Lab',
            description: 'Inspection fundamentals and defect handling.',
            modules: ['module-5', 'module-6'],
            duration: 150,
            certifications: ['Quality Control'],
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 140)),
            published: true,
            passScore: 82
        },
        {
            id: 'course-4',
            title: 'Incident Response Draft',
            description: 'Unpublished draft for edge-case coverage.',
            modules: ['module-7'],
            duration: 120,
            certifications: ['First Aid'],
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 20)),
            published: false,
            passScore: 75
        }
    ]

    const sessions: Session[] = [
        {
            id: 'session-1',
            courseId: 'course-1',
            trainerId: 'trainer-1',
            title: 'Forklift Basics - Morning A',
            startTime: iso(subDays(now, 16)),
            endTime: iso(addHours(subDays(now, 16), 3)),
            location: 'Warehouse Bay 1',
            capacity: 12,
            enrolledStudents: ['employee-1', 'employee-2', 'employee-3'],
            status: 'completed'
        },
        {
            id: 'session-2',
            courseId: 'course-2',
            trainerId: 'trainer-3',
            title: 'Safety Fundamentals - In Progress',
            startTime: iso(addHours(now, -1)),
            endTime: iso(addHours(now, 2)),
            location: 'Plant C Training Room',
            capacity: 16,
            enrolledStudents: ['employee-2', 'employee-4', 'employee-5'],
            status: 'in-progress'
        },
        {
            id: 'session-3',
            courseId: 'course-3',
            trainerId: 'trainer-2',
            title: 'Quality Controls - Cohort B',
            startTime: iso(addDays(now, 1)),
            endTime: iso(addHours(addDays(now, 1), 3)),
            location: 'Plant B Lab',
            capacity: 10,
            enrolledStudents: ['employee-2', 'employee-3', 'employee-6'],
            status: 'scheduled'
        },
        {
            id: 'session-4',
            courseId: 'course-2',
            trainerId: 'trainer-3',
            title: 'Incident Simulation (Cancelled)',
            startTime: iso(addDays(now, 3)),
            endTime: iso(addHours(addDays(now, 3), 2)),
            location: 'Safety Lab',
            capacity: 8,
            enrolledStudents: ['employee-1', 'employee-5'],
            status: 'cancelled'
        },
        {
            id: 'session-5',
            courseId: 'course-1',
            trainerId: 'trainer-1',
            title: 'Capacity Stress Session',
            startTime: iso(addDays(now, 4)),
            endTime: iso(addHours(addDays(now, 4), 3)),
            location: 'Warehouse Bay 2',
            capacity: 3,
            enrolledStudents: ['employee-1', 'employee-2', 'employee-3', 'employee-4'],
            status: 'scheduled'
        },
        {
            id: 'session-6',
            courseId: 'course-2',
            trainerId: 'trainer-3',
            title: 'Safety Surge Block 1',
            startTime: iso(addDays(now, 5)),
            endTime: iso(addHours(addDays(now, 5), 3)),
            location: 'Safety Hall A',
            capacity: 12,
            enrolledStudents: ['employee-2', 'employee-3', 'employee-4', 'employee-5'],
            status: 'scheduled'
        },
        {
            id: 'session-7',
            courseId: 'course-2',
            trainerId: 'trainer-3',
            title: 'Safety Surge Block 2',
            startTime: iso(addDays(now, 6)),
            endTime: iso(addHours(addDays(now, 6), 3)),
            location: 'Safety Hall A',
            capacity: 12,
            enrolledStudents: ['employee-1', 'employee-2', 'employee-6'],
            status: 'scheduled'
        },
        {
            id: 'session-8',
            courseId: 'course-3',
            trainerId: 'trainer-2',
            title: 'Quality Sprint',
            startTime: iso(addDays(now, 7)),
            endTime: iso(addHours(addDays(now, 7), 3)),
            location: 'Plant B Lab',
            capacity: 10,
            enrolledStudents: ['employee-3', 'employee-5'],
            status: 'scheduled'
        }
    ]

    const enrollments: Enrollment[] = [
        {
            id: 'enroll-1',
            userId: 'employee-1',
            courseId: 'course-1',
            sessionId: 'session-1',
            status: 'completed',
            progress: 100,
            score: 91,
            enrolledAt: iso(subDays(now, 20)),
            completedAt: iso(subDays(now, 15))
        },
        {
            id: 'enroll-2',
            userId: 'employee-2',
            courseId: 'course-2',
            sessionId: 'session-2',
            status: 'in-progress',
            progress: 45,
            enrolledAt: iso(subDays(now, 4))
        },
        {
            id: 'enroll-3',
            userId: 'employee-3',
            courseId: 'course-3',
            sessionId: 'session-3',
            status: 'enrolled',
            progress: 0,
            enrolledAt: iso(subDays(now, 2))
        },
        {
            id: 'enroll-4',
            userId: 'employee-4',
            courseId: 'course-3',
            status: 'failed',
            progress: 100,
            score: 61,
            enrolledAt: iso(subDays(now, 14)),
            completedAt: iso(subDays(now, 9))
        },
        {
            id: 'enroll-5',
            userId: 'employee-5',
            courseId: 'course-2',
            sessionId: 'session-6',
            status: 'enrolled',
            progress: 0,
            enrolledAt: iso(subDays(now, 1))
        }
    ]

    const notifications: Notification[] = [
        {
            id: 'notif-1',
            userId: 'admin-1',
            type: 'workload',
            title: 'Critical Burnout Risk Detected',
            message: 'Casey Brooks has reached critical burnout risk.',
            link: '/burnout-dashboard',
            read: false,
            createdAt: iso(subDays(now, 1)),
            priority: 'critical'
        },
        {
            id: 'notif-2',
            userId: 'admin-1',
            type: 'reminder',
            title: 'Certification Expired',
            message: 'Jordan Kim has an expired Quality Control certification.',
            link: '/certifications',
            read: false,
            createdAt: iso(subDays(now, 1)),
            priority: 'high'
        },
        {
            id: 'notif-3',
            userId: 'trainer-3',
            type: 'session',
            title: 'Session Starts Soon',
            message: 'Safety Fundamentals starts in 1 hour.',
            link: '/schedule',
            read: true,
            createdAt: iso(addHours(now, -2)),
            priority: 'medium'
        },
        {
            id: 'notif-4',
            userId: 'admin-1',
            type: 'system',
            title: 'Template Applied',
            message: 'Recurring safety template generated new sessions.',
            link: '/schedule-templates',
            read: true,
            createdAt: iso(subDays(now, 3)),
            priority: 'low'
        }
    ]

    const wellnessCheckIns: WellnessCheckIn[] = [
        {
            id: 'checkin-1',
            trainerId: 'trainer-1',
            timestamp: iso(subDays(now, 8)),
            mood: 4,
            stress: 'moderate',
            energy: 'energized',
            workloadSatisfaction: 4,
            sleepQuality: 4,
            physicalWellbeing: 4,
            mentalClarity: 4,
            followUpRequired: false,
            utilizationAtCheckIn: 71
        },
        {
            id: 'checkin-2',
            trainerId: 'trainer-2',
            timestamp: iso(subDays(now, 3)),
            mood: 2,
            stress: 'high',
            energy: 'tired',
            workloadSatisfaction: 2,
            sleepQuality: 2,
            physicalWellbeing: 3,
            mentalClarity: 2,
            comments: 'Too many context switches this week.',
            concerns: ['context-switching', 'fatigue'],
            followUpRequired: true,
            followUpCompleted: false,
            utilizationAtCheckIn: 93
        },
        {
            id: 'checkin-3',
            trainerId: 'trainer-3',
            timestamp: iso(subDays(now, 2)),
            mood: 1,
            stress: 'critical',
            energy: 'exhausted',
            workloadSatisfaction: 1,
            sleepQuality: 1,
            physicalWellbeing: 2,
            mentalClarity: 1,
            comments: 'Need immediate load reduction.',
            concerns: ['burnout-signals'],
            followUpRequired: true,
            followUpCompleted: false,
            utilizationAtCheckIn: 97
        },
        {
            id: 'checkin-4',
            trainerId: 'trainer-3',
            timestamp: iso(subDays(now, 1)),
            mood: 2,
            stress: 'high',
            energy: 'tired',
            workloadSatisfaction: 2,
            sleepQuality: 2,
            physicalWellbeing: 2,
            mentalClarity: 2,
            followUpRequired: true,
            followUpCompleted: false,
            utilizationAtCheckIn: 95
        }
    ]

    const recoveryPlans: RecoveryPlan[] = [
        {
            id: 'recovery-1',
            trainerId: 'trainer-3',
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 2)),
            status: 'active',
            triggerReason: 'Critical stress and sustained high utilization',
            targetUtilization: 70,
            currentUtilization: 96,
            startDate: iso(subDays(now, 2)),
            targetCompletionDate: iso(addDays(now, 21)),
            actions: [
                {
                    id: 'action-1',
                    type: 'workload-reduction',
                    description: 'Reassign two sessions this week',
                    targetDate: iso(addDays(now, 2)),
                    completed: false
                },
                {
                    id: 'action-2',
                    type: 'support-session',
                    description: 'Schedule support call with operations lead',
                    targetDate: iso(addDays(now, 1)),
                    completed: true,
                    completedDate: iso(now),
                    completedBy: 'admin-1'
                }
            ],
            checkIns: ['checkin-3', 'checkin-4'],
            notes: 'High-priority recovery case.'
        }
    ]

    const checkInSchedules: CheckInSchedule[] = [
        {
            id: 'schedule-1',
            trainerId: 'trainer-1',
            frequency: 'weekly',
            startDate: iso(subDays(now, 60)),
            nextScheduledDate: iso(addDays(now, 4)),
            status: 'active',
            notificationEnabled: true,
            autoReminders: true,
            reminderHoursBefore: 12,
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 60)),
            completedCheckIns: 6,
            missedCheckIns: 0
        },
        {
            id: 'schedule-2',
            trainerId: 'trainer-2',
            frequency: 'biweekly',
            startDate: iso(subDays(now, 50)),
            nextScheduledDate: iso(addDays(now, 1)),
            status: 'active',
            notificationEnabled: true,
            autoReminders: true,
            reminderHoursBefore: 6,
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 50)),
            completedCheckIns: 4,
            missedCheckIns: 1
        },
        {
            id: 'schedule-3',
            trainerId: 'trainer-3',
            frequency: 'daily',
            startDate: iso(subDays(now, 12)),
            nextScheduledDate: iso(addDays(now, 1)),
            status: 'active',
            notificationEnabled: true,
            autoReminders: true,
            reminderHoursBefore: 4,
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 12)),
            notes: 'High-risk trainer cadence',
            completedCheckIns: 8,
            missedCheckIns: 2
        }
    ]

    const scheduleTemplates: ScheduleTemplate[] = [
        {
            id: 'template-1',
            name: 'Weekly Forklift Program',
            description: 'Recurring forklift sessions for new cohorts.',
            courseId: 'course-1',
            category: 'operations',
            recurrenceType: 'weekly',
            sessions: [
                {
                    dayOfWeek: 1,
                    time: '09:00',
                    duration: 180,
                    location: 'Warehouse Bay 1',
                    capacity: 10,
                    requiresCertifications: ['Forklift Operator']
                },
                {
                    dayOfWeek: 3,
                    time: '13:00',
                    duration: 180,
                    location: 'Warehouse Bay 2',
                    capacity: 10,
                    requiresCertifications: ['Forklift Operator']
                }
            ],
            autoAssignTrainers: true,
            notifyParticipants: true,
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 85)),
            lastUsed: iso(subDays(now, 5)),
            usageCount: 12,
            tags: ['forklift', 'weekly'],
            isActive: true
        },
        {
            id: 'template-2',
            name: 'Safety Intensive',
            description: 'Biweekly safety simulation and response cycle.',
            courseId: 'course-2',
            category: 'safety',
            recurrenceType: 'biweekly',
            sessions: [
                {
                    dayOfWeek: 2,
                    time: '10:00',
                    duration: 120,
                    location: 'Safety Lab',
                    capacity: 14,
                    requiresCertifications: ['Safety Training']
                }
            ],
            autoAssignTrainers: false,
            notifyParticipants: true,
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 45)),
            lastUsed: iso(subDays(now, 7)),
            usageCount: 6,
            tags: ['safety', 'biweekly'],
            isActive: true
        }
    ]

    const riskHistorySnapshots: RiskHistorySnapshot[] = [
        {
            id: 'snapshot-1',
            trainerId: 'trainer-1',
            timestamp: iso(subDays(now, 7)),
            riskScore: 45,
            riskLevel: 'medium',
            utilizationRate: 74,
            hoursScheduled: 31,
            sessionCount: 5,
            consecutiveDays: 4,
            factorCount: 2
        },
        {
            id: 'snapshot-2',
            trainerId: 'trainer-1',
            timestamp: iso(subDays(now, 1)),
            riskScore: 41,
            riskLevel: 'medium',
            utilizationRate: 70,
            hoursScheduled: 29,
            sessionCount: 5,
            consecutiveDays: 4,
            factorCount: 2
        },
        {
            id: 'snapshot-3',
            trainerId: 'trainer-2',
            timestamp: iso(subDays(now, 7)),
            riskScore: 68,
            riskLevel: 'high',
            utilizationRate: 88,
            hoursScheduled: 37,
            sessionCount: 7,
            consecutiveDays: 6,
            factorCount: 4
        },
        {
            id: 'snapshot-4',
            trainerId: 'trainer-2',
            timestamp: iso(subDays(now, 1)),
            riskScore: 79,
            riskLevel: 'high',
            utilizationRate: 93,
            hoursScheduled: 39,
            sessionCount: 8,
            consecutiveDays: 7,
            factorCount: 5
        },
        {
            id: 'snapshot-5',
            trainerId: 'trainer-3',
            timestamp: iso(subDays(now, 7)),
            riskScore: 84,
            riskLevel: 'critical',
            utilizationRate: 97,
            hoursScheduled: 41,
            sessionCount: 8,
            consecutiveDays: 7,
            factorCount: 6
        },
        {
            id: 'snapshot-6',
            trainerId: 'trainer-3',
            timestamp: iso(subDays(now, 1)),
            riskScore: 89,
            riskLevel: 'critical',
            utilizationRate: 99,
            hoursScheduled: 42,
            sessionCount: 9,
            consecutiveDays: 8,
            factorCount: 6
        }
    ]

    return {
        users,
        sessions,
        courses,
        enrollments,
        notifications,
        wellnessCheckIns,
        recoveryPlans,
        checkInSchedules,
        scheduleTemplates,
        riskHistorySnapshots,
        targetTrainerCoverage: 4
    }
}
