/** Represents the access role of a user within the system. */
export type UserRole = 'admin' | 'trainer' | 'employee'

/** Represents a day of the week in lowercase. */
export type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'

/** Represents the period of a work shift. */
export type ShiftType = 'day' | 'evening' | 'night'

/**
 * Describes a recurring shift schedule assigned to a trainer,
 * including which days are worked and the time boundaries.
 */
export interface ShiftSchedule {
  /** Short identifier code for the shift (e.g. "D1", "N2"). */
  shiftCode: string
  /** The shift period (day / evening / night) this schedule covers. */
  shiftType: ShiftType
  /** The days of the week on which this shift is worked. */
  daysWorked: DayOfWeek[]
  /** Shift start time as a 24-hour `HH:mm` string or a 12-hour `h:mm AM/PM` string. */
  startTime: string
  /** Shift end time as a 24-hour `HH:mm` string or a 12-hour `h:mm AM/PM` string. */
  endTime: string
  /** Cumulative hours worked per week under this schedule. */
  totalHoursPerWeek: number
}

/**
 * Tracks the lifecycle of a single certification held by a trainer,
 * including its current status and renewal history.
 */
export interface CertificationRecord {
  /** Human-readable name of the certification. */
  certificationName: string
  /** ISO 8601 date string when the certification was issued. */
  issuedDate: string
  /** ISO 8601 date string when the certification expires. */
  expirationDate: string
  /** Current validity state of the certification. */
  status: 'active' | 'expiring-soon' | 'expired'
  /** Whether a formal renewal process is required. */
  renewalRequired: boolean
  /** Number of automated renewal reminder notifications sent so far. */
  remindersSent: number
  /** ISO 8601 date string of the most recent reminder sent, if any. */
  lastReminderDate?: string
  /** Whether a renewal is already in progress. */
  renewalInProgress?: boolean
  /** Optional free-text notes about the certification or renewal. */
  notes?: string
}

/**
 * Extended profile information for users with the `trainer` role,
 * capturing scheduling, tenure, and certification data.
 */
export interface TrainerProfile {
  /** List of role identifiers this trainer is authorized to train. */
  authorizedRoles: string[]
  /** Weekly shift schedules assigned to this trainer. */
  shiftSchedules: ShiftSchedule[]
  /** Tenure details derived from the trainer's hire date. */
  tenure: {
    /** ISO 8601 date string of the trainer's hire date. */
    hireDate: string
    /** Whole years of service completed. */
    yearsOfService: number
    /** Total months of service from hire date. */
    monthsOfService: number
  }
  /** Areas of expertise or subject-matter focus for this trainer. */
  specializations: string[]
  /** Optional cap on weekly teaching hours. */
  maxWeeklyHours?: number
  /** Preferred training location, if specified. */
  preferredLocation?: string
  /** Optional administrative notes about the trainer. */
  notes?: string
  /** Individual certification records tracked for compliance. */
  certificationRecords?: CertificationRecord[]
}

/**
 * Canonical shape of a user account used throughout the application.
 * Trainers additionally carry a {@link TrainerProfile}.
 */
export interface User {
  /** Unique identifier for the user. */
  id: string
  /** Full display name of the user. */
  name: string
  /** Email address of the user. */
  email: string
  /** Access role that determines the user's permissions. */
  role: UserRole
  /** Optional URL to the user's avatar image. */
  avatar?: string
  /** Optional physical badge identifier. */
  badgeId?: string
  /** Department the user belongs to. */
  department: string
  /** List of certification names held by the user. */
  certifications: string[]
  /** ISO 8601 date string of the user's hire date. */
  hireDate: string
  /** Extended profile data, present only for trainers. */
  trainerProfile?: TrainerProfile
  /** Shift periods (day / evening / night) this user is scheduled for; typically populated for trainer roles, absent for other roles. */
  shifts?: ShiftType[]
}

/**
 * Represents a training course, including its content structure,
 * certification outcomes, and publication state.
 */
