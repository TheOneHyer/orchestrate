import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Clock, CheckCircle, Warning, X, Check } from '@phosphor-icons/react'
import { User, Session, Notification, Enrollment, Course } from '@/lib/types'
import { formatDuration } from '@/lib/helpers'
import { buildLearningFocusItems } from '@/lib/learning-insights'
import { buildLearningDeadlineInsights } from '@/lib/learning-deadlines'
import { buildLearningPathRecommendations } from '@/lib/competency-insights'
import { buildLearningEngagementItems } from '@/lib/learning-engagement'
import { format } from 'date-fns'

/** Props for the Dashboard home view component. */
interface DashboardProps {
  /** The currently authenticated user whose data is highlighted. */
  currentUser: User
  /** Upcoming training sessions relevant to the current user. */
  upcomingSessions: Session[]
  /** Recent notifications displayed in the dashboard notification panel. */
  notifications: Notification[]
  /** All enrollments used to compute progress summaries. */
  enrollments: Enrollment[]
  /** All courses referenced by sessions and enrollments. */
  courses: Course[]
  /** Navigation callback invoked with a view name and optional data. */
  onNavigate: (view: string, data?: unknown) => void
  /** Optional callback to mark a notification as read by its ID. */
  onMarkNotificationAsRead?: (id: string) => void
  /** Optional callback to dismiss a notification by its ID. */
  onDismissNotification?: (id: string) => void
}

/**
 * Renders the main Dashboard home view for the currently authenticated user.
 *
 * Shows a personalized welcome section, upcoming session cards, a notification feed
 * with mark-as-read and dismiss actions, and an enrollment progress summary with
 * per-course progress bars. Navigation links direct users to detailed views.
 *
 * @param currentUser - The logged-in user; name and role are displayed.
 * @param upcomingSessions - Sessions scheduled in the near future.
 * @param notifications - In-app notifications for the current user.
 * @param enrollments - Enrollment records for tracking course progress.
 * @param courses - Course catalog used to resolve enrollment course names.
 * @param onNavigate - Callback to navigate to another view.
 * @param onMarkNotificationAsRead - Callback to mark a notification as read.
 * @param onDismissNotification - Callback to dismiss a notification.
 * @returns The rendered Dashboard JSX element.
 */
