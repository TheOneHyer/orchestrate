import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Clock, CheckCircle, Warning, Users as UsersIcon, X, Check } from '@phosphor-icons/react'
import { User, Session, Notification, Enrollment, Course } from '@/lib/types'
import { formatDuration } from '@/lib/helpers'
import { format } from 'date-fns'

interface DashboardProps {
  currentUser: User
  upcomingSessions: Session[]
  notifications: Notification[]
  enrollments: Enrollment[]
  courses: Course[]
  onNavigate: (view: string, data?: any) => void
  onMarkNotificationAsRead?: (id: string) => void
  onDismissNotification?: (id: string) => void
}

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
            <div className="text-3xl font-semibold text-foreground">
              {unreadNotifications.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              unread messages
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
