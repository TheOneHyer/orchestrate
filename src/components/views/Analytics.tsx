import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendUp, Users as UsersIcon, GraduationCap, CheckCircle, Clock } from '@phosphor-icons/react'
import { AttendanceRecord, User, Enrollment, Session, Course } from '@/lib/types'

/** Props for the Analytics view component. */
interface AnalyticsProps {
  /** All users in the system (employees and trainers). */
  users: User[]
  /** All enrollment records used to compute completion and score metrics. */
  enrollments: Enrollment[]
  /** All training sessions used to compute session completion metrics. */
  sessions: Session[]
  /** All courses used to compute per-course performance metrics. */
  courses: Course[]
  /** First-class attendance records used to compute attendance metrics. */
  attendanceRecords?: AttendanceRecord[]
}

/**
 * Converts an arbitrary string value into a URL-safe, lowercase slug.
 * Replaces non-alphanumeric characters with hyphens and trims leading/trailing hyphens.
 * @param value - The source string to slugify.
 * @returns A stable, kebab-case slug derived from the input.
 */
function toStableSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Returns a human-readable label describing a trainer count, handling singular/plural form.
 * @param count - Number of trainers.
 * @returns A formatted string such as "1 trainer" or "3 trainers".
 */
function trainerLabel(count: number): string {
  return `${count} trainer${count === 1 ? '' : 's'}`
}

/**
 * Renders the Analytics view with training performance metrics and insights.
 *
 * Displays summary KPI cards (total employees, completion rate, average score, sessions),
 * a top-courses-by-completion table with progress bars, a department distribution breakdown,
 * and a trainer schedule configuration status panel.
 *
 * @param users - All users for computing employee/trainer counts and department distribution.
 * @param enrollments - All enrollments for completion and score calculations.
 * @param sessions - All sessions for session completion metrics.
 * @param courses - All courses for per-course performance analysis.
 * @returns The rendered Analytics page element.
 */