export interface Course {
  /** Unique identifier for the course. */
  id: string
  /** Display title of the course. */
  title: string
  /** Brief description of the course content and goals. */
  description: string
  /** Ordered list of module IDs that make up this course. */
  modules: string[]
  /** Total estimated duration of the course in minutes. */
  duration: number
  /** Certifications awarded upon successful completion of this course. */
  certifications: string[]
  /** User ID of the trainer or admin who created this course. */
  createdBy: string
  /** ISO 8601 timestamp of when the course was created. */
  createdAt: string
  /** Whether the course is publicly visible to employees. */
  published: boolean
  /** Minimum score (0–100) required to pass the course. */
  passScore: number
}

/**
 * Content payload for a video module.
 * @see {@link Module}
 */
export interface VideoContent {
  /** URL of the video resource. */
  url: string
  /** Duration of the video in seconds. */
  durationSeconds?: number
}

/**
 * Content payload for a slideshow module.
 * @see {@link Module}
 */
export interface SlideshowContent {
  /** Ordered list of slide image URLs or markup strings. */
  slides: string[]
}

/**
 * Content payload for a quiz module.
 * @see {@link Module}
 */
export interface QuizContent {
  /** Ordered list of quiz questions. */
  questions: Array<{
    /** The question prompt. */
    prompt: string
    /** Available answer choices. */
    choices: string[]
    /** Zero-based index of the correct choice. */
    correctIndex: number
  }>
}

/**
 * Content payload for a text module.
 * @see {@link Module}
 */
export interface TextContent {
  /** The body text (may contain Markdown or HTML). */
  body: string
}

/**
 * A single content module within a course, holding typed instructional material.
 */
export interface Module {
  /** Unique identifier for the module. */
  id: string
  /** Display title of the module. */
  title: string
  /** Brief description of what the module covers. */
  description: string
  /** The type of content delivered by this module. */
  contentType: 'video' | 'slideshow' | 'quiz' | 'text'
  /**
   * The raw module content; callers must narrow on `contentType` before
   * accessing type-specific properties.
   */
  content: VideoContent | SlideshowContent | QuizContent | TextContent
  /** Estimated duration of the module in minutes. */
  duration: number
  /** Zero-based position of this module within its parent course. */
  order: number
}

/**
 * Represents a scheduled instance of a course, led by a specific trainer
 * and open for student enrollment.
 */
export interface Session {
  /** Unique identifier for the session. */
  id: string
  /** ID of the course this session delivers. */
  courseId: string
  /** ID of the trainer leading the session. */
  trainerId: string
  /** Display title for the session. */
  title: string
  /** ISO 8601 timestamp for when the session starts. */
  startTime: string
  /** ISO 8601 timestamp for when the session ends. */
  endTime: string
  /** Physical or virtual location where the session takes place. */
  location: string
  /** Maximum number of students that can enroll. */
  capacity: number
  /** List of user IDs currently enrolled in the session. */
  enrolledStudents: string[]
  /** Current lifecycle state of the session. */
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  /** Shift period during which this session runs; derived from session start time when not explicitly set. */
  shift?: ShiftType
  /** Optional recurrence rule for repeating sessions. */
  recurrence?: {
    /** How often the session repeats. */
    frequency: 'daily' | 'weekly' | 'monthly'
    /** ISO 8601 date string after which the recurrence stops. */
    endDate: string
  }
}

/**
 * Records a user's enrollment in a course (and optionally a specific session),
 * tracking their progress and outcome.
 */
export interface Enrollment {
  /** Unique identifier for the enrollment record. */
  id: string
  /** ID of the enrolled user. */
  userId: string
  /** ID of the course the user is enrolled in. */
  courseId: string
  /** ID of the specific session the user is attending, if applicable. */
  sessionId?: string
  /** Current state of the user's enrollment. */
  status: 'enrolled' | 'in-progress' | 'completed' | 'failed'
  /** Completion percentage of the course (0–100). */
  progress: number
  /** Final assessment score achieved, if the course has been completed. */
  score?: number
  /** ISO 8601 timestamp of when the enrollment was created. */
  enrolledAt: string
  /** ISO 8601 timestamp of when the user completed the course, if applicable. */
  completedAt?: string
}

