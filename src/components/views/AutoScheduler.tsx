import { useState } from 'react'
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
import {
  Robot,
  Calendar as CalendarIcon,
  Clock,
  Users,
  CheckCircle,
  WarningCircle,
  Lightning,
  ArrowRight
} from '@phosphor-icons/react'
import { TrainerScheduler, SchedulingConstraints, TrainerMatch } from '@/lib/scheduler'
import { User, Course, Session } from '@/lib/types'
import { toast } from 'sonner'

/** Props for the AutoScheduler component. */
interface AutoSchedulerProps {
  /** All users (trainers and employees) available for scheduling. */
  users: User[]
  /** Available courses to schedule sessions for. */
  courses: Course[]
  /** Callback invoked with the newly created session objects after auto-scheduling succeeds. */
  onSessionsCreated: (sessions: Partial<Session>[]) => void
  /** Optional callback to close/dismiss the scheduler panel. */
  onClose?: () => void
}

/**
 * Renders the Automatic Trainer Scheduler panel.
 *
 * Provides a form for configuring course, date range, time window, recurrence, location,
 * and capacity. Offers two actions: "Analyze Feasibility" (ranks available trainers and
 * highlights conflicts without committing) and "Auto-Schedule Sessions" (creates sessions
 * via `onSessionsCreated` using the best-matching trainer).
 *
 * @param users - All users in the system; trainers are filtered internally.
 * @param courses - Available courses to select for scheduling.
 * @param onSessionsCreated - Called with generated session objects on successful scheduling.
 * @param onClose - Optional handler to close the scheduler panel.
 * @returns The rendered AutoScheduler JSX element.
 */
