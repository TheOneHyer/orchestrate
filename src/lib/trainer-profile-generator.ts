import { User, TrainerProfile, ShiftSchedule, DayOfWeek, ShiftType } from './types'
import { differenceInYears, differenceInMonths, parseISO } from 'date-fns'

export type { ShiftType }

/**
 * A `User` variant narrowed to the `'trainer'` role that makes the `shifts`
 * field required (non-optional). Use this type at call sites where shifts are
 * known to be present. When shifts may be absent, use the base `User` type and
 * handle the optional `shifts` field accordingly.
 */
export type TrainerWithShifts = Omit<User, 'shifts'> & {
  role: 'trainer'
  shifts: ShiftType[]
}

/**
 * Generates and attaches a {@link TrainerProfile} to a trainer user if one does
 * not already exist. Non-trainer users are returned unchanged.
 *
 * The generated profile includes:
 * - Authorised training roles derived from the trainer's certifications.
 * - A {@link ShiftSchedule} for each shift type in `user.shifts` (produces an
 *   empty `shiftSchedules` array when `shifts` is absent or empty).
 * - Tenure information (years and months of service) calculated from `hireDate`.
 * - Specialisations derived from the trainer's certifications.
 * - A default `maxWeeklyHours` of 40.
 *
 * @param user - A `TrainerWithShifts` object (role must be `'trainer'`).
 * @returns The same user with a fully populated `trainerProfile`.
 */
export function generateTrainerProfile(user: TrainerWithShifts): TrainerWithShifts & { trainerProfile: TrainerProfile }
/**
 * Passes a non-trainer user through without modification.
 *
 * @param user - Any application user.
 * @returns The same user object, unmodified.
 */
export function generateTrainerProfile(user: User): User
export function generateTrainerProfile(user: User): User {
  if (user.role !== 'trainer') return user

  if (user.trainerProfile) return user

  const parsedHireDate = parseISO(user.hireDate)
  const now = new Date()
  const yearsOfService = differenceInYears(now, parsedHireDate)
  const monthsOfService = differenceInMonths(now, parsedHireDate)

  const shiftSchedules: ShiftSchedule[] = []

  user.shifts?.forEach((shiftType, index) => {
    const schedule = createShiftSchedule(shiftType, index)
    shiftSchedules.push(schedule)
  })

  const authorizedRoles = generateAuthorizedRoles(user.certifications)

  const trainerProfile: TrainerProfile = {
    authorizedRoles,
    shiftSchedules,
    tenure: {
      hireDate: user.hireDate,
      yearsOfService,
      monthsOfService,
    },
    specializations: generateSpecializations(user.certifications),
    maxWeeklyHours: 40,
  }

  return {
    ...user,
    trainerProfile,
  }
}

/**
 * Constructs a {@link ShiftSchedule} for a given shift type.
 *
 * Each shift maps to a fixed time window and shift code:
 * - `'day'`     → 08:00–16:00, code prefix `DAY-A`.
 * - `'evening'` → 16:00–00:00, code prefix `EVE-B`.
 * - `'night'`   → 00:00–08:00, code prefix `NIGHT-C`.
 *
 * All schedules cover Monday through Friday (5 days per week). The
 * `totalHoursPerWeek` is calculated from the shift duration × 5.
 *
 * @param shiftType - The shift type to configure.
 * @param index - Zero-based index used to suffix the `shiftCode` for uniqueness.
 * @returns A fully populated {@link ShiftSchedule} object.
 */
