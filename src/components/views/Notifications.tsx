import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CheckCircle,
  Warning,
  Info,
  Clock,
  Users as UsersIcon,
  GraduationCap,
  CalendarDots,
  Gear,
  X,
  Check,
  Trash,
  CheckCircle as CheckCircleFilled,
  Heart
} from '@phosphor-icons/react'
import { Notification } from '@/lib/types'
import { format, isToday, isYesterday, isThisWeek } from 'date-fns'
import { cn } from '@/lib/utils'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

/** Props for the Notifications component. */
interface NotificationsProps {
  /** The full list of notifications to display. */
  notifications: Notification[]
  /** Callback invoked when a single notification is marked as read. @param id - The notification ID. */
  onMarkAsRead: (id: string) => void
  /** Callback invoked when a single notification is marked as unread. @param id - The notification ID. */
  onMarkAsUnread: (id: string) => void
  /** Callback invoked to mark every notification as read. */
  onMarkAllAsRead: () => void
  /** Callback invoked to dismiss (delete) a single notification. @param id - The notification ID. */
  onDismiss: (id: string) => void
  /**
   * Callback invoked to dismiss a batch of notifications.
   * @param filter - `'all'` removes every notification; `'read'` removes only read ones.
   */
  onDismissAll: (filter?: 'all' | 'read') => void
  /**
   * Callback invoked when the user navigates away via a notification link.
   * @param view - Target view name.
   * @param data - Optional payload passed to the target view.
   */
  onNavigate: (view: string, data?: any) => void
}

/** Maps each notification type to the Tailwind colour class used for its icon. */
const notificationIconClassNames: Record<Notification['type'], string> = {
  session: 'text-primary',
  assignment: 'text-primary',
  reminder: 'text-accent',
  system: 'text-muted-foreground',
  workload: 'text-destructive',
  completion: 'text-primary'
}

/**
 * Renders the full-page Notifications centre.
 *
 * Displays all application notifications grouped by date (Today, Yesterday, This Week,
 * Earlier) and filterable by type or read/unread state. Supports bulk mark-as-read and
 * bulk dismiss actions with a confirmation dialog.
 */