/**
 * An in-app notification delivered to a user, covering various system events
 * such as session reminders, assignments, and wellness alerts.
 */
export interface Notification {
  /** Unique identifier for the notification. */
  id: string
  /** ID of the user this notification is addressed to. */
  userId: string
  /** Category of event that triggered the notification. */
  type: 'session' | 'assignment' | 'completion' | 'reminder' | 'system' | 'workload'
  /** Short subject line displayed in notification lists. */
  title: string
  /** Full notification body text. */
  message: string
  /** Optional deep-link URL for navigating to related content. */
  link?: string
  /** Whether the user has read this notification. */
  read: boolean
  /** ISO 8601 timestamp of when the notification was created. */
  createdAt: string
  /** Urgency level influencing display styling and ordering. */
  priority?: 'low' | 'medium' | 'high' | 'critical'
  /** Arbitrary key-value pairs for notification-specific data. */
  metadata?: Record<string, unknown>
}

/**
 * A single question within a quiz module, supporting multiple question formats.
 */
export interface QuizQuestion {
  /** Unique identifier for the question. */
  id: string
  /** The text of the question presented to the learner. */
  question: string
  /** The format/type of the question. */
  type: 'multiple-choice' | 'true-false' | 'short-answer'
  /** Answer choices for multiple-choice questions. */
  options?: string[]
  /** The correct answer; an index for multiple-choice, or a string for others. */
  correctAnswer: string | number
  /** Point value awarded for a correct answer. */
  points: number
}

/**
 * A quiz associated with a specific module, containing questions
 * and pass/fail criteria.
 */
export interface Quiz {
  /** Unique identifier for the quiz. */
  id: string
  /** ID of the module this quiz belongs to. */
  moduleId: string
  /** Ordered list of questions in this quiz. */
  questions: QuizQuestion[]
  /** Minimum score (0–100) needed to pass the quiz. */
  passingScore: number
  /** Optional time limit in minutes for completing the quiz. */
  timeLimit?: number
}

/**
 * Describes a scheduling conflict detected between two sessions
 * for a shared resource (trainer, student, or room).
 */
export interface SessionScheduleConflict {
  /** The type of resource involved in the conflict. */
  type: 'trainer' | 'student' | 'room'
  /** ID of the conflicting resource (user ID or room identifier). */
  resourceId: string
  /** ID of the session that conflicts with the new or moved session. */
  sessionId: string
  /** Human-readable explanation of why this constitutes a conflict. */
  reason: string
}

/** The display mode used to render the scheduling interface. */
export type ViewType = 'calendar' | 'list' | 'board'

/** A numeric mood rating on a 1–5 scale (1 = very low, 5 = excellent). */
export type MoodLevel = 1 | 2 | 3 | 4 | 5
/** A qualitative stress level reported during a wellness check-in. */
export type StressLevel = 'low' | 'moderate' | 'high' | 'critical'
/** A qualitative energy level reported during a wellness check-in. */
export type EnergyLevel = 'exhausted' | 'tired' | 'neutral' | 'energized' | 'excellent'

/**
 * A single wellness check-in submitted by a trainer, capturing
 * subjective wellbeing metrics and optional administrative follow-up data.
 */
export interface WellnessCheckIn {
  /** Unique identifier for this check-in record. */
  id: string
  /** ID of the trainer who submitted this check-in. */
  trainerId: string
  /** ISO 8601 timestamp of when the check-in was submitted. */
  timestamp: string
  /** Self-reported mood rating. */
  mood: MoodLevel
  /** Self-reported stress level. */
  stress: StressLevel
  /** Self-reported energy level. */
  energy: EnergyLevel
  /** Satisfaction with current workload, on the mood scale. */
  workloadSatisfaction: MoodLevel
  /** Quality of sleep the previous night, on the mood scale. */
  sleepQuality: MoodLevel
  /** Physical wellbeing rating, on the mood scale. */
  physicalWellbeing: MoodLevel
  /** Mental focus and clarity rating, on the mood scale. */
  mentalClarity: MoodLevel
  /** Optional free-text comments from the trainer. */
  comments?: string
  /** Optional list of specific concerns raised by the trainer. */
  concerns?: string[]
  /** Optional notes added by an admin reviewing this check-in. */
  adminNotes?: string
  /** Whether a follow-up action has been flagged as required. */
  followUpRequired: boolean
  /** Whether the required follow-up has been completed. */
  followUpCompleted?: boolean
  /** The trainer's workload utilization percentage at the time of check-in. */
  utilizationAtCheckIn?: number
}

