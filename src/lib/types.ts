export type UserRole = 'admin' | 'trainer' | 'employee'

export type ShiftType = 'day' | 'evening' | 'night'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  badgeId?: string
  department: string
  shifts: ShiftType[]
  certifications: string[]
  hireDate: string
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
  shift: ShiftType
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
