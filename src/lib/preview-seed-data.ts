import { addDays, addHours, subDays } from 'date-fns'
import {
    CheckInSchedule,
    Course,
    EnergyLevel,
    Enrollment,
    Notification,
    RecoveryPlan,
    ScheduleTemplate,
    Session,
    StressLevel,
    User,
    WellnessCheckIn,
} from '@/lib/types'
import { RiskHistorySnapshot } from '@/lib/risk-history-tracker'
import { COMMON_CONCERNS } from '@/lib/wellness-concerns'

/** Unique version tag for the preview seed data schema, used to detect stale cached seeds. */
export const PREVIEW_SEED_VERSION = 'preview-seed-v3'

/**
 * The complete set of demo entities injected into the application store when
 * preview seeding is active. Every collection maps directly to the corresponding
 * store slice.
 */
export interface PreviewSeedData {
    /** Users covering admin, trainer, and employee roles. */
    users: User[]
    /** Training sessions in various states (completed, in-progress, scheduled, cancelled). */
    sessions: Session[]
    /** Available training courses, including unpublished drafts for edge-case testing. */
    courses: Course[]
    /** Student enrollments linking users to courses and sessions. */
    enrollments: Enrollment[]
    /** System and user-facing notifications at various priority levels. */
    notifications: Notification[]
    /** Trainer wellness check-in records with mood, stress, and energy ratings. */
    wellnessCheckIns: WellnessCheckIn[]
    /** Active and in-progress recovery plans for at-risk trainers. */
    recoveryPlans: RecoveryPlan[]
    /** Scheduled cadences for recurring trainer wellness check-ins. */
    checkInSchedules: CheckInSchedule[]
    /** Reusable schedule templates for recurring training programs. */
    scheduleTemplates: ScheduleTemplate[]
    /** Point-in-time burnout-risk history snapshots for trend analysis. */
    riskHistorySnapshots: RiskHistorySnapshot[]
    /** Target number of trainer-coverage slots used by coverage calculations. */
    targetTrainerCoverage: number
}

/**
 * Internal role labels used for trainer authorization and course outcomes.
 */
const ROLE_CATALOG = [
    'Forklift Operator',
    'Warehouse Associate',
    'Quality Inspector',
    'Production Associate',
    'Safety Officer',
    'Supervisor',
    'Material Handler',
    'Inventory Specialist',
    'Line Lead',
    'Compliance Coordinator',
    'Emergency Responder',
    'Logistics Planner',
] as const

/**
 * Internal certification labels used across trainer profiles and courses.
 */
const CERTIFICATION_CATALOG = [
    'Forklift Operator',
    'Safety Training',
    'Quality Control',
    'First Aid',
    'Hazmat Handling',
    'Lockout Tagout',
    'Incident Command',
    'Lean Manufacturing',
    'Ergonomics',
    'Confined Space',
    'Fire Safety',
    'Crisis Communication',
] as const

/**
 * Target entity counts for the larger preview seed data set.
 */
const PREVIEW_COUNTS = {
    trainers: 18,
    employees: 36,
    courses: 24,
    sessions: 48,
    enrollments: 30,
    notifications: 24,
    wellnessCheckIns: 24,
    recoveryPlans: 6,
    scheduleTemplates: 12,
} as const

/**
 * Canonical trainer names retained from earlier seed versions.
 */
const TRAINER_NAME_MAP: Record<number, string> = {
    1: 'Avery Stone',
    2: 'Jordan Kim',
    3: 'Casey Brooks',
}

/**
 * Converts a date to its ISO 8601 string representation.
 *
 * @param date - The date to serialize.
 * @returns The ISO 8601 string.
 */
function iso(date: Date): string {
    return date.toISOString()
}

/**
 * Returns a deterministic cycle item.
 *
 * @param values - Source array to cycle through.
 * @param index - Zero-based index.
 * @returns A value from the source array.
 * @throws {Error} If {@link values} is an empty array.
 */
function cycle<T>(values: readonly T[], index: number): T {
    if (values.length === 0) {
        throw new Error('cycle() was called with an empty values array')
    }

    const wrappedIndex = ((index % values.length) + values.length) % values.length
    return values[wrappedIndex]
}

/**
 * Canonical list of first names used for deterministic preview employees.
 */