/** Lifecycle status of a trainer recovery plan. */
export type RecoveryPlanStatus = 'active' | 'in-progress' | 'completed' | 'cancelled'
/** The category of corrective action taken within a recovery plan. */
export type RecoveryAction = 'workload-reduction' | 'time-off' | 'schedule-adjustment' | 'support-session' | 'training' | 'custom'

/**
 * A structured plan created to help a trainer recover from burnout or
 * unsustainable workload, consisting of targeted actions and check-in references.
 */
export interface RecoveryPlan {
  /** Unique identifier for the recovery plan. */
  id: string
  /** ID of the trainer this plan applies to. */
  trainerId: string
  /** User ID of the admin who created the plan. */
  createdBy: string
  /** ISO 8601 timestamp of when the plan was created. */
  createdAt: string
  /** Current status of the recovery plan. */
  status: RecoveryPlanStatus
  /** Description of what triggered the creation of this plan. */
  triggerReason: string
  /** Workload utilization percentage the plan aims to reach. */
  targetUtilization: number
  /** Workload utilization percentage at the time the plan was created. */
  currentUtilization: number
  /** ISO 8601 date string for when the plan officially starts. */
  startDate: string
  /** ISO 8601 date string by which the plan should be completed. */
  targetCompletionDate: string
  /** ISO 8601 date string of when the plan was actually completed, if applicable. */
  actualCompletionDate?: string
  /** List of specific actions to be taken as part of this plan. */
  actions: RecoveryPlanAction[]
  /** IDs of wellness check-ins associated with this recovery plan. */
  checkIns: string[]
  /** Optional administrative notes about the plan. */
  notes?: string
  /** Optional summary of outcomes after the plan is completed. */
  outcomes?: string
}

/**
 * A single action item within a {@link RecoveryPlan},
 * representing one concrete step toward reducing trainer burnout.
 */
export interface RecoveryPlanAction {
  /** Unique identifier for this action. */
  id: string
  /** The category of recovery action being taken. */
  type: RecoveryAction
  /** Detailed description of what this action entails. */
  description: string
  /** ISO 8601 date string by which this action should be completed. */
  targetDate: string
  /** Whether this action has been marked as completed. */
  completed: boolean
  /** ISO 8601 date string of when the action was completed, if applicable. */
  completedDate?: string
  /** User ID of whoever marked the action as complete. */
  completedBy?: string
  /** Description of the measurable impact this action had. */
  impact?: string
  /** Optional additional notes about this action. */
  notes?: string
}

/**
 * Aggregated wellness metrics for a trainer over a given reporting period,
 * used for trend analysis and admin dashboards.
 */
export interface WellnessTrend {
  /** ID of the trainer these trend metrics belong to. */
  trainerId: string
  /** The reporting period label (e.g. "2024-Q1" or a date range string). */
  period: string
  /** Mean mood score across all check-ins in the period. */
  averageMood: number
  /** Mean stress score across all check-ins in the period. */
  averageStress: number
  /** Mean energy score across all check-ins in the period. */
  averageEnergy: number
  /** Total number of check-ins submitted during the period. */
  checkInCount: number
  /** Number of check-ins that included at least one concern. */
  concernsRaised: number
  /** Number of check-ins that required administrative follow-up. */
  followUpsRequired: number
  /** Number of active recovery plans during this period. */
  recoveryPlansActive: number
}

/** How often a scheduled wellness check-in recurs. */
export type CheckInFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
/** Operational status of a check-in schedule. */
export type CheckInScheduleStatus = 'active' | 'paused' | 'completed'

