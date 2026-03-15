import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TrendUp, TrendDown, Users as UsersIcon, GraduationCap, CheckCircle, Clock } from '@phosphor-icons/react'
import { User, Enrollment, Session, Course } from '@/lib/types'

interface AnalyticsProps {
  users: User[]
  enrollments: Enrollment[]
  sessions: Session[]
  courses: Course[]
}

export function Analytics({ users, enrollments, sessions, courses }: AnalyticsProps) {
  const totalEnrollments = enrollments.length
  const completedEnrollments = enrollments.filter(e => e.status === 'completed').length
  const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0
  
  const totalSessions = sessions.length
  const completedSessions = sessions.filter(s => s.status === 'completed').length
  
  const averageScore = enrollments
    .filter(e => e.score !== undefined)
    .reduce((sum, e) => sum + (e.score || 0), 0) / enrollments.filter(e => e.score !== undefined).length || 0

  const employeeCount = users.filter(u => u.role === 'employee').length
  const trainerCount = users.filter(u => u.role === 'trainer').length

  const topCourses = courses
    .map(course => {
      const courseEnrollments = enrollments.filter(e => e.courseId === course.id)
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
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 5)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1">Training performance and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UsersIcon size={16} />
              Total Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{employeeCount}</div>
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
            <div className="text-3xl font-semibold text-foreground">{completionRate}%</div>
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
            <div className="text-3xl font-semibold text-foreground">{Math.round(averageScore)}%</div>
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
            <div className="text-3xl font-semibold text-foreground">{completedSessions}/{totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Completed
            </p>
          </CardContent>
        </Card>
      </div>

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
            {Array.from(new Set(users.map(u => u.department)))
              .map(dept => {
                const deptUsers = users.filter(u => u.department === dept && u.role === 'employee')
                const percentage = (deptUsers.length / employeeCount) * 100
                return { dept, count: deptUsers.length, percentage }
              })
              .sort((a, b) => b.count - a.count)
              .map(({ dept, count, percentage }) => (
                <div key={dept} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{dept}</span>
                    <span className="text-sm text-muted-foreground">{count} employees</span>
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
              const trainersWithSchedules = users.filter(u => 
                u.role === 'trainer' && 
                u.trainerProfile?.shiftSchedules && 
                u.trainerProfile.shiftSchedules.length > 0
              )
              const trainersWithoutSchedules = trainerCount - trainersWithSchedules.length
              const configuredPercentage = (trainersWithSchedules.length / trainerCount) * 100
              const unconfiguredPercentage = (trainersWithoutSchedules / trainerCount) * 100
              
              return (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">Configured</span>
                      <span className="text-sm text-muted-foreground">{trainersWithSchedules.length} trainers</span>
                    </div>
                    <Progress value={configuredPercentage} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">Not Configured</span>
                      <span className="text-sm text-muted-foreground">{trainersWithoutSchedules} trainers</span>
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
