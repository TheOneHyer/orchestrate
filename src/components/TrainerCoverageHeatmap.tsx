import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { User, DayOfWeek } from '@/lib/types'
import { Gear } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'

interface TrainerCoverageHeatmapProps {
  users: User[]
}

interface HourCoverage {
  hour: number
  trainersWorking: string[]
  count: number
}

export function TrainerCoverageHeatmap({ users }: TrainerCoverageHeatmapProps) {
  const [targetCoverage, setTargetCoverage] = useKV<number>('target-trainer-coverage', 4)
  const [isEditingTarget, setIsEditingTarget] = useState(false)
  const [tempTarget, setTempTarget] = useState((targetCoverage || 4).toString())

  const trainers = useMemo(() => 
    users.filter(u => u.role === 'trainer' && u.trainerProfile?.shiftSchedules && u.trainerProfile.shiftSchedules.length > 0),
    [users]
  )

  const parseTime = (timeStr: string): number => {
    const [time, period] = timeStr.split(' ')
    let [hours, minutes] = time.split(':').map(Number)
    
    if (period === 'PM' && hours !== 12) {
      hours += 12
    } else if (period === 'AM' && hours === 12) {
      hours = 0
    }
    
    return hours + (minutes || 0) / 60
  }

  const coverageByDayAndHour = useMemo(() => {
    const daysOfWeek: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const coverage: Record<DayOfWeek, HourCoverage[]> = {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: []
    }

    daysOfWeek.forEach(day => {
      for (let hour = 0; hour < 24; hour++) {
        const trainersWorking: string[] = []

        trainers.forEach(trainer => {
          const schedules = trainer.trainerProfile?.shiftSchedules || []
          
          schedules.forEach(schedule => {
            if (schedule.daysWorked.includes(day)) {
              const startHour = parseTime(schedule.startTime)
              const endHour = parseTime(schedule.endTime)

              let isWorking = false
              
              if (startHour < endHour) {
                isWorking = hour >= Math.floor(startHour) && hour < Math.ceil(endHour)
              } else {
                isWorking = hour >= Math.floor(startHour) || hour < Math.ceil(endHour)
              }

              if (isWorking) {
                trainersWorking.push(trainer.name)
              }
            }
          })
        })

        coverage[day].push({
          hour,
          trainersWorking,
          count: trainersWorking.length
        })
      }
    })

    return coverage
  }, [trainers])

  const getHeatmapColor = (count: number, target: number) => {
    const ratio = count / target
    
    if (count === 0) {
      return 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
    }
    
    if (ratio >= 1) {
      return 'bg-green-500 dark:bg-green-600 border-green-600 dark:border-green-700 text-white'
    } else if (ratio >= 0.75) {
      return 'bg-yellow-400 dark:bg-yellow-500 border-yellow-500 dark:border-yellow-600 text-gray-900 dark:text-gray-900'
    } else if (ratio >= 0.5) {
      return 'bg-orange-400 dark:bg-orange-500 border-orange-500 dark:border-orange-600 text-white'
    } else if (ratio > 0) {
      return 'bg-red-400 dark:bg-red-500 border-red-500 dark:border-red-600 text-white'
    }
    
    return 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
  }

  const formatHour = (hour: number) => {
    if (hour === 0) return '12a'
    if (hour === 12) return '12p'
    if (hour < 12) return `${hour}a`
    return `${hour - 12}p`
  }

  const handleSaveTarget = () => {
    const parsed = parseInt(tempTarget)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 20) {
      setTargetCoverage(parsed)
      setIsEditingTarget(false)
    }
  }

  const daysOfWeek: { key: DayOfWeek; label: string }[] = [
    { key: 'sunday', label: 'Sun' },
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' }
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Trainer Coverage Heatmap</CardTitle>
            <CardDescription>
              Visual representation of trainer coverage by hour of the day
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isEditingTarget ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditingTarget(true)
                  setTempTarget((targetCoverage || 4).toString())
                }}
              >
                <Gear size={16} className="mr-2" />
                Target: {targetCoverage || 4}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={tempTarget}
                  onChange={(e) => setTempTarget(e.target.value)}
                  className="w-20 h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveTarget()
                    } else if (e.key === 'Escape') {
                      setIsEditingTarget(false)
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleSaveTarget}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingTarget(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {trainers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No trainers with configured schedules
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border bg-green-500 dark:bg-green-600"></div>
                  <span className="text-muted-foreground">At/Above Target</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border bg-yellow-400 dark:bg-yellow-500"></div>
                  <span className="text-muted-foreground">75%+ Coverage</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border bg-orange-400 dark:bg-orange-500"></div>
                  <span className="text-muted-foreground">50%+ Coverage</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border bg-red-400 dark:bg-red-500"></div>
                  <span className="text-muted-foreground">Below 50%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border bg-gray-100 dark:bg-gray-900"></div>
                  <span className="text-muted-foreground">No Coverage</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="grid grid-cols-[60px_repeat(24,1fr)] gap-px bg-border rounded-lg overflow-hidden border border-border">
                  <div className="bg-muted/50 p-2"></div>
                  {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="bg-muted/50 p-1 text-center">
                      <div className="text-[10px] font-medium text-muted-foreground">
                        {formatHour(i)}
                      </div>
                    </div>
                  ))}

                  {daysOfWeek.map(({ key, label }) => (
                    <>
                      <div key={`${key}-label`} className="bg-muted/50 p-2 flex items-center">
                        <span className="text-xs font-medium text-muted-foreground">{label}</span>
                      </div>
                      {coverageByDayAndHour[key].map((hourData) => (
                        <TooltipProvider key={`${key}-${hourData.hour}`}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`p-1 flex items-center justify-center text-[10px] font-semibold cursor-help transition-colors hover:opacity-80 border ${getHeatmapColor(hourData.count, targetCoverage || 4)}`}
                              >
                                {hourData.count > 0 ? hourData.count : ''}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[250px]">
                              <div className="space-y-1">
                                <div className="font-semibold">
                                  {label} at {formatHour(hourData.hour)}:00
                                </div>
                                <div className="text-xs">
                                  {hourData.count} trainer{hourData.count !== 1 ? 's' : ''} working
                                </div>
                                {hourData.trainersWorking.length > 0 && (
                                  <div className="text-xs mt-2">
                                    <div className="font-medium mb-1">Trainers:</div>
                                    <ul className="space-y-0.5">
                                      {hourData.trainersWorking.map((name, idx) => (
                                        <li key={idx}>• {name}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 text-xs text-muted-foreground">
              <p>
                Hover over any cell to see which trainers are working during that hour. 
                Target coverage is set to <span className="font-semibold">{targetCoverage || 4}</span> trainer{(targetCoverage || 4) !== 1 ? 's' : ''} per hour.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