const FIRST_NAMES = [
    'Taylor', 'Jamie', 'Devin', 'Alex', 'Robin', 'Drew', 'Morgan', 'Riley', 'Parker', 'Quinn', 'Harper', 'Kendall',
    'Skyler', 'Avery', 'Jordan', 'Logan', 'Reese', 'Cameron', 'Blake', 'Sage', 'Elliot', 'Finley', 'Rowan', 'Dakota',
] as const

/**
 * Canonical list of last names used for deterministic preview employees.
 */
const LAST_NAMES = [
    'Brown', 'Flores', 'Wright', 'Martinez', 'Kim', 'Wilson', 'Nguyen', 'Patel', 'Chen', 'Reed', 'Singh', 'Lopez',
    'Brooks', 'Turner', 'Morgan', 'Bailey', 'Diaz', 'Price', 'Ward', 'Bennett', 'Harvey', 'Ramos', 'Owens', 'Shaw',
] as const

/**
 * Canonical free-text comments used in seeded wellness check-ins.
 */
const WELLNESS_COMMENT_CATALOG = [
    'Need short-term schedule relief to recover energy.',
    'This week felt manageable and structured.',
    'Would like clearer expectations before night sessions.',
    'After peer support, stress has started to improve.',
    'Requesting more prep time before the next certification block.',
] as const

const ENERGY_COVERAGE = ['exhausted', 'tired', 'neutral', 'energized', 'excellent'] as const

type RiskProfile = 'critical' | 'high' | 'medium' | 'low'

/**
 * Returns a normalized risk level from a seeded burnout score.
 *
 * @param score - Numeric burnout-risk score on a 0-100 scale.
 * @returns Categorical risk level.
 */
export function getRiskLevelFromScore(score: number): RiskHistorySnapshot['riskLevel'] {
    if (score >= 85) {
        return 'critical'
    }
    if (score >= 65) {
        return 'high'
    }
    if (score >= 40) {
        return 'medium'
    }
    return 'low'
}

/**
 * Builds a deterministic employee name pair.
 *
 * @param index - Zero-based employee index.
 * @returns Display name and e-mail slug parts.
 */
function buildName(index: number): { first: string; last: string } {
    return {
        first: cycle(FIRST_NAMES, index),
        last: cycle(LAST_NAMES, index * 3),
    }
}

/**
 * Maps a deterministic risk band to a trainer risk profile.
 *
 * @param riskBand - Seeded risk-band value.
 * @returns The derived risk profile.
 */
function getRiskProfile(riskBand: number): RiskProfile {
    if (riskBand === 2 || riskBand === 5) {
        return 'critical'
    }
    if (riskBand === 1 || riskBand === 4) {
        return 'high'
    }
    if (riskBand === 3) {
        return 'medium'
    }
    return 'low'
}

/**
 * Selects a deterministic energy level for a wellness check-in.
 *
 * Check-ins 1-5 intentionally cover every energy bucket exactly once. After
 * that, energy values cycle based on the trainer risk profile.
 *
 * @param checkInNumber - One-based check-in sequence number.
 * @param riskProfile - The trainer risk profile for the check-in.
 * @returns The seeded energy level.
 */
function getEnergyLevel(checkInNumber: number, riskProfile: RiskProfile): EnergyLevel {
    if (checkInNumber <= ENERGY_COVERAGE.length) {
        return ENERGY_COVERAGE[checkInNumber - 1]
    }

    if (riskProfile === 'critical') {
        return cycle(['exhausted', 'tired'] as const, checkInNumber)
    }
    if (riskProfile === 'high') {
        return cycle(['tired', 'neutral'] as const, checkInNumber)
    }
    if (riskProfile === 'medium') {
        return cycle(['neutral', 'energized'] as const, checkInNumber)
    }
    return cycle(['energized', 'excellent'] as const, checkInNumber)
}

/**
 * Generates a complete, self-consistent set of preview seed data anchored to
 * referenceDate (defaults to the current moment).
 *
 * Compared to the original preview set, this generator intentionally increases
 * overall volume by roughly 6x while preserving deterministic IDs and temporal
 * relationships. It includes:
 * - 1 admin, 18 trainers, 36 employees
 * - 24 courses and 48 sessions
 * - 30 enrollments and 24 notifications
 * - 24 wellness check-ins and 6 recovery plans
 * - 18 check-in schedules and 12 schedule templates
 * - 36 risk snapshots (2 per trainer)
 *
 * @param referenceDate - Anchor date from which all relative dates are calculated.
 * @returns A fully populated preview seed data object.
 */