/**
 * Defines a recurring schedule for wellness check-ins assigned to a trainer,
 * including notification and reminder preferences.
 */
export interface CheckInSchedule {
  /** Unique identifier for this check-in schedule. */
  id: string
  /** ID of the trainer this schedule belongs to. */
  trainerId: string
  /** How often check-ins are triggered under this schedule. */
  frequency: CheckInFrequency
  /** Number of days between check-ins when `frequency` is `'custom'`. */
  customDays?: number
  /** ISO 8601 date string for when the schedule becomes active. */
  startDate: string
  /** ISO 8601 date string for when the schedule ends, if bounded. */
  endDate?: string
  /** ISO 8601 date string for the next upcoming check-in. */
  nextScheduledDate: string
  /** ISO 8601 date string of the most recent completed check-in. */
  lastCheckInDate?: string
  /** Current operational status of the schedule. */
  status: CheckInScheduleStatus
  /** Whether in-app or email notifications are enabled for this schedule. */
  notificationEnabled: boolean
  /** Whether automated reminder messages are sent before each check-in. */
  autoReminders: boolean
  /** Number of hours before the check-in that reminders are sent. */
  reminderHoursBefore: number
  /** User ID of the admin who created this schedule. */
  createdBy: string
  /** ISO 8601 timestamp of when this schedule was created. */
  createdAt: string
  /** Optional administrative notes about this schedule. */
  notes?: string
  /** Running total of check-ins completed under this schedule. */
  completedCheckIns: number
  /** Running total of check-ins that were missed under this schedule. */
  missedCheckIns: number
}

/** Recurrence pattern used by a {@link ScheduleTemplate}. */
export type TemplateRecurrenceType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'

/**
 * Describes a single session slot within a {@link ScheduleTemplate},
 * specifying when, where, and how it recurs.
 */
export interface ScheduleTemplateSession {
  /** Day of the week (0 = Sunday … 6 = Saturday) on which the session occurs. */
  dayOfWeek?: number
  /** Which week within the recurrence cycle this session falls on (1-indexed). */
  weekOfCycle?: number
  /** Session start time in HH:mm format. */
  time: string
  /** Duration of the session in minutes. */
  duration: number
  /** Physical or virtual location for the session. */
  location?: string
  /** Maximum number of students that can attend. */
  capacity: number
  /** Certifications that a trainer must hold to lead this session. */
  requiresCertifications: string[]
  /** Optional list of preferred trainer user IDs for this session. */
  preferredTrainers?: string[]
  /** Shift period during which this template session is intended to run. */
  shift?: ShiftType
}

/**
 * A reusable scheduling template that defines a recurring pattern of sessions
 * for a course category, allowing rapid schedule generation.
 */
export interface ScheduleTemplate {
  /** Unique identifier for the template. */
  id: string
  /** Human-readable name for the template. */
  name: string
  /** Description of the template's purpose and usage. */
  description: string
  /** Optional ID of the course this template is associated with. */
  courseId?: string
  /** Category label used for organizing and filtering templates. */
  category: string
  /** Recurrence pattern governing how template sessions repeat. */
  recurrenceType: TemplateRecurrenceType
  /** Number of days in the recurrence cycle when `recurrenceType` is `'custom'`. */
  cycleDays?: number
  /** The individual session slots defined by this template. */
  sessions: ScheduleTemplateSession[]
  /** Whether trainers should be automatically assigned when sessions are generated. */
  autoAssignTrainers: boolean
  /** Whether participants are notified when sessions are generated from this template. */
  notifyParticipants: boolean
  /** User ID of the admin who created this template. */
  createdBy: string
  /** ISO 8601 timestamp of when the template was created. */
  createdAt: string
  /** ISO 8601 timestamp of the last time this template was used to generate sessions. */
  lastUsed?: string
  /** How many times this template has been used to generate sessions. */
  usageCount: number
  /** Searchable tags for categorizing or filtering this template. */
  tags: string[]
  /** Whether this template is available for use. */
  isActive: boolean
}
