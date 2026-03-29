import { useMemo, useState, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { format, differenceInDays } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Heart,
  Plus,
  ClipboardText,
  Warning,
  CheckCircle,
  Clock,
  SmileyXEyes,
  FirstAid,
  CalendarCheck,
  Pause,
  Play,
  X,
  PencilSimple,
  Bell,
  BellSlash
} from '@phosphor-icons/react'
import { User, Session, WellnessCheckIn, RecoveryPlan, CheckInSchedule } from '@/lib/types'
import { WellnessCheckInDialog } from '@/components/WellnessCheckInDialog'
import { RecoveryPlanDialog } from '@/components/RecoveryPlanDialog'
import { CheckInScheduleDialog } from '@/components/CheckInScheduleDialog'
import { calculateWellnessScore, analyzeWellnessTrend, getWellnessStatus, shouldTriggerRecoveryPlan, getWellnessInsights } from '@/lib/wellness-analytics'
import { calculateTrainerUtilization } from '@/lib/burnout-analytics'
import { useCheckInScheduler } from '@/hooks/use-check-in-scheduler'
import { toast } from 'sonner'

/** Props for the TrainerWellness component. */
interface TrainerWellnessProps {
  /** All users in the system; trainers are derived from this list. */
  users: User[]
  /** All training sessions used to compute utilisation and burnout risk. */
  sessions: Session[]
  /** The currently authenticated user; determines available actions. */
  currentUser: User
  /**
   * Callback for navigating to another view.
   * @param view - Target view name.
   * @param data - Optional payload for the target view.
   */
  onNavigate: (view: string, data?: unknown) => void
}

/**
 * Renders the Trainer Wellness dashboard, showing trainers' wellbeing metrics, check-in history, automated schedules, and recovery plans while exposing admin controls to record check-ins, manage schedules, and create recovery plans.
 *
 * @returns The JSX element for the Trainer Wellness dashboard.
 */