export function Analytics({ users, enrollments, sessions, courses, attendanceRecords = [] }: AnalyticsProps) {
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const departmentOptions = useMemo(() => {
    return Array.from(new Set(users.map((user) => user.department))).sort((left, right) => left.localeCompare(right))
  }, [users])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => departmentFilter === 'all' || user.department === departmentFilter)
  }, [departmentFilter, users])

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => courseFilter === 'all' || course.id === courseFilter)
  }, [courseFilter, courses])

  const filteredSessions = useMemo(() => {
    const allowedCourseIds = new Set(filteredCourses.map((course) => course.id))
    const allowedTrainerIds = new Set(filteredUsers.map((user) => user.id))
    const enrollmentStatusFilters = new Set(['enrolled', 'in-progress', 'completed', 'failed'])

    return sessions.filter((session) => {
      const matchesDepartment = departmentFilter === 'all' || allowedTrainerIds.has(session.trainerId)
      const matchesCourse = courseFilter === 'all' || allowedCourseIds.has(session.courseId)
      const matchesStatus = statusFilter === 'all' || enrollmentStatusFilters.has(statusFilter) || session.status === statusFilter

      return matchesDepartment && matchesCourse && matchesStatus
    })
  }, [courseFilter, departmentFilter, filteredCourses, filteredUsers, sessions, statusFilter])

  const filteredEnrollments = useMemo(() => {
    const allowedCourseIds = new Set(filteredCourses.map((course) => course.id))
    const allowedUserIds = new Set(filteredUsers.map((user) => user.id))
    const sessionStatusById = new Map(sessions.map((session) => [session.id, session.status]))
    const enrollmentStatusFilters = new Set(['enrolled', 'in-progress', 'completed', 'failed'])
    const sessionStatusFilters = new Set(['scheduled', 'cancelled'])

    return enrollments.filter((enrollment) => {
      const matchesDepartment = departmentFilter === 'all' || allowedUserIds.has(enrollment.userId)
      const matchesCourse = courseFilter === 'all' || allowedCourseIds.has(enrollment.courseId)
      const isEnrollmentStatus = enrollmentStatusFilters.has(statusFilter)
      const isSessionStatus = sessionStatusFilters.has(statusFilter)
      const matchesStatus =
        statusFilter === 'all' ||
        (isEnrollmentStatus && enrollment.status === statusFilter) ||
        (isSessionStatus && !!enrollment.sessionId && sessionStatusById.get(enrollment.sessionId) === statusFilter)

      return matchesDepartment && matchesCourse && matchesStatus
    })
  }, [courseFilter, departmentFilter, enrollments, filteredCourses, filteredUsers, sessions, statusFilter])

  const totalEnrollments = filteredEnrollments.length
  const completedEnrollments = filteredEnrollments.filter(e => e.status === 'completed').length
  const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0

  const totalSessions = filteredSessions.length
  const completedSessions = filteredSessions.filter(s => s.status === 'completed').length

  const averageScore = filteredEnrollments
    .filter(e => e.score !== undefined)
    .reduce((sum, e) => sum + (e.score || 0), 0) / filteredEnrollments.filter(e => e.score !== undefined).length || 0

  const employeeCount = filteredUsers.filter(u => u.role === 'employee').length
  const trainerCount = filteredUsers.filter(u => u.role === 'trainer').length
  const visibleSessionIds = new Set(filteredSessions.map((session) => session.id))
  const filteredAttendance = attendanceRecords.filter((record) => visibleSessionIds.has(record.sessionId))
  const presentLikeCount = filteredAttendance.filter((record) => record.status === 'present' || record.status === 'late').length
  const attendanceRate = filteredAttendance.length > 0
    ? Math.round((presentLikeCount / filteredAttendance.length) * 100)
    : 0

  const fullCourses = filteredCourses
    .map(course => {
      const courseEnrollments = filteredEnrollments.filter(e => e.courseId === course.id)
      const courseCompletions = courseEnrollments.filter(e => e.status === 'completed').length
      const courseAvgScore = courseEnrollments
        .filter(e => e.score !== undefined)
        .reduce((sum, e) => sum + (e.score || 0), 0) / courseEnrollments.filter(e => e.score !== undefined).length || 0

      return {
        course,
        enrollments: courseEnrollments.length,
        completions: courseCompletions,
        completionRate: courseEnrollments.length > 0 ? (courseCompletions / courseEnrollments.length) * 100 : 0,
        avgScore: courseAvgScore
      }
    })
  const topCourses = fullCourses
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 5)

  const atRiskCourses = fullCourses.filter((course) => course.completionRate < 60 || course.avgScore < 75)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1">Training performance and insights</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger aria-label="Filter by department">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departmentOptions.map((department) => (
              <SelectItem key={department} value={department}>{department}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger aria-label="Filter by course">
            <SelectValue placeholder="Filter by course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in-progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="failed">Failed enrollments</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UsersIcon size={16} />
              Total Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div data-testid="employee-count" className="text-3xl font-semibold text-foreground">{employeeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {trainerCount} trainers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <GraduationCap size={16} />
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div data-testid="completion-rate" className="text-3xl font-semibold text-foreground">{completionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendUp size={12} className="text-green-600" />
              {completedEnrollments} of {totalEnrollments}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle size={16} />
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div data-testid="average-score" className="text-3xl font-semibold text-foreground">{Math.round(averageScore)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all courses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock size={16} />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div data-testid="sessions-completed" className="text-3xl font-semibold text-foreground">{completedSessions}/{totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle size={16} />
              Attendance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div data-testid="attendance-rate" className="text-3xl font-semibold text-foreground">{attendanceRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {presentLikeCount} present/late of {filteredAttendance.length} marks
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational Highlights</CardTitle>
          <CardDescription>Focus areas based on the current filters</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Filtered enrollments</div>
            <div data-testid="filtered-enrollments-value" className="mt-1 text-2xl font-semibold">{totalEnrollments}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Courses needing attention</div>
            <div className="mt-1 text-2xl font-semibold">{atRiskCourses.length}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Open sessions</div>
            <div className="mt-1 text-2xl font-semibold">{filteredSessions.filter((session) => session.status === 'scheduled' || session.status === 'in-progress').length}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Course Performance</CardTitle>
          <CardDescription>Top courses by completion rate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {topCourses.map(({ course, enrollments: enr, completions, completionRate: rate, avgScore: score }) => (
            <div key={course.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-foreground">{course.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {enr} enrolled • {completions} completed
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-foreground">{Math.round(rate)}%</div>
                  <div className="text-xs text-muted-foreground">
                    Avg: {Math.round(score)}%
                  </div>
                </div>
              </div>
              <Progress value={rate} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Department Distribution</CardTitle>
            <CardDescription>Employees by department</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from(new Set(filteredUsers.map(u => u.department)))
              .map(dept => {
                const deptUsers = filteredUsers.filter(u => u.department === dept && u.role === 'employee')
                const count = deptUsers.length
                const percentage = employeeCount > 0 ? (count / employeeCount) * 100 : 0
                return { dept, count, percentage }
              })
              .sort((a, b) => b.count - a.count)
              .map(({ dept, count, percentage }) => (
                <div key={dept} data-testid={`department-${toStableSlug(dept)}`} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{dept}</span>
                    <span className="text-sm text-muted-foreground">{count} employees • {Math.round(percentage)}%</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trainer Schedule Status</CardTitle>
            <CardDescription>Work schedule configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const trainersWithSchedules = filteredUsers.filter(u =>
                u.role === 'trainer' &&
                u.trainerProfile?.shiftSchedules &&
                u.trainerProfile.shiftSchedules.length > 0
              )
              const trainersWithoutSchedules = trainerCount - trainersWithSchedules.length
              const configuredPercentage = trainerCount > 0 ? (trainersWithSchedules.length / trainerCount) * 100 : 0
              const unconfiguredPercentage = trainerCount > 0 ? (trainersWithoutSchedules / trainerCount) * 100 : 0

              return (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">Configured</span>
                      <span data-testid="configured-trainers" className="text-sm text-muted-foreground">{trainerLabel(trainersWithSchedules.length)} • {Math.round(configuredPercentage)}%</span>
                    </div>
                    <Progress value={configuredPercentage} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">Not Configured</span>
                      <span data-testid="unconfigured-trainers" className="text-sm text-muted-foreground">{trainerLabel(trainersWithoutSchedules)} • {Math.round(unconfiguredPercentage)}%</span>
                    </div>
                    <Progress value={unconfiguredPercentage} className="h-2" />
                  </div>
                </>
              )
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
