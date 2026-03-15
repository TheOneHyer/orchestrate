import { User, TrainerProfile, ShiftSchedule, DayOfWeek, ShiftType } from './types'
import { differenceInYears, differenceInMonths } from 'date-fns'

export function generateTrainerProfile(user: User): User {
  if (user.role !== 'trainer') return user

  if (user.trainerProfile) return user

  const yearsOfService = differenceInYears(new Date(), new Date(user.hireDate))
  const monthsOfService = differenceInMonths(new Date(), new Date(user.hireDate))

  const shiftSchedules: ShiftSchedule[] = []

  user.shifts.forEach((shiftType, index) => {
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

export function ensureAllTrainersHaveProfiles(users: User[]): User[] {
  return users.map(user => {
    if (user.role === 'trainer') {
      return generateTrainerProfile(user)
    }
    return user
  })
}