function createShiftSchedule(shiftType: ShiftType, index: number): ShiftSchedule {
  const shiftConfigs = {
    day: {
      startTime: '08:00',
      endTime: '16:00',
      code: 'DAY-A',
    },
    evening: {
      startTime: '16:00',
      endTime: '00:00',
      code: 'EVE-B',
    },
    night: {
      startTime: '00:00',
      endTime: '08:00',
      code: 'NIGHT-C',
    },
  }

  const config = shiftConfigs[shiftType]
  const daysWorked: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

  const start = config.startTime.split(':').map(Number)
  const end = config.endTime.split(':').map(Number)
  let hoursPerDay = (end[0] + end[1] / 60) - (start[0] + start[1] / 60)
  if (hoursPerDay < 0) hoursPerDay += 24
  const totalHoursPerWeek = hoursPerDay * daysWorked.length

  return {
    shiftCode: `${config.code}-${index + 1}`,
    shiftType,
    daysWorked,
    startTime: config.startTime,
    endTime: config.endTime,
    totalHoursPerWeek: Math.round(totalHoursPerWeek),
  }
}

/**
 * Maps a list of certification names to the training roles the holder is
 * authorised to deliver.
 *
 * Uses a static lookup table; certifications that do not appear in the table
 * contribute no roles. Duplicate role entries across certifications are
 * de-duplicated via a `Set`.
 *
 * @param certifications - The trainer's list of certification names.
 * @returns A deduplicated array of authorised role name strings.
 */
function generateAuthorizedRoles(certifications: string[]): string[] {
  const roleMapping: Record<string, string[]> = {
    'Forklift Operator': ['Warehouse Associate', 'Material Handler', 'Forklift Operator'],
    'Safety Training': ['Safety Officer', 'General Employee', 'Supervisor'],
    'Equipment Maintenance': ['Maintenance Technician', 'Equipment Operator'],
    'Quality Control': ['Quality Inspector', 'Production Associate', 'Supervisor'],
    'First Aid': ['Safety Officer', 'Floor Supervisor', 'Team Lead'],
    'Lean Manufacturing': ['Process Engineer', 'Production Supervisor', 'Team Lead'],
    'Advanced Forklift': ['Senior Warehouse Associate', 'Warehouse Supervisor', 'Forklift Trainer'],
  }

  const roles = new Set<string>()
  certifications.forEach(cert => {
    const mappedRoles = roleMapping[cert]
    if (mappedRoles) {
      mappedRoles.forEach(role => roles.add(role))
    }
  })

  return Array.from(roles)
}

/**
 * Derives professional specialisation labels from a trainer's certification list.
 *
 * Uses a static lookup table to map each certification to one or more
 * specialisation strings. Certifications absent from the table are ignored;
 * duplicates are removed via a `Set`.
 *
 * @param certifications - The trainer's list of certification names.
 * @returns A deduplicated array of specialisation label strings.
 */
function generateSpecializations(certifications: string[]): string[] {
  const specializationMapping: Record<string, string[]> = {
    'Forklift Operator': ['Heavy Equipment Operation', 'Warehouse Safety'],
    'Safety Training': ['OSHA Compliance', 'Emergency Response'],
    'Equipment Maintenance': ['Preventive Maintenance', 'Troubleshooting'],
    'Quality Control': ['Statistical Process Control', 'Inspection Techniques'],
    'First Aid': ['Emergency Medical Response', 'CPR Certification'],
    'Lean Manufacturing': ['Continuous Improvement', 'Waste Reduction'],
    'Advanced Forklift': ['Advanced Maneuvering', 'Load Calculation'],
  }

  const specializations = new Set<string>()
  certifications.forEach(cert => {
    const mapped = specializationMapping[cert]
    if (mapped) {
      mapped.forEach(spec => specializations.add(spec))
    }
  })

  return Array.from(specializations)
}

/**
 * Iterates over a list of users and calls {@link generateTrainerProfile} for
 * every user with the `'trainer'` role, leaving non-trainer users unchanged.
 *
 * Use this helper to hydrate an entire user list (e.g. data loaded from
 * storage) when trainer profiles may be absent.
 *
 * @param users - The full list of application users to process.
 * @returns A new array where all trainer users have a populated `trainerProfile`.
 */
export function ensureAllTrainersHaveProfiles(users: User[]): User[] {
  return users.map(user => {
    if (user.role === 'trainer') {
      return generateTrainerProfile(user)
    }
    return user
  })
}
