import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { MagnifyingGlass, Users as UsersIcon, Certificate, Clock, CalendarBlank, X, ChartBar, Scales, CalendarCheck, WarningCircle } from '@phosphor-icons/react'
import { User, Session, Course, DayOfWeek } from '@/lib/types'
import { format, startOfWeek, addDays, isSameDay, addWeeks, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { analyzeWorkloadBalance, WorkloadRecommendation } from '@/lib/workload-balancer'
import { WorkloadRecommendations } from '@/components/WorkloadRecommendations'
import { UnconfiguredScheduleAlert } from '@/components/UnconfiguredScheduleAlert'
import { TrainerCoverageHeatmap } from '@/components/TrainerCoverageHeatmap'
import { RecommendationDetailsDialog } from '@/components/RecommendationDetailsDialog'

/** Props for the TrainerAvailability component. */
interface TrainerAvailabilityProps {
  /** All users in the system; trainers are filtered from this list. */
  users: User[]
  /** All training sessions used to compute each trainer's weekly workload. */
  sessions: Session[]
  /** All available courses (used in the detailed trainer side-panel). */
  courses: Course[]
  /**
   * Callback for navigating to another view.
   * @param view - Target view name.
   * @param data - Optional payload for the target view.
   */
  onNavigate: (view: string, data?: unknown) => void
}

/** Aggregated schedule information for a single trainer within the selected week. */
interface TrainerSchedule {
  /** The trainer user record. */
  trainer: User
  /** Sessions assigned to this trainer during the selected week. */
  sessions: Session[]
  /** Total available working hours for the trainer in the selected week. */
  availableHours: number
  /** Percentage of weekly capacity already committed (0–100+). */
  utilizationRate: number
}

/**
 * Renders the Trainer Availability view.
 *
 * Displays a weekly grid of trainer schedules, allowing admins to see workload distribution,
 * filter by certification, search by name, and inspect detailed availability in a side panel.
 * Trainers without configured shift schedules can be hidden via a toggle.
 */
export function TrainerAvailability({ users, sessions, courses, onNavigate }: TrainerAvailabilityProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCertification, setSelectedCertification] = useState<string>('all')
  const [selectedTrainer, setSelectedTrainer] = useState<User | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hideUnconfigured, setHideUnconfigured] = useState(false)
  const [selectedRecommendation, setSelectedRecommendation] = useState<WorkloadRecommendation | null>(null)
  const [recommendationDialogOpen, setRecommendationDialogOpen] = useState(false)

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const trainers = useMemo(() =>
    users.filter(u => u.role === 'trainer'),
    [users]
  )

  const allCertifications = useMemo(() => {
    const certs = new Set<string>()
    trainers.forEach(t => t.certifications.forEach(c => certs.add(c)))
    return Array.from(certs).sort()
  }, [trainers])

  const filteredTrainers = useMemo(() => {
    return trainers.filter(trainer => {
      const matchesSearch = trainer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trainer.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCert = selectedCertification === 'all' || trainer.certifications.includes(selectedCertification)
      const hasSchedule = hideUnconfigured
        ? (trainer.trainerProfile?.shiftSchedules && trainer.trainerProfile.shiftSchedules.length > 0)
        : true
      return matchesSearch && matchesCert && hasSchedule
    })
  }, [trainers, searchTerm, selectedCertification, hideUnconfigured])

  const trainerSchedules = useMemo(() => {
    return filteredTrainers.map(trainer => {
      const trainerSessions = sessions.filter(s => s.trainerId === trainer.id)
      const weekSessions = trainerSessions.filter(s =>
        isWithinInterval(new Date(s.startTime), {
          start: startOfDay(weekStart),
          end: endOfDay(addDays(weekStart, 6))
        })
      )

      const totalHours = weekSessions.reduce((sum, session) => {
        const startTime = new Date(session.startTime).getTime()
        const endTime = new Date(session.endTime).getTime()
        const duration = Math.abs(endTime - startTime) / (1000 * 60 * 60)
        return sum + duration
      }, 0)

      const maxHoursPerWeek = 40
      const utilizationRate = (totalHours / maxHoursPerWeek) * 100

      return {
        trainer,
        sessions: weekSessions,
        availableHours: Math.max(0, maxHoursPerWeek - totalHours),
        utilizationRate
      }
    })
  }, [filteredTrainers, sessions, weekStart])

  /**
   * Memoized map of trainer sessions indexed by trainerId and date key.
   * Prevents repeated O(sessions) scans during grid rendering.
   */
  const trainerSessionMap = useMemo(() => {
    const map = new Map<string, Map<string, Session[]>>()
    sessions.forEach(session => {
      if (!map.has(session.trainerId)) {
        map.set(session.trainerId, new Map())
      }
      const dateKey = format(new Date(session.startTime), 'yyyy-MM-dd')
      const dayMap = map.get(session.trainerId)!
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, [])
      }
      dayMap.get(dateKey)!.push(session)
    })
    return map
  }, [sessions])

  /**
   * Returns all sessions assigned to the given trainer that fall on the specified day.
   *
   * @param trainerId - The trainer ID to filter by.
   * @param day - The calendar day to match.
   * @returns The matching sessions.
   */
  const getTrainerSessionsForDay = (trainerId: string, day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    return trainerSessionMap.get(trainerId)?.get(dateKey) || []
  }

  /**
   * Sets the selected trainer and opens the detail side sheet.
   *
   * @param trainer - The trainer to display in the sheet.
   */
  const handleTrainerClick = (trainer: User) => {
    setSelectedTrainer(trainer)
    setSheetOpen(true)
  }

  /**
   * Returns a Tailwind text-color class based on the utilization rate.
   *
   * @param rate - Utilization rate as a percentage (0–100+).
   * @returns A Tailwind utility class string.
   */
  const getUtilizationColor = (rate: number) => {
    if (rate >= 90) return 'text-red-600 font-semibold'
    if (rate >= 70) return 'text-orange-600 font-medium'
    if (rate >= 40) return 'text-green-600'
    return 'text-muted-foreground'
  }

  /**
   * Returns a tier label for the given utilization rate.
   *
   * @param rate - Utilization rate as a percentage (0–100+).
   * @returns One of `'high'`, `'medium'`, `'low'`, or `'minimal'`.
   */
  const getUtilizationTier = (rate: number) => {
    if (rate >= 90) return 'high'
    if (rate >= 70) return 'medium'
    if (rate >= 40) return 'low'
    return 'minimal'
  }

  /**
   * Renders a single trainer's availability row in the grid, including per-day session counts.
   *
   * @param schedule - The trainer schedule data to render.
   * @returns The row JSX element.
   */
  const renderTrainerRow = (schedule: TrainerSchedule) => {
    const { trainer, availableHours, utilizationRate } = schedule
    const hasSchedule = trainer.trainerProfile?.shiftSchedules && trainer.trainerProfile.shiftSchedules.length > 0

    return (
      <div key={trainer.id} className="border-b border-border last:border-b-0">
        <div className="grid grid-cols-[250px_1fr] divide-x divide-border">
          <button
            onClick={() => handleTrainerClick(trainer)}
            className="p-4 hover:bg-secondary/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={trainer.avatar} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {trainer.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground truncate">{trainer.name}</span>
                  {!hasSchedule && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex" tabIndex={0} aria-label="Schedule not configured indicator">
                            <WarningCircle size={14} weight="fill" className="text-amber-600 dark:text-amber-500 flex-shrink-0" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Schedule not configured</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{trainer.department}</div>
              </div>
            </div>
            {!hasSchedule ? (
              <div className="mt-2">
                <Badge variant="outline" className="text-[10px] h-5 text-amber-600 dark:text-amber-500 border-amber-300 dark:border-amber-700">
                  No schedule
                </Badge>
              </div>
            ) : null}
            <div className="flex items-center justify-between mt-3 text-xs">
              <span className={getUtilizationColor(utilizationRate)} data-utilization={getUtilizationTier(utilizationRate)}>
                {utilizationRate.toFixed(0)}% utilized
              </span>
              <span className="text-muted-foreground">
                {availableHours.toFixed(1)}h free
              </span>
            </div>
          </button>

          <div className="grid grid-cols-7 divide-x divide-border">
            {weekDays.map(day => {
              const daySessions = getTrainerSessionsForDay(trainer.id, day)
              const isToday = isSameDay(day, new Date())

              return (
                <div
                  key={day.getTime()}
                  className={`p-2 min-h-[100px] ${isToday ? 'bg-primary/5' : ''}`}
                >
                  <div className="space-y-1">
                    {daySessions.map(session => {
                      const course = courses.find(c => c.id === session.courseId)
                      const startTime = format(new Date(session.startTime), 'h:mm a')
                      const endTime = format(new Date(session.endTime), 'h:mm a')

                      return (
                        <TooltipProvider key={session.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => onNavigate('schedule', { sessionId: session.id })}
                                className="w-full p-1.5 rounded text-left text-[10px] bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                              >
                                <div className="font-medium truncate">{session.title}</div>
                                <div className="opacity-90 truncate">{startTime}</div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px]">
                              <div className="space-y-1">
                                <div className="font-semibold">{session.title}</div>
                                <div className="text-xs">
                                  {startTime} - {endTime}
                                </div>
                                <div className="text-xs">📍 {session.location}</div>
                                <div className="text-xs">
                                  👥 {session.enrolledStudents.length}/{session.capacity}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  /** Renders the slide-out detail sheet for the currently selected trainer. */
  const renderTrainerDetailSheet = () => {
    if (!selectedTrainer) return null

    const trainerSessions = sessions.filter(s => s.trainerId === selectedTrainer.id)
    const upcomingSessions = trainerSessions
      .filter(s => new Date(s.startTime) > new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 10)

    const schedule = trainerSchedules.find(s => s.trainer.id === selectedTrainer.id)
    const profile = selectedTrainer.trainerProfile

    return (
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={selectedTrainer.avatar} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {selectedTrainer.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle>{selectedTrainer.name}</SheetTitle>
              <SheetDescription>{selectedTrainer.email}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <UnconfiguredScheduleAlert user={selectedTrainer} variant="compact" />

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Clock size={16} />
              Availability
            </h3>
            <div className="space-y-2">
              {schedule && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">This Week Utilization:</span>
                    <span className={getUtilizationColor(schedule.utilizationRate)}>
                      {schedule.utilizationRate.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Available Hours:</span>
                    <span className="font-medium">{schedule.availableHours.toFixed(1)}h</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {profile && (
            <>
              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CalendarCheck size={16} />
                  Work Schedule
                </h3>
                {profile.shiftSchedules && profile.shiftSchedules.length > 0 ? (
                  <div className="space-y-2">
                    {profile.shiftSchedules.map((shiftSchedule, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-border bg-secondary/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{shiftSchedule.shiftCode}</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>⏰ {shiftSchedule.startTime} - {shiftSchedule.endTime}</div>
                          <div>📊 {shiftSchedule.totalHoursPerWeek}h per week</div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {shiftSchedule.daysWorked.map(day => (
                              <Badge key={day} variant="outline" className="text-[10px] h-5 capitalize">
                                {day.slice(0, 3)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No detailed work schedule configured</p>
                )}
              </div>

              {profile.tenure && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Tenure</h3>
                    <div className="text-sm">
                      <span className="font-medium">{profile.tenure.yearsOfService}</span> years, <span className="font-medium">{profile.tenure.monthsOfService}</span> months
                      <div className="text-xs text-muted-foreground mt-1">
                        Since {format(new Date(profile.tenure.hireDate), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {profile.authorizedRoles && profile.authorizedRoles.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Authorized to Teach</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.authorizedRoles.map(role => (
                        <Badge key={role} variant="secondary" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Certificate size={16} />
              Certifications
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedTrainer.certifications.length > 0 ? (
                selectedTrainer.certifications.map(cert => (
                  <Badge key={cert} variant="secondary">
                    {cert}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No certifications</span>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CalendarBlank size={16} />
              Upcoming Sessions ({upcomingSessions.length})
            </h3>
            <div className="space-y-2">
              {upcomingSessions.length > 0 ? (
                upcomingSessions.map(session => {
                  const course = courses.find(c => c.id === session.courseId)
                  return (
                    <button
                      key={session.id}
                      onClick={() => {
                        setSheetOpen(false)
                        onNavigate('schedule', { sessionId: session.id })
                      }}
                      className="w-full p-3 rounded-lg border border-border hover:bg-secondary transition-colors text-left"
                    >
                      <div className="font-medium text-sm">{session.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(session.startTime), 'MMM d, yyyy • h:mm a')}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">📍 {session.location}</span>
                        <Badge variant="outline" className="text-xs">
                          {session.enrolledStudents.length}/{session.capacity}
                        </Badge>
                      </div>
                    </button>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming sessions</p>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    )
  }

  /**
   * Computes aggregate availability statistics across all filtered trainers.
   *
   * @returns An object with `totalTrainers`, `avgUtilization`, `totalAvailableHours`, and `overutilizedCount`.
   */
  const calculateAggregateStats = () => {
    const totalTrainers = filteredTrainers.length
    const avgUtilization = trainerSchedules.reduce((sum, s) => sum + s.utilizationRate, 0) / totalTrainers || 0
    const totalAvailableHours = trainerSchedules.reduce((sum, s) => sum + s.availableHours, 0)
    const overutilizedCount = trainerSchedules.filter(s => s.utilizationRate >= 90).length

    return { totalTrainers, avgUtilization, totalAvailableHours, overutilizedCount }
  }

  const stats = calculateAggregateStats()

  const workloadAnalysis = useMemo(() => {
    return analyzeWorkloadBalance(
      users,
      sessions,
      courses,
      startOfDay(weekStart),
      endOfDay(addDays(weekStart, 6))
    )
  }, [users, sessions, courses, weekStart])

  /**
   * Looks up the trainer by ID and opens their detail sheet.
   *
   * @param trainerId - The ID of the trainer to view.
   */
  const handleViewTrainer = (trainerId: string) => {
    const trainer = users.find(u => u.id === trainerId)
    if (trainer) {
      setSelectedTrainer(trainer)
      setSheetOpen(true)
    }
  }

  /**
   * Stores the recommendation and opens the recommendation detail dialog.
   *
   * @param recommendation - The workload recommendation to display.
   */
  const handleOpenRecommendationDetails = (recommendation: WorkloadRecommendation) => {
    setSelectedRecommendation(recommendation)
    setRecommendationDialogOpen(true)
  }

  /**
   * Closes the recommendation dialog and navigates to the schedule view with the recommendation context.
   *
   * @param recommendation - The recommendation to pass as navigation context.
   */
  const handleOpenRecommendationScheduleContext = (recommendation: WorkloadRecommendation) => {
    setRecommendationDialogOpen(false)
    onNavigate('schedule', {
      recommendationType: recommendation.type,
      affectedTrainers: recommendation.affectedTrainers,
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Trainer Availability</h1>
          <p className="text-muted-foreground mt-1">View certified trainers' schedules across all shifts</p>
        </div>
        <Button onClick={() => onNavigate('schedule')}>
          <CalendarBlank size={18} weight="bold" className="mr-2" />
          View Schedule
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="active-trainers-card">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <UsersIcon size={16} />
              Active Trainers
            </CardDescription>
            <CardTitle className="text-3xl">{stats.totalTrainers}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <ChartBar size={16} />
              Avg Utilization
            </CardDescription>
            <CardTitle className={`text-3xl ${getUtilizationColor(stats.avgUtilization)}`}>
              {stats.avgUtilization.toFixed(0)}%
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Clock size={16} />
              Available Hours
            </CardDescription>
            <CardTitle className="text-3xl">{stats.totalAvailableHours.toFixed(0)}h</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <UsersIcon size={16} />
              Over-Utilized
            </CardDescription>
            <CardTitle className={`text-3xl ${stats.overutilizedCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.overutilizedCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="calendar" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarBlank size={16} />
            Session Calendar
          </TabsTrigger>
          <TabsTrigger value="work-schedule" className="flex items-center gap-2">
            <CalendarCheck size={16} />
            Work Schedule
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Scales size={16} />
            Workload Balance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    placeholder="Search trainers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={selectedCertification} onValueChange={setSelectedCertification}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by certification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Certifications</SelectItem>
                    {allCertifications.map(cert => (
                      <SelectItem key={cert} value={cert}>{cert}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(searchTerm || selectedCertification !== 'all') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Clear filters"
                    onClick={() => {
                      setSearchTerm('')
                      setSelectedCertification('all')
                    }}
                  >
                    <X size={18} />
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeek(addWeeks(currentWeek, -1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeek(new Date())}
                  >
                    This Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                  >
                    Next
                  </Button>
                </div>
                <h3 className="text-lg font-medium">
                  {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                </h3>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="grid grid-cols-[250px_1fr] divide-x divide-border border-b border-border">
                <div className="p-3 bg-muted/50 font-medium text-sm">
                  Trainer
                </div>
                <div className="grid grid-cols-7 divide-x divide-border">
                  {weekDays.map(day => {
                    const isToday = isSameDay(day, new Date())
                    return (
                      <div
                        key={day.getTime()}
                        className={`p-3 text-center ${isToday ? 'bg-primary/10' : 'bg-muted/50'}`}
                      >
                        <div className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                          {format(day, 'EEE')}
                        </div>
                        <div className={`text-lg font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                          {format(day, 'd')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {filteredTrainers.length > 0 ? (
                <div>
                  {trainerSchedules.map(schedule => renderTrainerRow(schedule))}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  <UsersIcon size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No trainers found matching your filters</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work-schedule" className="space-y-6">
          <TrainerCoverageHeatmap
            users={users}
            selectedCertification={selectedCertification}
            onCertificationChange={setSelectedCertification}
          />

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    placeholder="Search trainers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={selectedCertification} onValueChange={setSelectedCertification}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by certification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Certifications</SelectItem>
                    {allCertifications.map(cert => (
                      <SelectItem key={cert} value={cert}>{cert}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(searchTerm || selectedCertification !== 'all') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSearchTerm('')
                      setSelectedCertification('all')
                    }}
                  >
                    <X size={18} />
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle>Weekly Work Schedule</CardTitle>
              <CardDescription>
                View trainers' regular work schedules and shift patterns
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <div className="grid grid-cols-[250px_1fr] divide-x divide-border border-b border-border">
                <div className="p-3 bg-muted/50 font-medium text-sm">
                  Trainer
                </div>
                <div className="grid grid-cols-7 divide-x divide-border">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                    <div
                      key={day}
                      className="p-3 text-center bg-muted/50"
                    >
                      <div className="text-xs font-medium text-muted-foreground">
                        {day.slice(0, 3)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {filteredTrainers.length > 0 ? (
                <div>
                  {filteredTrainers.map(trainer => {
                    const profile = trainer.trainerProfile
                    const daysOfWeek: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

                    return (
                      <div key={trainer.id} className="border-b border-border last:border-b-0">
                        <div className="grid grid-cols-[250px_1fr] divide-x divide-border">
                          <button
                            onClick={() => handleTrainerClick(trainer)}
                            className="p-4 hover:bg-secondary/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={trainer.avatar} />
                                <AvatarFallback className="bg-primary text-primary-foreground">
                                  {trainer.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground truncate">{trainer.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{trainer.department}</div>
                              </div>
                            </div>
                            {profile?.tenure && (
                              <div className="text-xs text-muted-foreground mt-2">
                                {profile.tenure.yearsOfService}y {profile.tenure.monthsOfService}m tenure
                              </div>
                            )}
                          </button>

                          <div className="grid grid-cols-7 divide-x divide-border">
                            {daysOfWeek.map(dayOfWeek => {
                              const schedulesForDay = profile?.shiftSchedules?.filter(schedule =>
                                schedule.daysWorked.includes(dayOfWeek)
                              ) || []

                              return (
                                <div
                                  key={dayOfWeek}
                                  className="p-2 min-h-[100px]"
                                >
                                  <div className="space-y-1">
                                    {schedulesForDay.length > 0 ? (
                                      schedulesForDay.map((schedule, idx) => (
                                        <TooltipProvider key={idx}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div
                                                className="w-full p-1.5 rounded text-left text-[10px] cursor-help bg-primary text-primary-foreground"
                                              >
                                                <div className="font-medium truncate">{schedule.shiftCode}</div>
                                                <div className="opacity-90 truncate">
                                                  {schedule.startTime} - {schedule.endTime}
                                                </div>
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-[300px]">
                                              <div className="space-y-1">
                                                <div className="font-semibold">{schedule.shiftCode}</div>
                                                <div className="text-xs">
                                                  ⏰ {schedule.startTime} - {schedule.endTime}
                                                </div>
                                                <div className="text-xs">
                                                  📊 {schedule.totalHoursPerWeek}h/week
                                                </div>
                                                <div className="text-xs">
                                                  📅 {schedule.daysWorked.map(d => d.slice(0, 3)).join(', ')}
                                                </div>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ))
                                    ) : (
                                      <div className="text-[10px] text-muted-foreground/50 text-center pt-4">
                                        Off
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  <UsersIcon size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No trainers found matching your filters</p>
                </div>
              )}
            </CardContent>
          </Card>

          {filteredTrainers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Schedule Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Total Trainers</div>
                    <div className="text-2xl font-semibold">{filteredTrainers.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">With Detailed Schedules</div>
                    <div className="text-2xl font-semibold">
                      {filteredTrainers.filter(t => t.trainerProfile?.shiftSchedules && t.trainerProfile.shiftSchedules.length > 0).length}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Total Weekly Hours</div>
                    <div className="text-2xl font-semibold">
                      {filteredTrainers.reduce((sum, trainer) => {
                        const schedules = trainer.trainerProfile?.shiftSchedules || []
                        return sum + schedules.reduce((s, schedule) => s + schedule.totalHoursPerWeek, 0)
                      }, 0).toFixed(0)}h
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <WorkloadRecommendations
            analysis={workloadAnalysis}
            users={users}
            onViewTrainer={handleViewTrainer}
            onApplyRecommendation={handleOpenRecommendationDetails}
          />
        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {renderTrainerDetailSheet()}
      </Sheet>

      <RecommendationDetailsDialog
        open={recommendationDialogOpen}
        onOpenChange={setRecommendationDialogOpen}
        recommendation={selectedRecommendation}
        users={users}
        onViewTrainer={handleViewTrainer}
        onOpenScheduleContext={handleOpenRecommendationScheduleContext}
      />
    </div>
  )
}