export function Notifications({
  notifications,
  onMarkAsRead,
  onMarkAsUnread,
  onMarkAllAsRead,
  onDismiss,
  onDismissAll,
  onNavigate
}: NotificationsProps) {
  const [activeTab, setActiveTab] = useState('all')
  const [showDismissAllDialog, setShowDismissAllDialog] = useState(false)
  const [dismissAllFilter, setDismissAllFilter] = useState<'all' | 'read'>('all')

  const unreadNotifications = notifications.filter(n => !n.read)
  const readNotifications = notifications.filter(n => n.read)

  const getFilteredNotifications = () => {
    let filtered = notifications

    switch (activeTab) {
      case 'unread':
        filtered = unreadNotifications
        break
      case 'read':
        filtered = readNotifications
        break
      case 'session':
        filtered = notifications.filter(n => n.type === 'session')
        break
      case 'assignment':
        filtered = notifications.filter(n => n.type === 'assignment')
        break
      case 'reminder':
        filtered = notifications.filter(n => n.type === 'reminder')
        break
      case 'system':
        filtered = notifications.filter(n => n.type === 'system')
        break
      case 'workload':
        filtered = notifications.filter(n => n.type === 'workload')
        break
      case 'high-priority':
        filtered = notifications.filter(n =>
          n.priority === 'high' || n.priority === 'critical'
        )
        break
      default:
        filtered = notifications
    }

    return filtered.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  const filteredNotifications = getFilteredNotifications()

  /**
   * Groups a flat list of notifications into Today, Yesterday, This Week, and Earlier buckets.
   *
   * @param notifs - The notifications to group.
   * @returns An array of `[label, notifications]` tuples, filtered to non-empty groups.
   */
  const groupNotificationsByDate = (notifs: Notification[]) => {
    const groups: { [key: string]: Notification[] } = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Earlier': []
    }

    notifs.forEach(notif => {
      const date = new Date(notif.createdAt)
      if (isToday(date)) {
        groups['Today'].push(notif)
      } else if (isYesterday(date)) {
        groups['Yesterday'].push(notif)
      } else if (isThisWeek(date, { weekStartsOn: 0 })) {
        groups['This Week'].push(notif)
      } else {
        groups['Earlier'].push(notif)
      }
    })

    return Object.entries(groups).filter(([_, notifs]) => notifs.length > 0)
  }

  const groupedNotifications = groupNotificationsByDate(filteredNotifications)

  /**
   * Returns an icon element styled for the notification's type.
   *
   * @param notification - The notification to get an icon for.
   * @returns A Phosphor icon element.
   */
  const getNotificationIcon = (notification: Notification) => {
    const className = notificationIconClassNames[notification.type]

    switch (notification.type) {
      case 'session':
        return <CalendarDots size={20} className={className} />
      case 'assignment':
        return <GraduationCap size={20} className={className} />
      case 'reminder':
        return <Clock size={20} className={className} />
      case 'system':
        return <Gear size={20} className={className} />
      case 'workload':
        return <Heart size={20} className={className} />
      case 'completion':
        return <CheckCircleFilled size={20} className={className} />
      default:
        return <Info size={20} className={className} data-testid="icon-info" />
    }
  }

  /**
   * Returns a styled Badge element for the given priority level, or `null` for low priority.
   *
   * @param priority - The notification priority; omit or pass `'low'` to return `null`.
   * @returns A Badge element or `null`.
   */
  const getPriorityBadge = (priority?: Notification['priority']) => {
    if (!priority || priority === 'low') return null

    const variants = {
      medium: { variant: 'secondary' as const, label: 'Medium' },
      high: { variant: 'default' as const, label: 'High' },
      critical: { variant: 'destructive' as const, label: 'Critical' }
    }

    const config = variants[priority]
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    )
  }

  /**
   * Marks the notification as read and navigates to its link if present.
   *
   * @param notification - The notification that was clicked.
   */
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkAsRead(notification.id)
    }
    if (notification.link) {
      onNavigate(notification.link)
    }
  }

  /**
   * Stores the filter and shows the dismiss-all confirmation dialog.
   *
   * @param filter - `'all'` to dismiss all notifications, or `'read'` to dismiss only read ones.
   */
  const handleDismissAllClick = (filter: 'all' | 'read') => {
    setDismissAllFilter(filter)
    setShowDismissAllDialog(true)
  }

  /** Executes the dismiss-all action with the stored filter and closes the confirmation dialog. */
  const confirmDismissAll = () => {
    onDismissAll(dismissAllFilter)
    setShowDismissAllDialog(false)
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadNotifications.length} unread • {notifications.length} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadNotifications.length > 0 && (
            <Button
              variant="outline"
              onClick={onMarkAllAsRead}
            >
              <Check className="mr-2" size={16} />
              Mark All Read
            </Button>
          )}
          {readNotifications.length > 0 && (
            <Button
              variant="outline"
              onClick={() => handleDismissAllClick('read')}
            >
              <Trash className="mr-2" size={16} />
              Clear Read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => handleDismissAllClick('all')}
            >
              <Trash className="mr-2" size={16} />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <CheckCircle size={64} className="mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground">
                You don't have any notifications right now.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 lg:grid-cols-9 gap-2 h-auto">
                <TabsTrigger value="all" className="text-xs">
                  All
                  <Badge variant="secondary" className="ml-2">
                    {notifications.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-xs">
                  Unread
                  {unreadNotifications.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {unreadNotifications.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="read" className="text-xs">
                  Read
                  <Badge variant="secondary" className="ml-2">
                    {readNotifications.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="high-priority" className="text-xs">
                  Priority
                </TabsTrigger>
                <TabsTrigger value="session" className="text-xs">
                  Sessions
                </TabsTrigger>
                <TabsTrigger value="assignment" className="text-xs">
                  Assignments
                </TabsTrigger>
                <TabsTrigger value="reminder" className="text-xs">
                  Reminders
                </TabsTrigger>
                <TabsTrigger value="workload" className="text-xs">
                  Workload
                </TabsTrigger>
                <TabsTrigger value="system" className="text-xs">
                  System
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Info size={48} className="mx-auto mb-3 opacity-50 text-muted-foreground" />
                <p className="text-muted-foreground">No notifications in this category</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedNotifications.map(([groupName, groupNotifs]) => (
                  <div key={groupName}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">
                      {groupName}
                    </h3>
                    <div className="space-y-2">
                      {groupNotifs.map(notification => (
                        <div
                          key={notification.id}
                          className={cn(
                            'group relative flex items-start gap-4 p-4 rounded-lg border transition-all duration-200',
                            notification.read
                              ? 'border-border bg-background hover:bg-secondary/50'
                              : 'border-accent/30 bg-accent/5 hover:bg-accent/10',
                            notification.link && 'cursor-pointer'
                          )}
                        >
                          <div
                            onClick={() => handleNotificationClick(notification)}
                            className="flex items-start gap-4 flex-1 min-w-0"
                          >
                            <div className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                              notification.type === 'reminder' || notification.type === 'workload'
                                ? 'bg-accent/10'
                                : 'bg-primary/10'
                            )}>
                              {getNotificationIcon(notification)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2 mb-1">
                                <div className="font-medium text-foreground flex-1">
                                  {notification.title}
                                </div>
                                {getPriorityBadge(notification.priority)}
                                {!notification.read && (
                                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mb-2">
                                {notification.message}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                                </span>
                                <span>•</span>
                                <Badge variant="outline" className="text-xs">
                                  {notification.type}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                            {!notification.read ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Mark ${notification.title} as read`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onMarkAsRead(notification.id)
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Check size={16} />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Mark ${notification.title} as unread`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onMarkAsUnread(notification.id)
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Clock size={16} />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Dismiss ${notification.title}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                onDismiss(notification.id)
                              }}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <X size={16} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showDismissAllDialog} onOpenChange={setShowDismissAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dismissAllFilter === 'all'
                ? 'Clear All Notifications?'
                : 'Clear Read Notifications?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dismissAllFilter === 'all'
                ? `This will permanently delete all ${notifications.length} notifications. This action cannot be undone.`
                : `This will permanently delete ${readNotifications.length} read notifications. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDismissAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear {dismissAllFilter === 'all' ? 'All' : 'Read'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