export function TrainerWellness({ users, sessions, currentUser, onNavigate: _onNavigate }: TrainerWellnessProps) {
  const [checkIns, setCheckIns] = useKV<WellnessCheckIn[]>('wellness-check-ins', [])
  const [recoveryPlans, setRecoveryPlans] = useKV<RecoveryPlan[]>('recovery-plans', [])

  const [selectedTrainer, setSelectedTrainer] = useState<string | null>(null)
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false)
  const [recoveryPlanDialogOpen, setRecoveryPlanDialogOpen] = useState(false)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<CheckInSchedule | undefined>()
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month')

  const handleTriggerCheckIn = useCallback((trainerId: string, trainerName: string) => {
    toast.info('Wellness Check-In Due', {
      description: `${trainerName} has a scheduled wellness check-in due now.`,
      action: {
        label: 'Open Check-In',
        onClick: () => {
          setSelectedTrainer(trainerId)
          setCheckInDialogOpen(true)
        }
      },
      duration: 10000
    })
  }, [])

  const { schedules, setSchedules } = useCheckInScheduler(
    users,
    checkIns || [],
    handleTriggerCheckIn
  )

  const trainers = useMemo(() =>
    users.filter(u => u.role === 'trainer'),
    [users]
  )

  const safeCheckIns = useMemo(() => checkIns || [], [checkIns])
  const safeRecoveryPlans = useMemo(() => recoveryPlans || [], [recoveryPlans])

  const trainerWellnessData = useMemo(() => {
    return trainers.map(trainer => {
      const trainerCheckIns = safeCheckIns.filter(c => c.trainerId === trainer.id)
      const latestCheckIn = trainerCheckIns.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0]

      const wellnessScore = latestCheckIn ? calculateWellnessScore(latestCheckIn) : 0
      const wellnessStatus = getWellnessStatus(wellnessScore)
      const trend = analyzeWellnessTrend(safeCheckIns, trainer.id, timeRange)
      const utilization = calculateTrainerUtilization(trainer, sessions, [], timeRange, safeCheckIns)
      const insights = getWellnessInsights(safeCheckIns, trainer.id)
      const activeRecoveryPlans = safeRecoveryPlans.filter(
        p => p.trainerId === trainer.id && p.status === 'active'
      )

      const { shouldTrigger, reasons } = shouldTriggerRecoveryPlan(
        safeCheckIns,
        trainer.id,
        utilization.utilizationRate
      )

      return {
        trainer,
        latestCheckIn,
        wellnessScore,
        wellnessStatus,
        trend,
        utilization: utilization.utilizationRate,
        insights,
        activeRecoveryPlans,
        shouldTriggerRecovery: shouldTrigger,
        recoveryReasons: reasons,
        checkInCount: trainerCheckIns.length
      }
    }).sort((a, b) => {
      if (a.shouldTriggerRecovery && !b.shouldTriggerRecovery) return -1
      if (!a.shouldTriggerRecovery && b.shouldTriggerRecovery) return 1
      return a.wellnessScore - b.wellnessScore
    })
  }, [trainers, safeCheckIns, safeRecoveryPlans, sessions, timeRange])

  const criticalTrainers = trainerWellnessData.filter(t => t.wellnessStatus === 'critical' || t.wellnessStatus === 'poor')
  const avgWellnessScore = trainerWellnessData.reduce((sum, t) => sum + t.wellnessScore, 0) / trainerWellnessData.length || 0
  const totalActiveRecoveryPlans = safeRecoveryPlans.filter(p => p.status === 'active').length
  const pendingFollowUps = safeCheckIns.filter(c => c.followUpRequired && !c.followUpCompleted).length

  /**
   * Records a new wellness check-in and conditionally recommends a recovery plan.
   *
   * @param checkInData - The check-in fields excluding auto-generated `id` and `timestamp`.
   */
  const handleCreateCheckIn = (checkInData: Omit<WellnessCheckIn, 'id' | 'timestamp'>) => {
    const newCheckIn: WellnessCheckIn = {
      ...checkInData,
      id: `checkin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    }

    setCheckIns((current) => [...(current || []), newCheckIn])

    const trainer = trainers.find(t => t.id === checkInData.trainerId)
    toast.success('Check-in Recorded', {
      description: `Wellness check-in for ${trainer?.name} has been recorded successfully.`
    })

    const utilization = calculateTrainerUtilization(
      trainer!,
      sessions,
      [],
      timeRange,
      safeCheckIns
    )

    const { shouldTrigger } = shouldTriggerRecoveryPlan(
      [...safeCheckIns, newCheckIn],
      checkInData.trainerId,
      utilization.utilizationRate
    )

    if (shouldTrigger) {
      toast.warning('Recovery Plan Recommended', {
        description: `Based on this check-in, a recovery plan is recommended for ${trainer?.name}.`,
        action: {
          label: 'Create Plan',
          onClick: () => {
            setSelectedTrainer(checkInData.trainerId)
            setRecoveryPlanDialogOpen(true)
          }
        }
      })
    }
  }

  /**
   * Creates and persists a new trainer recovery plan.
   *
   * @param plan - The recovery plan fields excluding auto-generated `id` and `createdAt`.
   */
  const handleCreateRecoveryPlan = (plan: Omit<RecoveryPlan, 'id' | 'createdAt'>) => {
    const newPlan: RecoveryPlan = {
      ...plan,
      id: `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    }

    setRecoveryPlans((current) => [...(current || []), newPlan])

    const trainer = trainers.find(t => t.id === plan.trainerId)
    toast.success('Recovery Plan Created', {
      description: `Recovery plan for ${trainer?.name} has been created successfully.`
    })
  }

  /**
   * Creates a new check-in schedule or updates an existing one if `editingSchedule` is set.
   *
   * @param scheduleData - The schedule fields excluding auto-generated `id`, `createdAt`, and counters.
   */
  const handleCreateOrUpdateSchedule = (scheduleData: Omit<CheckInSchedule, 'id' | 'createdAt' | 'completedCheckIns' | 'missedCheckIns'>) => {
    if (editingSchedule) {
      setSchedules((current) =>
        (current || []).map(s =>
          s.id === editingSchedule.id
            ? { ...s, ...scheduleData }
            : s
        )
      )
      const trainer = trainers.find(t => t.id === scheduleData.trainerId)
      toast.success('Schedule Updated', {
        description: `Check-in schedule for ${trainer?.name} has been updated.`
      })
    } else {
      const newSchedule: CheckInSchedule = {
        ...scheduleData,
        id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        completedCheckIns: 0,
        missedCheckIns: 0
      }
      setSchedules((current) => [...(current || []), newSchedule])
      const trainer = trainers.find(t => t.id === scheduleData.trainerId)
      toast.success('Schedule Created', {
        description: `Check-in schedule for ${trainer?.name} has been created successfully.`
      })
    }
    setEditingSchedule(undefined)
  }

  /**
   * Toggles the schedule's status between `'active'` and `'paused'`.
   *
   * @param scheduleId - ID of the schedule to toggle.
   */
  const handleToggleScheduleStatus = (scheduleId: string) => {
    setSchedules((current) =>
      (current || []).map(s =>
        s.id === scheduleId
          ? { ...s, status: s.status === 'active' ? 'paused' : 'active' as const }
          : s
      )
    )
  }

  /**
   * Permanently removes the check-in schedule with the given ID.
   *
   * @param scheduleId - ID of the schedule to delete.
   */
  const handleDeleteSchedule = (scheduleId: string) => {
    setSchedules((current) => (current || []).filter(s => s.id !== scheduleId))
    toast.success('Schedule Deleted', {
      description: 'Check-in schedule has been removed.'
    })
  }

  /**
   * Returns the Tailwind background color class for the given wellness status.
   *
   * @param status - The wellness status string.
   * @returns A `bg-*` Tailwind class.
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-500'
      case 'good': return 'bg-green-400'
      case 'fair': return 'bg-yellow-500'
      case 'poor': return 'bg-orange-500'
      case 'critical': return 'bg-destructive'
      default: return 'bg-muted'
    }
  }

  /**
   * Returns a styled Badge element for the given wellness status string.
   *
   * @param status - The wellness status string.
   * @returns A Badge JSX element.
   */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'excellent': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Excellent</Badge>
      case 'good': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Good</Badge>
      case 'fair': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Fair</Badge>
      case 'poor': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Poor</Badge>
      case 'critical': return <Badge variant="destructive">Critical</Badge>
      default: return <Badge variant="secondary">Unknown</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <Heart weight="fill" className="text-accent" />
            Trainer Wellness & Recovery
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor wellbeing, track check-ins, and manage recovery plans
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as 'week' | 'month' | 'quarter')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>

          {currentUser.role === 'admin' && (
            <Button onClick={() => setCheckInDialogOpen(true)}>
              <Plus className="mr-2" />
              New Check-In
            </Button>
          )}
        </div>
      </div>

      {criticalTrainers.length > 0 && currentUser.role === 'admin' && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <SmileyXEyes className="h-5 w-5" weight="fill" />
          <AlertTitle className="text-lg font-semibold">
            {criticalTrainers.length} Trainer{criticalTrainers.length > 1 ? 's' : ''} Need Immediate Support
          </AlertTitle>
          <AlertDescription className="mt-2">
            Critical or poor wellness status detected. Review and initiate recovery plans immediately.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Wellness</CardTitle>
            <Heart className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgWellnessScore.toFixed(0)}/100</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all trainers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Status</CardTitle>
            <Warning className="h-5 w-5 text-destructive" weight="fill" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {criticalTrainers.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires intervention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Recovery Plans</CardTitle>
            <FirstAid className="h-5 w-5 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalActiveRecoveryPlans}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Follow-ups</CardTitle>
            <ClipboardText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingFollowUps}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting action
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedules">Automated Schedules</TabsTrigger>
          <TabsTrigger value="check-ins">Check-In History</TabsTrigger>
          <TabsTrigger value="recovery">Recovery Plans</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trainer Wellness Status</CardTitle>
              <CardDescription>
                Current wellness scores and status for all trainers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {trainerWellnessData.map(({ trainer, wellnessScore, wellnessStatus, latestCheckIn, utilization, activeRecoveryPlans, shouldTriggerRecovery, checkInCount }) => (
                    <div
                      key={trainer.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          data-testid="wellness-status-bar"
                          className={`w-2 h-16 rounded-full ${getStatusColor(wellnessStatus)}`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{trainer.name}</p>
                            {shouldTriggerRecovery && (
                              <Badge variant="destructive" className="text-xs">
                                <Warning className="w-3 h-3 mr-1" weight="fill" />
                                Recovery Needed
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <CalendarCheck className="h-4 w-4" />
                              {checkInCount} check-ins
                            </span>
                            {latestCheckIn && (
                              <span>Last: {format(new Date(latestCheckIn.timestamp), 'MMM d, yyyy')}</span>
                            )}
                            <span>Utilization: {utilization.toFixed(0)}%</span>
                          </div>
                          {activeRecoveryPlans.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <FirstAid className="h-4 w-4 text-accent" weight="fill" />
                              <span className="text-sm text-accent font-medium">
                                {activeRecoveryPlans.length} active recovery plan{activeRecoveryPlans.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-2xl font-bold">{wellnessScore}</div>
                          <div className="text-xs text-muted-foreground">score</div>
                        </div>
                        {getStatusBadge(wellnessStatus)}

                        {currentUser.role === 'admin' && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTrainer(trainer.id)
                                setCheckInDialogOpen(true)
                              }}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                            {shouldTriggerRecovery && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedTrainer(trainer.id)
                                  setRecoveryPlanDialogOpen(true)
                                }}
                              >
                                <FirstAid className="w-4 h-4" weight="fill" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Automated Check-In Schedules</h3>
              <p className="text-sm text-muted-foreground">Set up periodic wellness check-ins for trainers</p>
            </div>
            {currentUser.role === 'admin' && (
              <Button onClick={() => {
                setEditingSchedule(undefined)
                setScheduleDialogOpen(true)
              }}>
                <Plus className="mr-2" />
                New Schedule
              </Button>
            )}
          </div>

          {schedules.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <CalendarCheck className="h-16 w-16 mx-auto mb-4 opacity-50" weight="fill" />
                  <p className="font-medium">No automated schedules created yet</p>
                  <p className="text-sm mt-1">Create schedules to automate wellness check-ins for trainers</p>
                  {currentUser.role === 'admin' && (
                    <Button
                      className="mt-4"
                      onClick={() => setScheduleDialogOpen(true)}
                    >
                      <Plus className="mr-2" />
                      Create First Schedule
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {schedules
                .sort((a, b) => {
                  if (a.status === 'active' && b.status !== 'active') return -1
                  if (a.status !== 'active' && b.status === 'active') return 1
                  return new Date(a.nextScheduledDate).getTime() - new Date(b.nextScheduledDate).getTime()
                })
                .map((schedule) => {
                  const trainer = trainers.find(t => t.id === schedule.trainerId)
                  if (!trainer) return null

                  const nextDate = new Date(schedule.nextScheduledDate)
                  const now = new Date()
                  const daysUntilNext = differenceInDays(nextDate, now)
                  const isOverdue = daysUntilNext < 0
                  const isDueSoon = daysUntilNext >= 0 && daysUntilNext <= 2

                  /**
                   * Returns a human-readable label for the given check-in frequency.
                   *
                   * @param freq - The frequency identifier string.
                   * @returns A localized label string.
                   */
                  const getFrequencyLabel = (freq: string) => {
                    switch (freq) {
                      case 'daily': return 'Daily'
                      case 'weekly': return 'Weekly'
                      case 'biweekly': return 'Bi-weekly'
                      case 'monthly': return 'Monthly'
                      case 'custom': return `Every ${schedule.customDays} days`
                      default: return freq
                    }
                  }

                  return (
                    <Card key={schedule.id} className={isOverdue && schedule.status === 'active' ? 'border-destructive' : ''}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2">
                              <CalendarCheck weight="fill" className="text-accent" />
                              {trainer.name}
                            </CardTitle>
                            <CardDescription className="mt-1 space-y-1">
                              <div className="flex items-center gap-4">
                                <span>{getFrequencyLabel(schedule.frequency)} check-ins</span>
                                <span>•</span>
                                <span>Created {format(new Date(schedule.createdAt), 'MMM d, yyyy')}</span>
                              </div>
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={schedule.status === 'active' ? 'default' : 'secondary'}>
                              {schedule.status}
                            </Badge>
                            {schedule.notificationEnabled ? (
                              <Bell className="h-4 w-4 text-accent" weight="fill" />
                            ) : (
                              <BellSlash className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Next Check-In</p>
                            <p className={`text-lg font-semibold ${isOverdue ? 'text-destructive' : isDueSoon ? 'text-accent' : ''
                              }`}>
                              {isOverdue ? 'Overdue' : isDueSoon ? 'Due Soon' : format(nextDate, 'MMM d')}
                            </p>
                            {!isOverdue && (
                              <p className="text-xs text-muted-foreground">
                                {daysUntilNext === 0 ? 'Today' : `${daysUntilNext} days`}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Completed</p>
                            <p className="text-lg font-semibold text-green-600">
                              {schedule.completedCheckIns}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Missed</p>
                            <p className="text-lg font-semibold text-destructive">
                              {schedule.missedCheckIns}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Completion Rate</p>
                            <p className="text-lg font-semibold">
                              {schedule.completedCheckIns + schedule.missedCheckIns > 0
                                ? `${Math.round((schedule.completedCheckIns / (schedule.completedCheckIns + schedule.missedCheckIns)) * 100)}%`
                                : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {schedule.lastCheckInDate && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4" weight="fill" />
                            Last check-in: {format(new Date(schedule.lastCheckInDate), 'PPP')}
                          </div>
                        )}

                        {schedule.endDate && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Ends: {format(new Date(schedule.endDate), 'PPP')}
                          </div>
                        )}

                        {schedule.autoReminders && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Bell className="h-4 w-4" />
                            Automatic reminders {schedule.reminderHoursBefore} hours before
                          </div>
                        )}

                        {schedule.notes && (
                          <div className="p-3 bg-muted/30 rounded text-sm">
                            <p className="font-medium mb-1">Notes:</p>
                            <p className="text-muted-foreground">{schedule.notes}</p>
                          </div>
                        )}

                        {currentUser.role === 'admin' && (
                          <div className="flex items-center gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTrainer(trainer.id)
                                setCheckInDialogOpen(true)
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Manual Check-In
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingSchedule(schedule)
                                setScheduleDialogOpen(true)
                              }}
                            >
                              <PencilSimple className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleScheduleStatus(schedule.id)}
                            >
                              {schedule.status === 'active' ? (
                                <>
                                  <Pause className="mr-2 h-4 w-4" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="mr-2 h-4 w-4" />
                                  Resume
                                </>
                              )}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete this schedule for ${trainer.name}?`)) {
                                  handleDeleteSchedule(schedule.id)
                                }
                              }}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="check-ins" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Check-In History</h3>
              <p className="text-sm text-muted-foreground">All wellness check-ins across trainers</p>
            </div>
            <Select
              value={selectedTrainer || 'all'}
              onValueChange={(v) => setSelectedTrainer(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trainers</SelectItem>
                {trainers.map(trainer => (
                  <SelectItem key={trainer.id} value={trainer.id}>
                    {trainer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {safeCheckIns
                    .filter(c => !selectedTrainer || c.trainerId === selectedTrainer)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((checkIn) => {
                      const trainer = trainers.find(t => t.id === checkIn.trainerId)
                      const score = calculateWellnessScore(checkIn)
                      const status = getWellnessStatus(score)

                      return (
                        <div key={checkIn.id} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{trainer?.name}</p>
                                {getStatusBadge(status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(checkIn.timestamp), 'PPpp')}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold">{score}</div>
                              <div className="text-xs text-muted-foreground">Wellness Score</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-3">
                            <div className="text-center p-2 bg-muted/30 rounded">
                              <div className="text-lg font-semibold">{checkIn.mood}/5</div>
                              <div className="text-xs text-muted-foreground">Mood</div>
                            </div>
                            <div className="text-center p-2 bg-muted/30 rounded">
                              <div className="text-lg font-semibold capitalize">{checkIn.stress}</div>
                              <div className="text-xs text-muted-foreground">Stress</div>
                            </div>
                            <div className="text-center p-2 bg-muted/30 rounded">
                              <div className="text-lg font-semibold capitalize">{checkIn.energy}</div>
                              <div className="text-xs text-muted-foreground">Energy</div>
                            </div>
                            <div className="text-center p-2 bg-muted/30 rounded">
                              <div className="text-lg font-semibold">{checkIn.workloadSatisfaction}/5</div>
                              <div className="text-xs text-muted-foreground">Workload</div>
                            </div>
                          </div>

                          {checkIn.concerns && checkIn.concerns.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">Concerns:</p>
                              <div className="flex flex-wrap gap-2">
                                {checkIn.concerns.map((concern, idx) => (
                                  <Badge key={idx} variant="outline">{concern}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {checkIn.comments && (
                            <div>
                              <p className="text-sm font-medium">Comments:</p>
                              <p className="text-sm text-muted-foreground mt-1">{checkIn.comments}</p>
                            </div>
                          )}

                          {checkIn.followUpRequired && (
                            <div className="flex items-center gap-2 p-2 bg-accent/10 rounded">
                              <ClipboardText className="h-4 w-4 text-accent" weight="fill" />
                              <span className="text-sm font-medium">
                                Follow-up {checkIn.followUpCompleted ? 'completed' : 'required'}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}

                  {safeCheckIns.filter(c => !selectedTrainer || c.trainerId === selectedTrainer).length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Heart className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">No check-ins recorded yet</p>
                      <p className="text-sm mt-1">Start tracking wellness by creating a check-in</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recovery" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Recovery Plans</h3>
              <p className="text-sm text-muted-foreground">Active and completed recovery interventions</p>
            </div>
            {currentUser.role === 'admin' && (
              <Button onClick={() => setRecoveryPlanDialogOpen(true)}>
                <Plus className="mr-2" />
                Create Recovery Plan
              </Button>
            )}
          </div>

          <div className="grid gap-6">
            {safeRecoveryPlans
              .sort((a, b) => {
                if (a.status === 'active' && b.status !== 'active') return -1
                if (a.status !== 'active' && b.status === 'active') return 1
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              })
              .map((plan) => {
                const trainer = trainers.find(t => t.id === plan.trainerId)
                const completedActions = plan.actions.filter(a => a.completed).length
                const progress = plan.actions.length > 0 ? (completedActions / plan.actions.length) * 100 : 0

                return (
                  <Card key={plan.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <FirstAid weight="fill" className="text-accent" />
                            {trainer?.name} - Recovery Plan
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Created {format(new Date(plan.createdAt), 'PPP')}
                          </CardDescription>
                        </div>
                        <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                          {plan.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Trigger Reason:</p>
                        <p className="text-sm text-muted-foreground">{plan.triggerReason}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Target Utilization</p>
                          <p className="text-lg font-semibold">{plan.targetUtilization}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Current Utilization</p>
                          <p className="text-lg font-semibold">{plan.currentUtilization}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Target Date</p>
                          <p className="text-lg font-semibold">
                            {format(new Date(plan.targetCompletionDate), 'MMM d')}
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">Progress</p>
                          <p className="text-sm text-muted-foreground">
                            {completedActions} of {plan.actions.length} actions completed
                          </p>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      <Separator />

                      <div>
                        <p className="text-sm font-medium mb-3">Recovery Actions:</p>
                        <div className="space-y-2">
                          {plan.actions.map((action) => (
                            <div
                              key={action.id}
                              className={`flex items-start gap-3 p-3 border rounded-lg ${action.completed ? 'bg-muted/30' : ''
                                }`}
                            >
                              {action.completed ? (
                                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" weight="fill" />
                              ) : (
                                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                              )}
                              <div className="flex-1">
                                <p className="text-sm font-medium">{action.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Target: {format(new Date(action.targetDate), 'MMM d, yyyy')}
                                  {action.completed && action.completedDate && (
                                    <> • Completed: {format(new Date(action.completedDate), 'MMM d, yyyy')}</>
                                  )}
                                </p>
                              </div>
                              <Badge variant="outline" className="capitalize">
                                {action.type.replace('-', ' ')}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      {plan.notes && (
                        <div>
                          <p className="text-sm font-medium">Notes:</p>
                          <p className="text-sm text-muted-foreground mt-1">{plan.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}

            {safeRecoveryPlans.length === 0 && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <FirstAid className="h-16 w-16 mx-auto mb-4 opacity-50" weight="fill" />
                    <p className="font-medium">No recovery plans created yet</p>
                    <p className="text-sm mt-1">Create recovery plans for trainers who need support</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Wellness Insights</CardTitle>
              <CardDescription>
                AI-powered insights and recommendations for each trainer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  {trainerWellnessData.map(({ trainer, insights, recoveryReasons, shouldTriggerRecovery }) => (
                    <div key={trainer.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-lg">{trainer.name}</h4>
                        {shouldTriggerRecovery && (
                          <Badge variant="destructive">
                            <Warning className="w-3 h-3 mr-1" weight="fill" />
                            Action Needed
                          </Badge>
                        )}
                      </div>

                      {shouldTriggerRecovery && recoveryReasons.length > 0 && (
                        <Alert className="border-destructive/50 bg-destructive/5">
                          <Warning className="h-4 w-4" weight="fill" />
                          <AlertTitle>Recovery Plan Recommended</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              {recoveryReasons.map((reason, idx) => (
                                <li key={idx} className="text-sm">{reason}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2">
                        {insights.map((insight, idx) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-3 p-3 border rounded-lg ${insight.severity === 'critical' ? 'border-destructive/50 bg-destructive/5' :
                              insight.severity === 'warning' ? 'border-orange-500/50 bg-orange-50/50' :
                                'bg-muted/30'
                              }`}
                          >
                            {insight.severity === 'critical' ? (
                              <Warning className="h-5 w-5 text-destructive mt-0.5" weight="fill" />
                            ) : insight.severity === 'warning' ? (
                              <Warning className="h-5 w-5 text-orange-500 mt-0.5" />
                            ) : (
                              <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                            )}
                            <p className="text-sm flex-1">{insight.insight}</p>
                          </div>
                        ))}
                      </div>

                      <Separator />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {currentUser.role === 'admin' && (
        <>
          <WellnessCheckInDialog
            open={checkInDialogOpen}
            onClose={() => {
              setCheckInDialogOpen(false)
              setSelectedTrainer(null)
            }}
            trainerId={selectedTrainer || trainers[0]?.id || ''}
            trainerName={trainers.find(t => t.id === selectedTrainer)?.name || trainers[0]?.name || ''}
            onSubmit={handleCreateCheckIn}
            currentUtilization={
              selectedTrainer
                ? calculateTrainerUtilization(
                  trainers.find(t => t.id === selectedTrainer)!,
                  sessions,
                  [],
                  timeRange,
                  safeCheckIns
                ).utilizationRate
                : undefined
            }
          />

          <RecoveryPlanDialog
            open={recoveryPlanDialogOpen}
            onClose={() => {
              setRecoveryPlanDialogOpen(false)
              setSelectedTrainer(null)
            }}
            trainerId={selectedTrainer || ''}
            trainerName={trainers.find(t => t.id === selectedTrainer)?.name || ''}
            currentUser={currentUser}
            onSubmit={handleCreateRecoveryPlan}
            latestCheckIn={
              selectedTrainer
                ? safeCheckIns
                  .filter(c => c.trainerId === selectedTrainer)
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
                : undefined
            }
            currentUtilization={
              selectedTrainer
                ? calculateTrainerUtilization(
                  trainers.find(t => t.id === selectedTrainer)!,
                  sessions,
                  [],
                  timeRange,
                  safeCheckIns
                ).utilizationRate
                : undefined
            }
          />

          <CheckInScheduleDialog
            open={scheduleDialogOpen}
            onClose={() => {
              setScheduleDialogOpen(false)
              setEditingSchedule(undefined)
            }}
            trainers={trainers}
            onSubmit={handleCreateOrUpdateSchedule}
            currentUserId={currentUser.id}
            existingSchedule={editingSchedule}
          />
        </>
      )}
    </div>
  )
}
