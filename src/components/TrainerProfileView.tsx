import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, Session, Course, Enrollment, DayOfWeek } from '@/lib/types'
import { Calendar, Clock, GraduationCap, MapPin, Briefcase, ChartBar, PencilSimple } from '@phosphor-icons/react'
import { differenceInYears, differenceInMonths } from 'date-fns'
import { UnconfiguredScheduleAlert } from '@/components/UnconfiguredScheduleAlert'

interface TrainerProfileViewProps {
  user: User
  sessions: Session[]
  courses: Course[]
  enrollments: Enrollment[]
  onEdit?: () => void
}

const DAY_ORDER: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_ABBREV: Record<DayOfWeek, string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
}

export function TrainerProfileView({ user, sessions, courses, enrollments, onEdit }: TrainerProfileViewProps) {
  const trainerSessions = sessions.filter(s => s.trainerId === user.id)
  const upcomingSessions = trainerSessions.filter(s => new Date(s.startTime) > new Date())
  const completedSessions = trainerSessions.filter(s => s.status === 'completed')

  const totalWeeklyHours = user.trainerProfile?.shiftSchedules.reduce(
    (sum, schedule) => sum + schedule.totalHoursPerWeek,
    0
  ) || 0

  const uniqueCoursesTaught = new Set(trainerSessions.map(s => s.courseId)).size

  const yearsOfService = differenceInYears(new Date(), new Date(user.hireDate))
  const monthsOfService = differenceInMonths(new Date(), new Date(user.hireDate))

  const utilization = totalWeeklyHours > 0 
    ? Math.min(100, Math.round((upcomingSessions.length * 2 / totalWeeklyHours) * 100))
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-3xl font-semibold">{user.name}</h2>
            <p className="text-muted-foreground">{user.email}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="default">{user.role}</Badge>
              <Badge variant="outline">{user.department}</Badge>
            </div>
          </div>
        </div>
        {onEdit && (
          <Button onClick={onEdit}>
            <PencilSimple size={18} weight="bold" className="mr-2" />
            Edit Profile
          </Button>
        )}
      </div>

      {user.role === 'trainer' && <UnconfiguredScheduleAlert user={user} onEdit={onEdit} />}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{upcomingSessions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completedSessions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Courses Taught</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{uniqueCoursesTaught}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{utilization}%</div>
            <Progress value={utilization} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar size={20} />
              Tenure Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Hire Date</p>
                <p className="text-lg font-semibold">
                  {new Date(user.hireDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Service</p>
                <p className="text-lg font-semibold">
                  {yearsOfService > 0 ? `${yearsOfService} years` : `${monthsOfService} months`}
                </p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Badge ID</p>
              <p className="text-base font-medium">{user.badgeId || 'Not assigned'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap size={20} />
              Certifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {user.certifications.length > 0 ? (
                user.certifications.map(cert => (
                  <Badge key={cert} variant="secondary" className="text-sm">
                    {cert}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No certifications</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {user.trainerProfile && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={20} />
                Shift Schedules
              </CardTitle>
              <CardDescription>
                Weekly work schedule across all assigned shifts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user.trainerProfile.shiftSchedules.length > 0 ? (
                <>
                  {user.trainerProfile.shiftSchedules.map((schedule, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="default" className="text-sm">
                            {schedule.shiftCode}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {schedule.shiftType}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium">
                          {schedule.startTime} - {schedule.endTime}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Days:</span>
                        <div className="flex gap-1">
                          {DAY_ORDER.map(day => {
                            const isWorked = schedule.daysWorked.includes(day)
                            return (
                              <div
                                key={day}
                                className={`w-10 h-10 rounded-md flex items-center justify-center text-xs font-medium ${
                                  isWorked
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {DAY_ABBREV[day]}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <Badge variant="secondary">
                          {schedule.totalHoursPerWeek} hrs/week
                        </Badge>
                        <Badge variant="outline">
                          {schedule.daysWorked.length} days/week
                        </Badge>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <span className="font-medium">Total Weekly Hours</span>
                    <Badge className="text-base">{totalWeeklyHours} hours</Badge>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No shift schedules configured
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase size={20} />
                Authorized Teaching Roles
              </CardTitle>
              <CardDescription>
                Job roles and positions this trainer is authorized to teach
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {user.trainerProfile.authorizedRoles.length > 0 ? (
                  user.trainerProfile.authorizedRoles.map(role => (
                    <Badge key={role} variant="default" className="text-sm px-3 py-1">
                      {role}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No authorized roles configured</p>
                )}
              </div>
            </CardContent>
          </Card>

          {user.trainerProfile.specializations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChartBar size={20} />
                  Specializations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {user.trainerProfile.specializations.map(spec => (
                    <Badge key={spec} variant="secondary" className="text-sm px-3 py-1">
                      {spec}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(user.trainerProfile.maxWeeklyHours || user.trainerProfile.preferredLocation || user.trainerProfile.notes) && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {user.trainerProfile.maxWeeklyHours && (
                  <div>
                    <p className="text-sm text-muted-foreground">Max Weekly Hours</p>
                    <p className="text-base font-medium">{user.trainerProfile.maxWeeklyHours} hours</p>
                  </div>
                )}
                {user.trainerProfile.preferredLocation && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin size={14} />
                      Preferred Location
                    </p>
                    <p className="text-base font-medium">{user.trainerProfile.preferredLocation}</p>
                  </div>
                )}
                {user.trainerProfile.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">Notes</p>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{user.trainerProfile.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