export function Dashboard({
  currentUser,
  upcomingSessions,
  notifications,
  enrollments,
  courses,
  onNavigate,
  onMarkNotificationAsRead,
  onDismissNotification
}: DashboardProps) {
  const unreadNotifications = notifications.filter(n => !n.read)
  const activeEnrollments = enrollments.filter(e => e.status === 'in-progress')
  const completedCount = enrollments.filter(e => e.status === 'completed').length
  const learningFocusItems = buildLearningFocusItems(enrollments, courses)
  const learningDeadlineItems = buildLearningDeadlineInsights(enrollments, courses)
  const learningEngagementItems = buildLearningEngagementItems(enrollments, courses)
  const learningPathRecommendations = buildLearningPathRecommendations(currentUser, courses, enrollments)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">
          Welcome back, {currentUser.name.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Courses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {activeEnrollments.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedCount} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle data-testid="upcoming-sessions-heading" className="text-sm font-medium text-muted-foreground">
              Upcoming Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {upcomingSessions.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Next: {upcomingSessions[0] ? format(new Date(upcomingSessions[0].startTime), 'MMM d, h:mm a') : 'None scheduled'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div data-testid="unread-count" className="text-3xl font-semibold text-foreground">
              {unreadNotifications.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              unread messages
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {learningPathRecommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recommended Learning Path</CardTitle>
              <CardDescription>Next-best courses to close certification gaps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {learningPathRecommendations.map((recommendation) => (
                <button
                  key={recommendation.courseId}
                  onClick={() => onNavigate('courses', { courseId: recommendation.courseId })}
                  className="w-full rounded-lg border border-border p-3 text-left hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{recommendation.courseTitle}</p>
                    <Badge variant="secondary">{recommendation.gapClosureCount} gap{recommendation.gapClosureCount === 1 ? '' : 's'}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{recommendation.reason}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {learningDeadlineItems.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Deadline Watch</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('notifications', { tab: 'learning-reminders' })}
                >
                  Open Learning Alerts
                </Button>
              </div>
              <CardDescription>Upcoming and overdue learner completion targets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {learningDeadlineItems.slice(0, 3).map((item) => (
                <button
                  key={item.enrollmentId}
                  onClick={() => onNavigate('courses', { courseId: item.courseId })}
                  className="w-full rounded-lg border border-border p-3 text-left hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{item.courseTitle}</p>
                    <Badge variant={item.urgency === 'overdue' ? 'destructive' : item.urgency === 'due-soon' ? 'secondary' : 'outline'}>
                      {item.urgency === 'overdue' ? 'overdue' : item.urgency === 'due-soon' ? 'due soon' : 'on track'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.isOverdue
                      ? `${Math.abs(item.daysUntilDue)} day${Math.abs(item.daysUntilDue) === 1 ? '' : 's'} overdue`
                      : `Due in ${item.daysUntilDue} day${item.daysUntilDue === 1 ? '' : 's'}`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.progress}% complete</p>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {learningFocusItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Learning Focus</CardTitle>
              <CardDescription>Prioritized actions to keep learners on track</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {learningFocusItems.slice(0, 3).map((item) => {
                const badgeVariant = item.riskLevel === 'at-risk' ? 'destructive' : item.riskLevel === 'watch' ? 'secondary' : 'outline'
                return (
                  <button
                    key={item.enrollmentId}
                    onClick={() => onNavigate('courses', { courseId: item.courseId })}
                    className="w-full rounded-lg border border-border p-3 text-left hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{item.courseTitle}</p>
                      <Badge variant={badgeVariant}>{item.riskLevel}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.progress}% complete • {item.daysSinceEnrollment} days active
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Gap to expected pace: {item.progressGap}%
                    </p>
                    <p className="mt-2 text-sm">{item.recommendedAction}</p>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        )}

        {learningEngagementItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Engagement Watch</CardTitle>
              <CardDescription>Learners with stalled progress that need a nudge</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {learningEngagementItems.slice(0, 3).map((item) => (
                <button
                  key={item.enrollmentId}
                  onClick={() => onNavigate('courses', { courseId: item.courseId })}
                  className="w-full rounded-lg border border-border p-3 text-left hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{item.courseTitle}</p>
                    <Badge variant={item.severity === 'critical-stall' ? 'destructive' : 'secondary'}>
                      {item.severity === 'critical-stall' ? 'critical stall' : 'stalled'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No progress for {item.daysSinceProgress} day{item.daysSinceProgress === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.progress}% complete</p>
                  <p className="mt-2 text-sm">{item.recommendedAction}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Sessions</CardTitle>
            <CardDescription>Your scheduled training sessions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock size={48} className="mx-auto mb-3 opacity-50" />
                <p>No upcoming sessions</p>
              </div>
            ) : (
              upcomingSessions.slice(0, 5).map(session => {
                const course = courses.find(c => c.id === session.courseId)
                return (
                  <button
                    key={session.id}
                    onClick={() => onNavigate('schedule', { sessionId: session.id })}
                    className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock size={20} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{session.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(session.startTime), 'MMM d, h:mm a')} - {format(new Date(session.endTime), 'h:mm a')}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {session.location}
                        </Badge>
                        {course && (
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(course.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={session.status === 'scheduled' ? 'secondary' : 'default'}>
                      {session.status}
                    </Badge>
                  </button>
                )
              })
            )}
            {upcomingSessions.length > 5 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onNavigate('schedule')}
              >
                View All Sessions
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Notifications</CardTitle>
            <CardDescription>Important updates and reminders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle size={48} className="mx-auto mb-3 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.slice(0, 5).map(notification => (
                <div
                  key={notification.id}
                  className="group relative"
                >
                  <button
                    onClick={() => {
                      if (notification.link) onNavigate(notification.link)
                    }}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${notification.read
                      ? 'border-border bg-background'
                      : 'border-accent/30 bg-accent/5'
                      }`}
                  >
                    <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${notification.type === 'reminder' || notification.type === 'system'
                      ? 'bg-accent/10'
                      : 'bg-primary/10'
                      }`}>
                      {notification.type === 'reminder' || notification.type === 'system' ? (
                        <Warning size={20} className="text-accent" />
                      ) : (
                        <CheckCircle size={20} className="text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{notification.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
                    )}
                  </button>
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.read && onMarkNotificationAsRead && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Mark ${notification.title} as read`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onMarkNotificationAsRead(notification.id)
                        }}
                        className="h-7 w-7 p-0 bg-background/80 hover:bg-background"
                      >
                        <Check size={14} />
                      </Button>
                    )}
                    {onDismissNotification && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Dismiss ${notification.title}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDismissNotification(notification.id)
                        }}
                        className="h-7 w-7 p-0 bg-background/80 hover:bg-background text-destructive hover:text-destructive"
                      >
                        <X size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
            {notifications.length > 5 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onNavigate('notifications')}
              >
                View All Notifications
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {activeEnrollments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>In Progress</CardTitle>
            <CardDescription>Continue your learning journey</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeEnrollments.slice(0, 3).map(enrollment => {
              const course = courses.find(c => c.id === enrollment.courseId)
              if (!course) return null

              return (
                <button
                  key={enrollment.id}
                  onClick={() => onNavigate('courses', { courseId: course.id })}
                  className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-secondary transition-colors text-left"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {course.title.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{course.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {course.modules.length} modules • {formatDuration(course.duration)}
                    </div>
                    <div className="mt-2">
                      <Progress value={enrollment.progress} className="h-2" />
                      <div className="text-xs text-muted-foreground mt-1">
                        {enrollment.progress}% complete
                      </div>
                    </div>
                  </div>
                  {enrollment.score !== undefined && (
                    <Badge variant="outline" className="flex-shrink-0">
                      Score: {enrollment.score}%
                    </Badge>
                  )}
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
