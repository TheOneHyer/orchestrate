export type UserRole = 'admin' | 'trainer' | 'employee'

export type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'

export interface ShiftSchedule {
  shiftCode: string
  daysWorked: DayOfWeek[]
  startTime: string
  endTime: string
  totalHoursPerWeek: number
}

export interface CertificationRecord {
  certificationName: string
  issuedDate: string
  expirationDate: string
  status: 'active' | 'expiring-soon' | 'expired'
  renewalRequired: boolean
  remindersSent: number
  lastReminderDate?: string
  renewalInProgress?: boolean
  notes?: string
}

export interface TrainerProfile {
  authorizedRoles: string[]
  shiftSchedules: ShiftSchedule[]
  tenure: {
    hireDate: string
    yearsOfService: number
    monthsOfService: number
  }
  specializations: string[]
  maxWeeklyHours?: number
  preferredLocation?: string
  notes?: string
  certificationRecords?: CertificationRecord[]
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  badgeId?: string
  department: string
  certifications: string[]
  hireDate: string
  trainerProfile?: TrainerProfile
}

export interface Course {
  id: string
  title: string
  description: string
  modules: string[]
  duration: number
  certifications: string[]
  createdBy: string
  createdAt: string
  published: boolean
  passScore: number
}

export interface Module {
  id: string
  title: string
  description: string
  contentType: 'video' | 'slideshow' | 'quiz' | 'text'
  content: any
  duration: number
  order: number
}

export interface Session {
  id: string
  courseId: string
  trainerId: string
  title: string
  startTime: string
  endTime: string
  location: string
  capacity: number
  enrolledStudents: string[]
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly'
    endDate: string
  }
}

export interface Enrollment {
  id: string
  userId: string
  courseId: string
  sessionId?: string
  status: 'enrolled' | 'in-progress' | 'completed' | 'failed'
  progress: number
  score?: number
  enrolledAt: string
  completedAt?: string
}

export interface Notification {
  id: string
  userId: string
  type: 'session' | 'assignment' | 'completion' | 'reminder' | 'system' | 'workload'
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
}

export interface QuizQuestion {
  id: string
  question: string
  type: 'multiple-choice' | 'true-false' | 'short-answer'
  options?: string[]
  correctAnswer: string | number
  points: number
}

export interface Quiz {
  id: string
  moduleId: string
  questions: QuizQuestion[]
  passingScore: number
  timeLimit?: number
}

export interface ScheduleConflict {
  type: 'trainer' | 'student' | 'room'
  resourceId: string
  sessionId: string
  reason: string
}

export type ViewType = 'calendar' | 'gantt' | 'list' | 'board'

export type MoodLevel = 1 | 2 | 3 | 4 | 5
export type StressLevel = 'low' | 'moderate' | 'high' | 'critical'
export type EnergyLevel = 'exhausted' | 'tired' | 'neutral' | 'energized' | 'excellent'

export interface WellnessCheckIn {
  id: string
  trainerId: string
  timestamp: string
  mood: MoodLevel
  stress: StressLevel
  energy: EnergyLevel
  workloadSatisfaction: MoodLevel
  sleepQuality: MoodLevel
  physicalWellbeing: MoodLevel
  mentalClarity: MoodLevel
  comments?: string
  concerns?: string[]
  adminNotes?: string
  followUpRequired: boolean
  followUpCompleted?: boolean
  utilizationAtCheckIn?: number
}

export type RecoveryPlanStatus = 'active' | 'in-progress' | 'completed' | 'cancelled'
export type RecoveryAction = 'workload-reduction' | 'time-off' | 'schedule-adjustment' | 'support-session' | 'training' | 'custom'

export interface RecoveryPlan {
  id: string
  trainerId: string
  createdBy: string
  createdAt: string
  status: RecoveryPlanStatus
  triggerReason: string
  targetUtilization: number
  currentUtilization: number
  startDate: string
  targetCompletionDate: string
  actualCompletionDate?: string
  actions: RecoveryPlanAction[]
  checkIns: string[]
  notes?: string
  outcomes?: string
}

export interface RecoveryPlanAction {
  id: string
  type: RecoveryAction
  description: string
  targetDate: string
  completed: boolean
  completedDate?: string
  completedBy?: string
  impact?: string
  notes?: string
}

export interface WellnessTrend {
  trainerId: string
  period: string
  averageMood: number
  averageStress: number
  averageEnergy: number
  checkInCount: number
  concernsRaised: number
  followUpsRequired: number
  recoveryPlansActive: number
}

export type CheckInFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
export type CheckInScheduleStatus = 'active' | 'paused' | 'completed'

export interface CheckInSchedule {
  id: string
  trainerId: string
  frequency: CheckInFrequency
  customDays?: number
  startDate: string
  endDate?: string
  nextScheduledDate: string
  lastCheckInDate?: string
  status: CheckInScheduleStatus
  notificationEnabled: boolean
  autoReminders: boolean
  reminderHoursBefore: number
  createdBy: string
  createdAt: string
  notes?: string
  completedCheckIns: number
  missedCheckIns: number
}

export type TemplateRecurrenceType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'

export interface ScheduleTemplateSession {
  dayOfWeek?: number
  weekOfCycle?: number
  time: string
  duration: number
  location?: string
  capacity: number
  requiresCertifications: string[]
  preferredTrainers?: string[]
}

export interface ScheduleTemplate {
  id: string
  name: string
  description: string
  courseId?: string
  category: string
  recurrenceType: TemplateRecurrenceType
  cycleDays?: number
  sessions: ScheduleTemplateSession[]
  autoAssignTrainers: boolean
  notifyParticipants: boolean
  createdBy: string
  createdAt: string
  lastUsed?: string
  usageCount: number
  tags: string[]
  isActive: boolean
}
