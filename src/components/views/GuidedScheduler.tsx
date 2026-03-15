import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  UserCircleGear, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  CheckCircle, 
  WarningCircle,
  Lightning,
  ArrowRight,
  Sparkle,
  Info,
  TrendUp,
  TrendDown,
  ChartLine,
  Fire,
  BatteryCharging
} from '@phosphor-icons/react'
import { TrainerScheduler, SchedulingConstraints, TrainerMatch } from '@/lib/scheduler'
import { User, Course, Session, ShiftType, WellnessCheckIn, RecoveryPlan } from '@/lib/types'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { calculateTrainerWorkload } from '@/lib/workload-balancer'
import { calculateBurnoutRisk } from '@/lib/burnout-analytics'

interface GuidedSchedulerProps {
  users: User[]
  courses: Course[]
  onSessionsCreated: (sessions: Partial<Session>[]) => void
  onClose?: () => void
  prefilledDate?: Date | null
}

interface TrainerInsights extends TrainerMatch {
  workloadHours: number
  utilizationRate: number
  burnoutRisk: number
  recentWellnessScore?: number
  hasActiveRecoveryPlan: boolean
  recommendationLevel: 'optimal' | 'good' | 'caution' | 'avoid'
}

export function GuidedScheduler({ users, courses, onSessionsCreated, onClose, prefilledDate }: GuidedSchedulerProps) {
  const [sessions] = useKV<Session[]>('sessions', [])
  const [wellnessCheckIns] = useKV<WellnessCheckIn[]>('wellness-check-ins', [])
  const [recoveryPlans] = useKV<RecoveryPlan[]>('recovery-plans', [])
  
  const initialDate = prefilledDate ? format(prefilledDate, 'yyyy-MM-dd') : ''
  
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [selectedShifts, setSelectedShifts] = useState<ShiftType[]>(['day'])
  const [startDate, setStartDate] = useState(initialDate)
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [location, setLocation] = useState('')
  const [capacity, setCapacity] = useState(20)
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none')
  
  const [step, setStep] = useState<'parameters' | 'trainer-selection' | 'confirmation'>(
    'parameters'
  )
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('')
  const [trainerInsights, setTrainerInsights] = useState<TrainerInsights[]>([])
  const [sessionDates, setSessionDates] = useState<string[]>([])
  const [hideUnconfigured, setHideUnconfigured] = useState(false)

  const selectedCourseData = courses.find(c => c.id === selectedCourse)

  const handleShiftToggle = (shift: ShiftType) => {
    setSelectedShifts(prev =>
      prev.includes(shift)
        ? prev.filter(s => s !== shift)
        : [...prev, shift]
    )
  }

  const analyzeTrainers = () => {
    if (!selectedCourse || !startDate || selectedShifts.length === 0) {
      toast.error('Please fill in all required fields')
      return
    }

    const scheduler = new TrainerScheduler(
      users,
      sessions || [],
      courses
    )

    const course = courses.find(c => c.id === selectedCourse)
    if (!course) return

    const dates: string[] = []
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : new Date(startDate)
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0])
    }

    setSessionDates(dates)

    const constraints: SchedulingConstraints = {
      courseId: selectedCourse,
      requiredCertifications: course.certifications,
      shifts: selectedShifts,
      dates: [startDate],
      startTime,
      endTime,
      location: location || 'TBD',
      capacity
    }

    const trainers = scheduler.findAvailableTrainers(constraints, new Date(startDate))

    const enrichedTrainers: TrainerInsights[] = trainers.map(match => {
      const workload = calculateTrainerWorkload(
        match.trainer,
        sessions || [],
        new Date(startDate),
        new Date(end)
      )

      const recentCheckIns = (wellnessCheckIns || [])
        .filter(c => c.trainerId === match.trainer.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5)

      const burnoutRisk = calculateBurnoutRisk(
        match.trainer.id,
        sessions || [],
        recentCheckIns,
        users,
        courses
      )

      const recentWellnessScore = recentCheckIns.length > 0
        ? (recentCheckIns[0].mood + 
           (6 - parseFloat(recentCheckIns[0].stress || '0')) + 
           recentCheckIns[0].workloadSatisfaction) / 3
        : undefined

      const hasActiveRecoveryPlan = (recoveryPlans || []).some(
        plan => plan.trainerId === match.trainer.id && plan.status === 'active'
      )

      let recommendationLevel: 'optimal' | 'good' | 'caution' | 'avoid' = 'good'
      
      if (hasActiveRecoveryPlan || burnoutRisk.risk === 'high' || burnoutRisk.risk === 'critical') {
        recommendationLevel = 'avoid'
      } else if (workload.utilizationRate > 85 || burnoutRisk.risk === 'moderate') {
        recommendationLevel = 'caution'
      } else if (workload.utilizationRate >= 60 && workload.utilizationRate <= 75 && match.score >= 80) {
        recommendationLevel = 'optimal'
      }

      return {
        ...match,
        workloadHours: workload.totalHours,
        utilizationRate: workload.utilizationRate,
        burnoutRisk: burnoutRisk.riskScore,
        recentWellnessScore,
        hasActiveRecoveryPlan,
        recommendationLevel
      }
    })

    enrichedTrainers.sort((a, b) => {
      const levelOrder = { optimal: 0, good: 1, caution: 2, avoid: 3 }
      if (levelOrder[a.recommendationLevel] !== levelOrder[b.recommendationLevel]) {
        return levelOrder[a.recommendationLevel] - levelOrder[b.recommendationLevel]
      }
      return b.score - a.score
    })

    setTrainerInsights(enrichedTrainers)
    setStep('trainer-selection')

    if (enrichedTrainers.length > 0 && enrichedTrainers[0].recommendationLevel === 'optimal') {
      toast.success('Found optimal trainers for this schedule!')
    } else if (enrichedTrainers.length === 0) {
      toast.error('No qualified trainers available')
    } else {
      toast.info('Review trainer recommendations carefully')
    }
  }

  const handleTrainerSelect = (trainerId: string) => {
    setSelectedTrainerId(trainerId)
    setStep('confirmation')
  }

  const confirmAndSchedule = () => {
    if (!selectedTrainerId) {
      toast.error('Please select a trainer')
      return
    }

    const course = courses.find(c => c.id === selectedCourse)
    if (!course) return

    const sessionsToCreate: Partial<Session>[] = sessionDates.map(dateStr => {
      const [startHour, startMin] = startTime.split(':').map(Number)
      const [endHour, endMin] = endTime.split(':').map(Number)
      
      const date = new Date(dateStr)
      const startDateTime = new Date(date)
      startDateTime.setHours(startHour, startMin, 0, 0)
      
      const endDateTime = new Date(date)
      endDateTime.setHours(endHour, endMin, 0, 0)

      const primaryShift = selectedShifts[0]

      return {
        courseId: selectedCourse,
        trainerId: selectedTrainerId,
        title: course.title,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        shift: primaryShift,
        location: location || 'TBD',
        capacity,
        enrolledStudents: [],
        status: 'scheduled' as const,
        ...(recurrenceType !== 'none' && endDate && {
          recurrence: {
            frequency: recurrenceType as 'daily' | 'weekly' | 'monthly',
            endDate
          }
        })
      }
    })

    onSessionsCreated(sessionsToCreate)
    
    const selectedTrainer = users.find(u => u.id === selectedTrainerId)
    toast.success(
      `Successfully scheduled ${sessionsToCreate.length} session(s) with ${selectedTrainer?.name}!`
    )
  }

  const selectedTrainerInsights = trainerInsights.find(t => t.trainer.id === selectedTrainerId)

  const renderParametersStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Session Parameters</CardTitle>
        <CardDescription>Define the session requirements</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="course">Course *</Label>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger id="course">
              <SelectValue placeholder="Select a course" />
            </SelectTrigger>
            <SelectContent>
              {courses.map(course => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCourseData && (
            <div className="mt-2 p-3 bg-secondary rounded-lg text-sm">
              <div className="font-medium text-secondary-foreground">Required Certifications:</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedCourseData.certifications.map(cert => (
                  <Badge key={cert} variant="outline">{cert}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label>Required Shifts *</Label>
          <div className="flex gap-3">
            {(['day', 'evening', 'night'] as ShiftType[]).map(shift => (
              <div key={shift} className="flex items-center space-x-2">
                <Checkbox
                  id={shift}
                  checked={selectedShifts.includes(shift)}
                  onCheckedChange={() => handleShiftToggle(shift)}
                />
                <label
                  htmlFor={shift}
                  className="text-sm font-medium capitalize cursor-pointer"
                >
                  {shift}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date (for recurring)</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startTime">Start Time *</Label>
            <Input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">End Time *</Label>
            <Input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recurrence">Recurrence Pattern</Label>
          <Select value={recurrenceType} onValueChange={(v: any) => setRecurrenceType(v)}>
            <SelectTrigger id="recurrence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Recurrence</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g., Room 301"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
        </div>

        <Separator />

        <Button
          onClick={analyzeTrainers}
          disabled={!selectedCourse || !startDate}
          className="w-full"
        >
          <UserCircleGear size={18} className="mr-2" />
          Find & Compare Trainers
        </Button>
      </CardContent>
    </Card>
  )

  const getRecommendationColor = (level: string) => {
    switch (level) {
      case 'optimal': return 'text-green-600 bg-green-50 border-green-200'
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'caution': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'avoid': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getRecommendationIcon = (level: string) => {
    switch (level) {
      case 'optimal': return <Sparkle size={20} weight="fill" className="text-green-600" />
      case 'good': return <CheckCircle size={20} weight="fill" className="text-blue-600" />
      case 'caution': return <WarningCircle size={20} weight="fill" className="text-orange-600" />
      case 'avoid': return <WarningCircle size={20} weight="fill" className="text-red-600" />
      default: return <Info size={20} />
    }
  }

  const getRecommendationText = (level: string) => {
    switch (level) {
      case 'optimal': return 'Optimal Choice'
      case 'good': return 'Good Choice'
      case 'caution': return 'Use with Caution'
      case 'avoid': return 'Not Recommended'
      default: return 'Unknown'
    }
  }

  const renderTrainerSelectionStep = () => {
    const filteredInsights = hideUnconfigured 
      ? trainerInsights.filter(insights => 
          insights.trainer.trainerProfile?.shiftSchedules && 
          insights.trainer.trainerProfile.shiftSchedules.length > 0
        )
      : trainerInsights

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users size={22} />
              Select Trainer
            </CardTitle>
            <CardDescription>
              Review data-driven insights and select the best trainer for this session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hide-unconfigured"
                checked={hideUnconfigured}
                onCheckedChange={(checked) => setHideUnconfigured(checked as boolean)}
              />
              <label
                htmlFor="hide-unconfigured"
                className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Hide trainers without configured schedules
              </label>
            </div>
          </CardContent>
        </Card>

        <ScrollArea className="h-[600px]">
          <div className="space-y-3 pr-4">
            {filteredInsights.map((insights, index) => {
            const hasSchedule = insights.trainer.trainerProfile?.shiftSchedules && 
              insights.trainer.trainerProfile.shiftSchedules.length > 0
            
            return (
              <Card
                key={insights.trainer.id}
                className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                  insights.recommendationLevel === 'optimal' 
                    ? 'border-green-200 bg-green-50/30' 
                    : insights.recommendationLevel === 'avoid'
                    ? 'border-red-200 bg-red-50/30'
                    : 'border-border'
                }`}
                onClick={() => handleTrainerSelect(insights.trainer.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-semibold text-foreground flex items-center gap-2">
                          {index + 1}. {insights.trainer.name}
                          {!hasSchedule && (
                            <WarningCircle size={18} weight="fill" className="text-amber-600 dark:text-amber-500" />
                          )}
                        </span>
                        <Badge 
                          variant={
                            insights.availability === 'available' ? 'default' :
                            insights.availability === 'partial' ? 'secondary' :
                            'outline'
                          }
                        >
                          {insights.availability}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {insights.trainer.department} • Works: {insights.trainer.shifts.join(', ')}
                      </div>
                      {!hasSchedule && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500 font-medium">
                          <WarningCircle size={14} weight="fill" />
                          Work schedule not configured - availability data may be incomplete
                        </div>
                      )}
                    </div>
                    
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${getRecommendationColor(insights.recommendationLevel)}`}>
                      {getRecommendationIcon(insights.recommendationLevel)}
                      <span className="text-sm font-semibold">
                        {getRecommendationText(insights.recommendationLevel)}
                      </span>
                    </div>
                  </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <ChartLine size={14} />
                      Match Score
                    </div>
                    <div className="text-2xl font-bold text-primary">{insights.score}</div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <BatteryCharging size={14} />
                      Utilization
                    </div>
                    <div className={`text-2xl font-bold ${
                      insights.utilizationRate > 85 ? 'text-red-600' :
                      insights.utilizationRate > 75 ? 'text-orange-600' :
                      insights.utilizationRate >= 60 ? 'text-green-600' :
                      'text-blue-600'
                    }`}>
                      {insights.utilizationRate.toFixed(0)}%
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Fire size={14} />
                      Burnout Risk
                    </div>
                    <div className={`text-2xl font-bold ${
                      insights.burnoutRisk > 70 ? 'text-red-600' :
                      insights.burnoutRisk > 50 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {insights.burnoutRisk.toFixed(0)}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock size={14} />
                      Weekly Hours
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {insights.workloadHours.toFixed(1)}h
                    </div>
                  </div>
                </div>

                {insights.hasActiveRecoveryPlan && (
                  <Alert className="mb-3 border-red-200 bg-red-50">
                    <WarningCircle size={16} className="text-red-600" />
                    <AlertDescription className="text-sm text-red-800">
                      This trainer has an active recovery plan and should not be assigned additional work.
                    </AlertDescription>
                  </Alert>
                )}

                {insights.matchReasons.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-foreground mb-1">Strengths:</div>
                    <div className="space-y-1">
                      {insights.matchReasons.slice(0, 3).map((reason, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle size={14} className="text-green-600 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground text-xs">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {insights.conflicts.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-foreground mb-1">Concerns:</div>
                    <div className="space-y-1">
                      {insights.conflicts.slice(0, 3).map((conflict, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <WarningCircle size={14} className="text-orange-600 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground text-xs">{conflict}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            )})}
          </div>
        </ScrollArea>

        {filteredInsights.length === 0 && trainerInsights.length > 0 && hideUnconfigured && (
          <Alert>
            <Info size={20} />
            <AlertTitle>All trainers filtered out</AlertTitle>
            <AlertDescription>
              All available trainers have been hidden by the schedule filter. Uncheck the filter to see all trainers.
            </AlertDescription>
          </Alert>
        )}

        {trainerInsights.length === 0 && (
          <Alert variant="destructive">
            <WarningCircle size={20} />
            <AlertTitle>No Available Trainers</AlertTitle>
            <AlertDescription>
              No trainers match the requirements. Consider adjusting shift requirements or required certifications.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('parameters')} className="flex-1">
            Back to Parameters
          </Button>
        </div>
      </div>
    )
  }

  const renderConfirmationStep = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle size={22} className="text-green-600" />
            Confirm Schedule
          </CardTitle>
          <CardDescription>
            Review the details before creating the session(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedTrainerInsights && (
            <div className="p-4 border rounded-lg bg-secondary/30">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-lg text-foreground">
                    {selectedTrainerInsights.trainer.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedTrainerInsights.trainer.department}
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${getRecommendationColor(selectedTrainerInsights.recommendationLevel)}`}>
                  {getRecommendationIcon(selectedTrainerInsights.recommendationLevel)}
                  <span className="text-xs font-semibold">
                    {getRecommendationText(selectedTrainerInsights.recommendationLevel)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Match Score:</span>
                  <span className="font-semibold ml-2 text-foreground">{selectedTrainerInsights.score}/100</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Utilization:</span>
                  <span className="font-semibold ml-2 text-foreground">{selectedTrainerInsights.utilizationRate.toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Weekly Hours:</span>
                  <span className="font-semibold ml-2 text-foreground">{selectedTrainerInsights.workloadHours.toFixed(1)}h</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Burnout Risk:</span>
                  <span className="font-semibold ml-2 text-foreground">{selectedTrainerInsights.burnoutRisk.toFixed(0)}</span>
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Course:</span>
                <div className="font-semibold mt-1 text-foreground">{selectedCourseData?.title}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Shifts:</span>
                <div className="font-semibold mt-1 text-foreground">{selectedShifts.join(', ')}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Time:</span>
                <div className="font-semibold mt-1 text-foreground">{startTime} - {endTime}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>
                <div className="font-semibold mt-1 text-foreground">{location || 'TBD'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Capacity:</span>
                <div className="font-semibold mt-1 text-foreground">{capacity} students</div>
              </div>
              <div>
                <span className="text-muted-foreground">Sessions:</span>
                <div className="font-semibold mt-1 text-foreground">{sessionDates.length} session(s)</div>
              </div>
            </div>

            {sessionDates.length > 0 && (
              <div>
                <span className="text-muted-foreground text-sm">Dates:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {sessionDates.slice(0, 5).map(date => (
                    <Badge key={date} variant="outline">
                      {format(new Date(date), 'MMM d, yyyy')}
                    </Badge>
                  ))}
                  {sessionDates.length > 5 && (
                    <Badge variant="outline">+{sessionDates.length - 5} more</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button 
          variant="outline" 
          onClick={() => setStep('trainer-selection')} 
          className="flex-1"
        >
          Back to Trainers
        </Button>
        <Button 
          onClick={confirmAndSchedule}
          className="flex-1"
        >
          <CheckCircle size={18} className="mr-2" />
          Confirm & Schedule
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <UserCircleGear size={28} weight="duotone" className="text-accent" />
          Guided Trainer Scheduler
        </h2>
        <p className="text-muted-foreground mt-1">
          Data-driven insights to help you select the best trainer
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {['parameters', 'trainer-selection', 'confirmation'].map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 ${
              step === s ? 'text-primary' : 
              ['parameters', 'trainer-selection', 'confirmation'].indexOf(step) > i 
                ? 'text-foreground' 
                : 'text-muted-foreground'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-semibold ${
                step === s 
                  ? 'border-primary bg-primary text-primary-foreground' 
                  : ['parameters', 'trainer-selection', 'confirmation'].indexOf(step) > i
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background'
              }`}>
                {i + 1}
              </div>
              <span className="text-sm font-medium capitalize hidden sm:inline">
                {s.replace('-', ' ')}
              </span>
            </div>
            {i < 2 && (
              <div className={`flex-1 h-0.5 mx-2 ${
                ['parameters', 'trainer-selection', 'confirmation'].indexOf(step) > i 
                  ? 'bg-primary' 
                  : 'bg-border'
              }`} />
            )}
          </div>
        ))}
      </div>

      {step === 'parameters' && renderParametersStep()}
      {step === 'trainer-selection' && renderTrainerSelectionStep()}
      {step === 'confirmation' && renderConfirmationStep()}
    </div>
  )
}
