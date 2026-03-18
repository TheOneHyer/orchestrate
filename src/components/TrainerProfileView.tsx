import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, Session, Course, Enrollment, DayOfWeek, CertificationRecord } from '@/lib/types'
import { Calendar, Clock, GraduationCap, MapPin, Briefcase, ChartBar, PencilSimple, Trash, Certificate } from '@phosphor-icons/react'
import { differenceInYears, differenceInMonths, format, parseISO } from 'date-fns'
import { UnconfiguredScheduleAlert } from '@/components/UnconfiguredScheduleAlert'
import { ManageCertificationsDialog } from '@/components/ManageCertificationsDialog'
import { useState } from 'react'
import { calculateCertificationStatus } from '@/lib/certification-tracker'

/**
 * Props for the {@link TrainerProfileView} component.
 */
interface TrainerProfileViewProps {
  /** The user whose profile is displayed. */
  user: User
  /** All sessions in the system; filtered internally to those assigned to this trainer. */
  sessions: Session[]
  /** All courses in the system; available for future cross-referencing. */
  courses: Course[]
  /** All enrollment records; available for future analytics. */
  enrollments: Enrollment[]
  /** Optional callback to open the edit profile dialog. */
  onEdit?: () => void
  /** Optional callback to trigger the delete confirmation flow. */
  onDelete?: () => void
  /**
   * Optional callback invoked with an updated user object when inline edits are saved
   * (e.g., from the embedded {@link ManageCertificationsDialog}).
   * @param user - The updated user data.
   */
  onUpdateUser?: (user: User) => void
}

/** Canonical sort order for days of the week, used when rendering shift schedule day chips. */
const DAY_ORDER: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
/** Maps each {@link DayOfWeek} key to a three-character display abbreviation. */
const DAY_ABBREV: Record<DayOfWeek, string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
}

/**
 * Read-only profile view for a trainer or employee.
 *
 * Displays a header with the user's avatar, name, email, role, and department alongside
 * Edit/Delete action buttons (when callbacks are provided). Below the header, summary stat
 * cards show upcoming sessions, completed sessions, distinct courses taught, and current
 * utilization. Sections for tenure, certifications, shift schedules, specializations, and
 * authorized roles are rendered for trainer users. An {@link UnconfiguredScheduleAlert} is
 * shown when a trainer has no configured shift schedule.
 */
export function TrainerProfileView({ user, sessions, courses, enrollments, onEdit, onDelete, onUpdateUser }: TrainerProfileViewProps) {
  const [certDialogOpen, setCertDialogOpen] = useState(false)
  
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
        <div className="flex gap-2">
          {onEdit && (
            <Button onClick={onEdit}>
              <PencilSimple size={18} weight="bold" className="mr-2" />
              Edit Profile
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              <Trash size={18} weight="bold" className="mr-2" />
              Delete Person
            </Button>
          )}
        </div>
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
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Certificate size={20} />
                Certifications
              </CardTitle>
              {user.role === 'trainer' && onUpdateUser && (
                <Button variant="outline" size="sm" onClick={() => setCertDialogOpen(true)}>
                  <PencilSimple size={16} weight="bold" className="mr-2" />
                  Manage
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {user.role === 'trainer' && user.trainerProfile?.certificationRecords && user.trainerProfile.certificationRecords.length > 0 ? (
              <div className="space-y-3">
                {user.trainerProfile.certificationRecords.map((cert, idx) => {
                  const status = calculateCertificationStatus(cert)
                  const daysUntil = Math.floor(
                    (new Date(cert.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  )
                  
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{cert.certificationName}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires: {format(parseISO(cert.expirationDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {cert.renewalInProgress && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                            Renewal
                          </Badge>
                        )}
                        <Badge className={
                          status === 'expired' ? 'bg-red-100 text-red-800 border-red-200' :
                          status === 'expiring-soon' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          'bg-green-100 text-green-800 border-green-200'
                        }>
                          {status === 'expired' && 'Expired'}
                          {status === 'expiring-soon' && `${daysUntil}d left`}
                          {status === 'active' && 'Active'}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
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
            )}
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
      
      {user.role === 'trainer' && onUpdateUser && (
        <ManageCertificationsDialog
          open={certDialogOpen}
          onOpenChange={setCertDialogOpen}
          certifications={user.trainerProfile?.certificationRecords || []}
          onSave={(certifications) => {
            const updatedUser = {
              ...user,
              trainerProfile: {
                ...user.trainerProfile!,
                certificationRecords: certifications
              }
            }
            onUpdateUser(updatedUser)
            setCertDialogOpen(false)
          }}
        />
      )}
    </div>
  )
}