export function createPreviewSeedData(referenceDate = new Date()): PreviewSeedData {
    const now = referenceDate

    const adminUser: User = {
        id: 'admin-1',
        name: 'Admin User',
        email: 'admin@orchestrate.test',
        role: 'admin',
        department: 'Operations',
        certifications: [],
        hireDate: iso(subDays(now, 1200)),
    }

    const trainers: User[] = Array.from({ length: PREVIEW_COUNTS.trainers }, (_, index) => {
        const trainerNumber = index + 1
        const roleA = cycle(ROLE_CATALOG, index)
        const roleB = cycle(ROLE_CATALOG, index + 4)
        const certA = cycle(CERTIFICATION_CATALOG, index)
        const certB = cycle(CERTIFICATION_CATALOG, index + 2)
        const certC = cycle(CERTIFICATION_CATALOG, index + 5)

        const riskBand = index % 6
        const riskProfile = getRiskProfile(riskBand)

        const shiftType = riskBand % 3 === 0 ? 'day' : riskBand % 3 === 1 ? 'evening' : 'night'
        const shiftStart = shiftType === 'day' ? '08:00' : shiftType === 'evening' ? '16:00' : '00:00'
        const shiftEnd = shiftType === 'day' ? '16:00' : shiftType === 'evening' ? '00:00' : '08:00'
        const baseHours = riskProfile === 'critical' ? 46 : riskProfile === 'high' ? 42 : riskProfile === 'medium' ? 38 : 34

        const displayName = TRAINER_NAME_MAP[trainerNumber] ?? `Trainer ${trainerNumber}`

        const certRecordBaseDate = subDays(now, 650 - trainerNumber * 6)

        return {
            id: `trainer-${trainerNumber}`,
            name: displayName,
            email: `trainer.${trainerNumber}@orchestrate.test`,
            role: 'trainer',
            department: trainerNumber % 3 === 0 ? 'Safety and Compliance' : trainerNumber % 2 === 0 ? 'Quality Training' : 'Warehouse Training',
            certifications: [certA, certB, certC],
            hireDate: iso(subDays(now, 980 - trainerNumber * 22)),
            shifts: [shiftType],
            trainerProfile: {
                authorizedRoles: [roleA, roleB, cycle(ROLE_CATALOG, index + 8)],
                shiftSchedules: [
                    {
                        shiftCode: `${shiftType.toUpperCase()}-${trainerNumber.toString().padStart(2, '0')}`,
                        shiftType,
                        daysWorked: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                        startTime: shiftStart,
                        endTime: shiftEnd,
                        totalHoursPerWeek: baseHours,
                    },
                ],
                tenure: {
                    hireDate: iso(subDays(now, 980 - trainerNumber * 22)),
                    yearsOfService: Math.floor((980 - trainerNumber * 22) / 365),
                    monthsOfService: Math.floor((980 - trainerNumber * 22) / 30),
                },
                specializations: [
                    roleA,
                    riskProfile === 'critical' ? 'Recovery Coaching' : cycle(['Incident Response', 'Operations', 'Compliance', 'Mentoring'], index),
                ],
                maxWeeklyHours: baseHours + (riskProfile === 'critical' ? 2 : 0),
                preferredLocation: trainerNumber % 3 === 0 ? 'Plant C' : trainerNumber % 2 === 0 ? 'Plant B' : 'Plant A',
                certificationRecords: [
                    {
                        certificationName: certA,
                        issuedDate: iso(subDays(certRecordBaseDate, 80)),
                        expirationDate: iso(addDays(now, riskProfile === 'critical' ? 9 : riskProfile === 'high' ? 21 : 140)),
                        status: riskProfile === 'critical' ? 'expiring-soon' : 'active',
                        renewalRequired: riskProfile === 'critical',
                        remindersSent: riskProfile === 'critical' ? 3 : 1,
                        renewalInProgress: riskProfile === 'critical' || riskProfile === 'high',
                    },
                    {
                        certificationName: certB,
                        issuedDate: iso(subDays(certRecordBaseDate, 45)),
                        expirationDate: iso(addDays(now, riskProfile === 'high' ? -6 : 80)),
                        status: riskProfile === 'high' ? 'expired' : 'active',
                        renewalRequired: riskProfile === 'high',
                        remindersSent: riskProfile === 'high' ? 4 : 0,
                        notes: riskProfile === 'high' ? 'Expired to stress certification remediation workflows.' : undefined,
                    },
                    {
                        certificationName: certC,
                        issuedDate: iso(subDays(certRecordBaseDate, 15)),
                        expirationDate: iso(addDays(now, 240)),
                        status: 'active',
                        renewalRequired: false,
                        remindersSent: 0,
                    },
                ],
            },
        }
    })

    const employees: User[] = Array.from({ length: PREVIEW_COUNTS.employees }, (_, index) => {
        const employeeNumber = index + 1
        const { first, last } = buildName(index)
        const roleCert = cycle(CERTIFICATION_CATALOG, index + 3)

        return {
            id: `employee-${employeeNumber}`,
            name: `${first} ${last}`,
            email: `${first.toLowerCase()}.${last.toLowerCase()}.${employeeNumber}@orchestrate.test`,
            role: 'employee',
            department: cycle(['Warehouse', 'Production', 'Logistics', 'Quality', 'Maintenance', 'Packaging'], index),
            certifications: employeeNumber % 4 === 0 ? [roleCert] : [],
            hireDate: iso(subDays(now, 420 - employeeNumber * 6)),
        }
    })

    const users: User[] = [adminUser, ...trainers, ...employees]

    const courses: Course[] = Array.from({ length: PREVIEW_COUNTS.courses }, (_, index) => {
        const courseNumber = index + 1
        const certA = cycle(CERTIFICATION_CATALOG, index)
        const certB = cycle(CERTIFICATION_CATALOG, index + 1)
        const isPublished = courseNumber % 6 !== 0

        return {
            id: `course-${courseNumber}`,
            title: `${cycle(['Operations', 'Safety', 'Quality', 'Leadership', 'Compliance', 'Logistics'], index)} Series ${courseNumber}`,
            description: `Course ${courseNumber} covering ${certA} and related workflow drills.`,
            modules: [`module-${courseNumber * 2 - 1}`, `module-${courseNumber * 2}`],
            duration: 90 + (courseNumber % 5) * 30,
            certifications: [certA, certB],
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 300 - courseNumber * 5)),
            published: isPublished,
            passScore: 75 + (courseNumber % 6) * 2,
        }
    })

    const trainerIds = trainers.map(trainer => trainer.id)
    const employeeIds = employees.map(employee => employee.id)

    /**
     * Builds an array of enrolled student IDs by cycling through the employee pool.
     *
     * @param offset - Starting index into the employee ID array.
     * @param desiredCount - Number of student IDs to include.
     * @returns An array of `desiredCount` employee IDs.
     */
    const buildEnrolledStudents = (offset: number, desiredCount: number): string[] => {
        return Array.from({ length: desiredCount }, (_, index) => employeeIds[(offset + index) % employeeIds.length])
    }

    const sessions: Session[] = Array.from({ length: PREVIEW_COUNTS.sessions }, (_, index) => {
        const sessionNumber = index + 1
        const course = courses[index % courses.length]
        const trainerId = trainerIds[index % trainerIds.length]

        let status: Session['status']
        let startTime: Date
        let endTime: Date

        if (sessionNumber === 1) {
            status = 'completed'
            startTime = subDays(now, 16)
            endTime = addHours(startTime, 3)
        } else if (sessionNumber === 2) {
            status = 'in-progress'
            startTime = addHours(now, -1)
            endTime = addHours(now, 2)
        } else if (sessionNumber % 9 === 0) {
            status = 'cancelled'
            startTime = addDays(now, 1 + (sessionNumber % 10))
            endTime = addHours(startTime, 2)
        } else if (sessionNumber % 7 === 0) {
            status = 'completed'
            startTime = subDays(now, 2 + (sessionNumber % 12))
            endTime = addHours(startTime, 3)
        } else {
            status = 'scheduled'
            startTime = addDays(now, 1 + (sessionNumber % 18))
            endTime = addHours(startTime, sessionNumber % 4 === 0 ? 4 : 3)
        }

        const plannedEnrollmentCount = 3 + (sessionNumber % 5)
        const enrolledStudents = buildEnrolledStudents(sessionNumber, plannedEnrollmentCount)
        const capacity = sessionNumber % 13 === 0 ? plannedEnrollmentCount - 1 : plannedEnrollmentCount + 4

        return {
            id: `session-${sessionNumber}`,
            courseId: course.id,
            trainerId,
            title: `${course.title} - Block ${sessionNumber}`,
            startTime: iso(startTime),
            endTime: iso(endTime),
            location: cycle(['Warehouse Bay 1', 'Plant B Lab', 'Safety Hall', 'Ops Classroom', 'Logistics Center'], index),
            capacity,
            enrolledStudents,
            status,
            shift: cycle(['day', 'evening', 'night'] as const, index),
        }
    })

    const enrollmentRows = sessions.flatMap((session, sessionIndex) =>
        session.enrolledStudents.map((userId, rosterIndex) => ({
            session,
            userId,
            sequence: sessionIndex * 10 + rosterIndex,
        }))
    )

    const slicedEnrollmentRows = enrollmentRows.slice(0, PREVIEW_COUNTS.enrollments)

    const rosterBySessionId = slicedEnrollmentRows.reduce<Record<string, string[]>>((accumulator, row) => {
        if (!accumulator[row.session.id]) {
            accumulator[row.session.id] = []
        }
        accumulator[row.session.id].push(row.userId)
        return accumulator
    }, {})

    const seededSessions: Session[] = sessions.map((session) => ({
        ...session,
        enrolledStudents: rosterBySessionId[session.id] ?? [],
    }))

    const enrollments: Enrollment[] = slicedEnrollmentRows
        .map(({ session, userId, sequence }) => {
            const sessionStart = new Date(session.startTime)
            const sessionEnd = new Date(session.endTime)
            const enrollmentWindowMs = Math.max(sessionEnd.getTime() - sessionStart.getTime(), 1)
            const offsetMs = Math.floor((sequence % 1000) * enrollmentWindowMs / 1000)
            const enrolledAtDate = new Date(sessionStart.getTime() + offsetMs)

            let status: Enrollment['status']
            if (session.status === 'completed') {
                status = cycle(['completed', 'failed'] as const, sequence)
            } else if (session.status === 'in-progress') {
                status = cycle(['in-progress', 'enrolled'] as const, sequence)
            } else {
                status = 'enrolled'
            }

            const progress =
                status === 'completed' || status === 'failed'
                    ? 100
                    : status === 'in-progress'
                        ? 35 + (sequence % 45)
                        : 0

            const score =
                status === 'completed'
                    ? 82 + (sequence % 14)
                    : status === 'failed'
                        ? 54 + (sequence % 9)
                        : undefined

            const completionOffsetMs = Math.max(Math.floor(enrollmentWindowMs / 2), 1)
            const completedAtDate = new Date(
                Math.max(
                    enrolledAtDate.getTime() + 1,
                    Math.min(sessionEnd.getTime(), enrolledAtDate.getTime() + completionOffsetMs)
                )
            )

            return {
                id: `enroll-${session.id}-${userId}`,
                userId,
                courseId: session.courseId,
                sessionId: session.id,
                status,
                progress,
                score,
                enrolledAt: iso(enrolledAtDate),
                completedAt: status === 'completed' || status === 'failed' ? iso(completedAtDate) : undefined,
            }
        })

    const criticalTrainers = trainers.filter((_, index) => index % 6 === 2 || index % 6 === 5)
    const highRiskTrainers = trainers.filter((_, index) => index % 6 === 1 || index % 6 === 4)
    const criticalTrainerIds = criticalTrainers.map(trainer => trainer.id)
    const highRiskTrainerIds = highRiskTrainers.map(trainer => trainer.id)
    const trainerNameById = new Map(trainers.map(trainer => [trainer.id, trainer.name]))

    const notifications: Notification[] = Array.from({ length: PREVIEW_COUNTS.notifications }, (_, index) => {
        const notificationNumber = index + 1
        const isCritical = index % 6 === 0
        const isHigh = index % 4 === 0 && !isCritical
        const priority = isCritical ? 'critical' : isHigh ? 'high' : index % 2 === 0 ? 'medium' : 'low'
        const notificationType = cycle(['workload', 'reminder', 'session', 'system', 'assignment', 'completion'] as const, index)
        const targetTrainerId = isCritical
            ? criticalTrainerIds[index % criticalTrainerIds.length]
            : highRiskTrainerIds[index % highRiskTrainerIds.length]
        const targetTrainerName = trainerNameById.get(targetTrainerId) ?? targetTrainerId

        return {
            id: `notif-${notificationNumber}`,
            userId: index % 7 === 0 ? targetTrainerId : 'admin-1',
            type: isCritical ? 'workload' : notificationType,
            title: isCritical ? 'Critical Burnout Risk Detected' : isHigh ? 'Certification Remediation Needed' : `Operations Notice ${notificationNumber}`,
            message: isCritical
                ? `${targetTrainerName} has entered critical risk and needs immediate load rebalancing.`
                : isHigh
                    ? `${targetTrainerName} has an overdue certification renewal.`
                    : `Seeded notification ${notificationNumber} for dashboard coverage.`,
            link: isCritical ? '/burnout-dashboard' : '/schedule',
            read: index % 5 === 0,
            createdAt: iso(subDays(now, index % 9)),
            priority,
        }
    })

    const wellnessCheckIns: WellnessCheckIn[] = Array.from({ length: PREVIEW_COUNTS.wellnessCheckIns }, (_, index) => {
        const checkInNumber = index + 1
        const trainerId = trainerIds[index % trainerIds.length]
        const trainerIndex = index % trainerIds.length
        const riskProfile = getRiskProfile(trainerIndex % 6)

        const stress: StressLevel = riskProfile === 'critical'
            ? cycle(['critical', 'high'] as const, index)
            : riskProfile === 'high'
                ? cycle(['high', 'moderate'] as const, index)
                : riskProfile === 'medium'
                    ? cycle(['moderate', 'low'] as const, index)
                    : cycle(['low', 'moderate'] as const, index)

        const energy = getEnergyLevel(checkInNumber, riskProfile)

        const values = stress === 'critical'
            ? { mood: 1 as const, sat: 1 as const, sleep: 1 as const, physical: 2 as const, clarity: 1 as const, util: 97 }
            : stress === 'high'
                ? { mood: 2 as const, sat: 2 as const, sleep: 2 as const, physical: 3 as const, clarity: 2 as const, util: 91 }
                : stress === 'moderate'
                    ? { mood: 3 as const, sat: 3 as const, sleep: 3 as const, physical: 3 as const, clarity: 3 as const, util: 80 }
                    : { mood: 4 as const, sat: 4 as const, sleep: 4 as const, physical: 4 as const, clarity: 4 as const, util: 68 }

        const concernCount = stress === 'critical' ? 3 : stress === 'high' ? 2 : stress === 'moderate' && index % 3 === 0 ? 1 : 0
        const concerns = concernCount > 0
            ? Array.from({ length: concernCount }, (_, concernIndex) => cycle(COMMON_CONCERNS, index + concernIndex * 2))
            : undefined

        const followUpRequired = stress === 'critical' || stress === 'high' || (stress === 'moderate' && index % 4 === 0)
        const followUpCompleted = followUpRequired ? index % 5 === 0 : undefined

        return {
            id: `checkin-${checkInNumber}`,
            trainerId,
            timestamp: iso(subDays(now, (index % 10) + 1)),
            mood: values.mood,
            stress,
            energy,
            workloadSatisfaction: values.sat,
            sleepQuality: values.sleep,
            physicalWellbeing: values.physical,
            mentalClarity: values.clarity,
            comments: cycle(WELLNESS_COMMENT_CATALOG, index),
            concerns,
            adminNotes: followUpCompleted ? 'Follow-up completed with reduced workload and mentor support.' : undefined,
            followUpRequired,
            followUpCompleted,
            utilizationAtCheckIn: values.util + (index % 3),
        }
    })

    const checkInsByTrainer = wellnessCheckIns.reduce<Record<string, string[]>>((accumulator, checkIn) => {
        if (!accumulator[checkIn.trainerId]) {
            accumulator[checkIn.trainerId] = []
        }
        accumulator[checkIn.trainerId].push(checkIn.id)
        return accumulator
    }, {})

    const recoveryTrainerIds = [...criticalTrainerIds.slice(0, 4), ...highRiskTrainerIds.slice(0, 2)]

    const recoveryPlans: RecoveryPlan[] = Array.from({ length: PREVIEW_COUNTS.recoveryPlans }, (_, index) => {
        const planNumber = index + 1
        const trainerId = recoveryTrainerIds[index]
        const linkedCheckIns = (checkInsByTrainer[trainerId] ?? []).slice(-2)
        const isCriticalPlan = criticalTrainerIds.includes(trainerId)

        return {
            id: `recovery-${planNumber}`,
            trainerId,
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 3 + index)),
            status: cycle(['in-progress', 'active', 'active', 'completed', 'cancelled', 'active'] as const, index),
            triggerReason: isCriticalPlan
                ? 'Critical stress and sustained high utilization'
                : 'Elevated stress trend and workload imbalance',
            targetUtilization: isCriticalPlan ? 68 : 74,
            currentUtilization: isCriticalPlan ? 95 + (index % 3) : 88 + (index % 4),
            startDate: iso(subDays(now, 3 + index)),
            targetCompletionDate: iso(addDays(now, 18 + index * 2)),
            actualCompletionDate: index === 3 ? iso(subDays(now, 1)) : undefined,
            actions: [
                {
                    id: `action-${planNumber}-1`,
                    type: 'workload-reduction',
                    description: 'Reassign two upcoming sessions to lower weekly hours.',
                    targetDate: iso(addDays(now, 2 + index)),
                    completed: index === 3,
                    completedDate: index === 3 ? iso(subDays(now, 2)) : undefined,
                    completedBy: index === 3 ? 'admin-1' : undefined,
                    impact: index === 3 ? 'Weekly utilization reduced by 11%.' : undefined,
                },
                {
                    id: `action-${planNumber}-2`,
                    type: 'support-session',
                    description: 'Hold support check-in with operations lead.',
                    targetDate: iso(addDays(now, 1 + index)),
                    completed: true,
                    completedDate: iso(subDays(now, index % 2)),
                    completedBy: 'admin-1',
                },
                {
                    id: `action-${planNumber}-3`,
                    type: index % 2 === 0 ? 'schedule-adjustment' : 'time-off',
                    description: index % 2 === 0 ? 'Move one night shift to daytime shadowing.' : 'Schedule a restorative day off after heavy blocks.',
                    targetDate: iso(addDays(now, 4 + index)),
                    completed: index % 3 === 0,
                    completedDate: index % 3 === 0 ? iso(subDays(now, 1)) : undefined,
                    completedBy: index % 3 === 0 ? 'admin-1' : undefined,
                },
                {
                    id: `action-${planNumber}-4`,
                    type: 'training',
                    description: 'Enroll in resilience and recovery workshop.',
                    targetDate: iso(addDays(now, 7 + index)),
                    completed: index === 3,
                    completedDate: index === 3 ? iso(subDays(now, 1)) : undefined,
                    completedBy: index === 3 ? 'admin-1' : undefined,
                },
            ],
            checkIns: linkedCheckIns,
            notes: isCriticalPlan ? 'High-priority recovery case.' : 'Monitor for sustained improvement over two weeks.',
            outcomes: index === 3 ? 'Trainer returned to stable utilization and reports energized check-ins.' : undefined,
        }
    })

    const checkInSchedules: CheckInSchedule[] = trainers.map((trainer, index) => {
        const riskBand = index % 6
        const frequency = riskBand === 2 || riskBand === 5 ? 'daily' : riskBand === 1 || riskBand === 4 ? 'weekly' : riskBand === 3 ? 'biweekly' : 'monthly'

        return {
            id: `schedule-${index + 1}`,
            trainerId: trainer.id,
            frequency,
            startDate: iso(subDays(now, 70 - index)),
            nextScheduledDate: iso(addDays(now, 1 + (index % 5))),
            status: 'active',
            notificationEnabled: true,
            autoReminders: true,
            reminderHoursBefore: frequency === 'daily' ? 4 : 12,
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 70 - index)),
            notes: frequency === 'daily' ? 'High-risk trainer cadence' : undefined,
            completedCheckIns: 4 + (index % 8),
            missedCheckIns: index % 3,
        }
    })

    const scheduleTemplates: ScheduleTemplate[] = Array.from({ length: PREVIEW_COUNTS.scheduleTemplates }, (_, index) => {
        const templateNumber = index + 1
        const courseId = courses[index % courses.length].id
        const certA = cycle(CERTIFICATION_CATALOG, index)
        const certB = cycle(CERTIFICATION_CATALOG, index + 4)

        return {
            id: `template-${templateNumber}`,
            name: `${cycle(['Weekly', 'Biweekly', 'Monthly', 'Shift-Rotation'], index)} Program ${templateNumber}`,
            description: `Template ${templateNumber} for recurring ${certA.toLowerCase()} programs.`,
            courseId,
            category: cycle(['operations', 'safety', 'quality', 'leadership'], index),
            recurrenceType: cycle(['weekly', 'biweekly', 'monthly', 'custom'] as const, index),
            cycleDays: index % 4 === 3 ? 10 + (index % 5) : undefined,
            sessions: [
                {
                    dayOfWeek: (index + 1) % 7,
                    time: cycle(['08:00', '10:00', '13:00', '16:00', '20:00'], index),
                    duration: 120 + (index % 3) * 30,
                    location: cycle(['Warehouse Bay 1', 'Safety Lab', 'Plant B Lab', 'Ops Classroom'], index),
                    capacity: 8 + (index % 7),
                    requiresCertifications: [certA, certB],
                    shift: cycle(['day', 'evening', 'night'] as const, index),
                },
            ],
            autoAssignTrainers: index % 2 === 0,
            notifyParticipants: true,
            createdBy: 'admin-1',
            createdAt: iso(subDays(now, 95 - index * 2)),
            lastUsed: iso(subDays(now, 4 + (index % 10))),
            usageCount: 6 + index,
            tags: [cycle(['forklift', 'safety', 'quality', 'compliance', 'leadership'], index), 'scaled-preview'],
            isActive: true,
        }
    })

    const riskHistorySnapshots: RiskHistorySnapshot[] = trainers.flatMap((trainer, index) => {
        const riskProfile = getRiskProfile(index % 6)
        // Use a different index offset for trendPattern so it varies independently from risk profile
        const trendPattern = cycle(['worsening', 'improving', 'stable'] as const, index + 5)
        const baseline = riskProfile === 'critical' ? 88 : riskProfile === 'high' ? 71 : riskProfile === 'medium' ? 46 : 24
        const olderScore = trendPattern === 'worsening' ? baseline - 6 : trendPattern === 'improving' ? baseline + 5 : baseline
        const recentScore = trendPattern === 'worsening' ? baseline + 4 : trendPattern === 'improving' ? baseline - 6 : baseline
        const olderRiskLevel = getRiskLevelFromScore(olderScore)
        const recentRiskLevel = getRiskLevelFromScore(recentScore)

        return [
            {
                id: `snapshot-${trainer.id}-1`,
                trainerId: trainer.id,
                timestamp: iso(subDays(now, 7)),
                riskScore: olderScore,
                riskLevel: olderRiskLevel,
                utilizationRate: riskProfile === 'critical' ? 95 : riskProfile === 'high' ? 88 : riskProfile === 'medium' ? 77 : 68,
                hoursScheduled: riskProfile === 'critical' ? 43 : riskProfile === 'high' ? 39 : riskProfile === 'medium' ? 34 : 28,
                sessionCount: riskProfile === 'critical' ? 9 : riskProfile === 'high' ? 8 : riskProfile === 'medium' ? 6 : 5,
                consecutiveDays: riskProfile === 'critical' ? 8 : riskProfile === 'high' ? 7 : riskProfile === 'medium' ? 5 : 4,
                factorCount: riskProfile === 'critical' ? 6 : riskProfile === 'high' ? 5 : riskProfile === 'medium' ? 3 : 1,
            },
            {
                id: `snapshot-${trainer.id}-2`,
                trainerId: trainer.id,
                timestamp: iso(subDays(now, 1)),
                riskScore: recentScore,
                riskLevel: recentRiskLevel,
                utilizationRate: riskProfile === 'critical' ? 98 : riskProfile === 'high' ? 92 : riskProfile === 'medium' ? 79 : 64,
                hoursScheduled: riskProfile === 'critical' ? 45 : riskProfile === 'high' ? 41 : riskProfile === 'medium' ? 35 : 27,
                sessionCount: riskProfile === 'critical' ? 10 : riskProfile === 'high' ? 8 : riskProfile === 'medium' ? 6 : 5,
                consecutiveDays: riskProfile === 'critical' ? 9 : riskProfile === 'high' ? 7 : riskProfile === 'medium' ? 5 : 4,
                factorCount: riskProfile === 'critical' ? 7 : riskProfile === 'high' ? 5 : riskProfile === 'medium' ? 3 : 1,
            },
        ]
    })

    return {
        users,
        sessions: seededSessions,
        courses,
        enrollments,
        notifications,
        wellnessCheckIns,
        recoveryPlans,
        checkInSchedules,
        scheduleTemplates,
        riskHistorySnapshots,
        targetTrainerCoverage: PREVIEW_COUNTS.trainers,
    }
}