export function AutoScheduler({ users, courses, onSessionsCreated, onClose }: AutoSchedulerProps) {
  const [sessions] = useKV<Session[]>('sessions', [])

  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [location, setLocation] = useState('')
  const [capacity, setCapacity] = useState(20)
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none')

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [availableTrainers, setAvailableTrainers] = useState<TrainerMatch[]>([])
  const [schedulingResult, setSchedulingResult] = useState<any>(null)

  const selectedCourseData = courses.find(c => c.id === selectedCourse)

  const analyzeFeasibility = () => {
    if (!selectedCourse || !startDate) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsAnalyzing(true)

    setTimeout(() => {
      const scheduler = new TrainerScheduler(
        users,
        sessions || [],
        courses
      )

      const course = courses.find(c => c.id === selectedCourse)
      if (!course) return

      const constraints: SchedulingConstraints = {
        courseId: selectedCourse,
        requiredCertifications: course.certifications,
        dates: [startDate],
        startTime,
        endTime,
        location: location || 'TBD',
        capacity
      }

      const feasibility = scheduler.analyzeSchedulingFeasibility(constraints)
      const trainers = scheduler.findAvailableTrainers(constraints, new Date(startDate))

      setAvailableTrainers(trainers)
      setShowResults(true)
      setIsAnalyzing(false)

      if (feasibility.feasible) {
        toast.success('Schedule is feasible!')
      } else {
        toast.warning('Some scheduling constraints detected')
      }
    }, 1000)
  }

  const executeAutoSchedule = () => {
    if (!selectedCourse || !startDate) {
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

    const constraints: SchedulingConstraints = {
      courseId: selectedCourse,
      requiredCertifications: course.certifications,
      dates,
      startTime,
      endTime,
      location: location || 'TBD',
      capacity,
      ...(recurrenceType !== 'none' && endDate && {
        recurrence: {
          frequency: recurrenceType as 'daily' | 'weekly' | 'monthly',
          endDate
        }
      })
    }

    const result = scheduler.autoScheduleSessions(constraints)
    setSchedulingResult(result)

    if (result.success) {
      onSessionsCreated(result.sessions)
      toast.success(`Successfully scheduled ${result.sessions.length} session(s)!`)

      if (result.recommendations.length > 0) {
        result.recommendations.forEach(rec => {
          toast.info(rec, { duration: 5000 })
        })
      }
    } else {
      toast.error('Could not schedule sessions')
      result.conflicts.forEach(conflict => {
        toast.error(conflict.message, { duration: 5000 })
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Robot size={28} weight="duotone" className="text-accent" />
          Automatic Trainer Scheduler
        </h2>
        <p className="text-muted-foreground mt-1">
          Intelligent scheduling based on certifications and shift availability
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Session Parameters</CardTitle>
          <CardDescription>Define the session requirements and constraints</CardDescription>
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

          <div className="flex gap-3">
            <Button
              onClick={analyzeFeasibility}
              disabled={isAnalyzing || !selectedCourse || !startDate}
              variant="outline"
              className="flex-1"
            >
              <Lightning size={18} className="mr-2" />
              Analyze Feasibility
            </Button>
            <Button
              onClick={executeAutoSchedule}
              disabled={!selectedCourse || !startDate}
              className="flex-1"
            >
              <Robot size={18} className="mr-2" />
              Auto-Schedule Sessions
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAnalyzing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Robot size={20} className="animate-spin" />
                Analyzing trainer availability and constraints...
              </div>
              <Progress value={66} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {showResults && availableTrainers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users size={22} />
              Available Trainers
            </CardTitle>
            <CardDescription>
              Ranked by compatibility with requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {availableTrainers.slice(0, 5).map((match, index) => (
                <div
                  key={match.trainer.id}
                  className="p-4 border border-border rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {index + 1}. {match.trainer.name}
                        </span>
                        <Badge
                          variant={
                            match.availability === 'available' ? 'default' :
                              match.availability === 'partial' ? 'secondary' :
                                'outline'
                          }
                        >
                          {match.availability}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {match.trainer.department} • Works: {match.trainer.shifts?.join(', ') ?? 'N/A'}
                      </div>

                      <div className="mt-3 space-y-1">
                        {match.matchReasons.length > 0 && (
                          <div className="flex items-start gap-2 text-sm">
                            <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
                            <div className="space-y-0.5">
                              {match.matchReasons.map((reason, i) => (
                                <div key={i} className="text-muted-foreground">{reason}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {match.conflicts.length > 0 && (
                          <div className="flex items-start gap-2 text-sm">
                            <WarningCircle size={16} className="text-orange-600 mt-0.5 shrink-0" />
                            <div className="space-y-0.5">
                              {match.conflicts.map((conflict, i) => (
                                <div key={i} className="text-muted-foreground">{conflict}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {match.score}
                      </div>
                      <div className="text-xs text-muted-foreground">score</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showResults && availableTrainers.length === 0 && (
        <Alert variant="destructive">
          <WarningCircle size={20} />
          <AlertTitle>No Available Trainers</AlertTitle>
          <AlertDescription>
            No trainers match the requirements. Consider adjusting shift requirements or required certifications.
          </AlertDescription>
        </Alert>
      )}

      {schedulingResult && schedulingResult.success && (
        <Alert>
          <CheckCircle size={20} className="text-green-600" />
          <AlertTitle>Sessions Created Successfully!</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              <div>{schedulingResult.sessions.length} training session(s) have been scheduled.</div>
              {schedulingResult.recommendations.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="font-medium">Recommendations:</div>
                  {schedulingResult.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="text-sm flex items-start gap-1">
                      <ArrowRight size={14} className="mt-0.5 shrink-0" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {schedulingResult && !schedulingResult.success && schedulingResult.conflicts.length > 0 && (
        <Alert variant="destructive">
          <WarningCircle size={20} />
          <AlertTitle>Scheduling Issues Detected</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {schedulingResult.conflicts.map((conflict: any, i: number) => (
                <div key={i} className="text-sm flex items-start gap-1">
                  <ArrowRight size={14} className="mt-0.5 shrink-0" />
                  <span>{conflict.message}</span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
