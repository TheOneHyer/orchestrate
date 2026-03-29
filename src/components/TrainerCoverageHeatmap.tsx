import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { User, DayOfWeek } from '@/lib/types'
import { Gear, X } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'

/**
 * Props for the {@link TrainerCoverageHeatmap} component.
 */
interface TrainerCoverageHeatmapProps {
  /** Full list of users; the component internally filters to trainers with configured schedules. */
  users: User[]
  /**
   * When provided, the heatmap is filtered to trainers who hold this certification.
   * If omitted, the component manages the filter internally.
   */
  selectedCertification?: string
  /**
   * Callback invoked when the certification filter changes.
   * When provided, the parent owns filter state and the internal selector is hidden.
   * @param certification - The selected certification name, or `"all"` to clear the filter.
   */
  onCertificationChange?: (certification: string) => void
}

/**
 * Shape of a single cell in the coverage grid.
 */
interface HourCoverage {
  /** Hour of the day (0–23). */
  hour: number
  /** Names of trainers working during this hour. */
  trainersWorking: string[]
  /** Total number of trainers working during this hour. */
  count: number
}

/**
 * Card component that renders a 7×24 heatmap of trainer coverage across every hour of the week.
 *
 * Cells are colour-coded green/yellow/orange/red/grey based on how close coverage is to the
 * user-configurable target (persisted in KV storage). Hovering a cell shows a tooltip listing
 * which trainers are working. Supports optional filtering by certification, either controlled
 * externally via props or managed internally via an embedded dropdown.
 */
export function TrainerCoverageHeatmap({ users, selectedCertification, onCertificationChange }: TrainerCoverageHeatmapProps) {
  const [targetCoverage, setTargetCoverage] = useKV<number>('target-trainer-coverage', 4)
  const [isEditingTarget, setIsEditingTarget] = useState(false)
  const [tempTarget, setTempTarget] = useState((targetCoverage || 4).toString())
  const [internalCertFilter, setInternalCertFilter] = useState<string>('all')

  const certFilter = selectedCertification ?? internalCertFilter
  const setCertFilter = onCertificationChange ?? setInternalCertFilter

  const allTrainers = useMemo(() =>
    users.filter(u => u.role === 'trainer'),
    [users]
  )

  const allCertifications = useMemo(() => {
    const certs = new Set<string>()
    allTrainers.forEach(t => t.certifications.forEach(c => certs.add(c)))
    return Array.from(certs).sort()
  }, [allTrainers])

  const trainers = useMemo(() => {
    return allTrainers.filter(trainer => {
      const hasSchedule = trainer.trainerProfile?.shiftSchedules && trainer.trainerProfile.shiftSchedules.length > 0
      const matchesCert = certFilter === 'all' || trainer.certifications.includes(certFilter)
      return hasSchedule && matchesCert
    })
  }, [allTrainers, certFilter])

  /**
   * Parses a time string in "HH:MM" or "h:mm AM/PM" format and returns a decimal hour.
   *
   * Returns `NaN` when the input is malformed (non-string, missing colon, non-finite
   * hours/minutes, or an unrecognised period token), so callers can safely skip invalid
   * shift entries.
   *
   * @param timeStr - Time string to parse (e.g., "09:30", "2:45 PM").
   * @returns The time expressed as a decimal hour (e.g., 9.5 for 09:30, 14.75 for 2:45 PM),
   *   or `NaN` for malformed input.
   */
  const parseTime = (timeStr: string): number => {
    if (typeof timeStr !== 'string' || timeStr.trim() === '') return NaN

    const parts = timeStr.split(' ')
    if (parts.length !== 1 && parts.length !== 2) return NaN

    const [time, period] = parts
    const timeParts = time.split(':')
    if (timeParts.length !== 2) return NaN

    const parsedHours = Number(timeParts[0])
    const minutes = Number(timeParts[1])
    if (!Number.isInteger(parsedHours) || !Number.isInteger(minutes)) return NaN
    if (minutes < 0 || minutes > 59) return NaN
    if (period !== undefined && period !== 'AM' && period !== 'PM') return NaN
    if (period === undefined && (parsedHours < 0 || parsedHours > 23)) return NaN
    if (period !== undefined && (parsedHours < 1 || parsedHours > 12)) return NaN

    let hours = parsedHours

    if (period === 'PM' && hours !== 12) {
      hours += 12
    } else if (period === 'AM' && hours === 12) {
      hours = 0
    }

    return hours + minutes / 60
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

    let malformedScheduleCount = 0

    daysOfWeek.forEach(day => {
      for (let hour = 0; hour < 24; hour++) {
        const trainersWorking: string[] = []

        trainers.forEach(trainer => {
          const schedules = trainer.trainerProfile?.shiftSchedules || []

          schedules.forEach(schedule => {
            if (schedule.daysWorked.includes(day)) {
              const startHour = parseTime(schedule.startTime)
              const endHour = parseTime(schedule.endTime)

              // Skip malformed time strings that parseTime could not parse
              if (isNaN(startHour) || isNaN(endHour)) {
                malformedScheduleCount++
                return
              }

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

    if (malformedScheduleCount > 0) {
      console.warn(`TrainerCoverageHeatmap: ${malformedScheduleCount} malformed schedule time string(s) encountered and skipped`)
    }

    return coverage
  }, [trainers])

  /**
   * Returns the Tailwind CSS class string for a heatmap cell based on coverage ratio.
   *
   * @param count - Number of trainers working during the cell's time slot.
   * @param target - Target number of trainers required per hour.
   * @returns A space-separated string of Tailwind classes representing the cell's colour.
   */
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

  /**
   * Returns a numeric coverage tier (0–4) used as a `data-coverage-tier` attribute for testing.
   *
   * @param count - Number of trainers working during the cell's time slot.
   * @param target - Target number of trainers required per hour.
   * @returns 0 = no coverage, 1 = below 50%, 2 = 50–74%, 3 = 75–99%, 4 = at/above target.
   */
  const getCoverageTier = (count: number, target: number) => {
    if (count === 0) return 0

    const ratio = count / target
    if (ratio >= 1) return 4
    if (ratio >= 0.75) return 3
    if (ratio >= 0.5) return 2
    if (ratio > 0) return 1

    return 0
  }

  /**
   * Formats a 24-hour integer as a compact AM/PM label (e.g., 0 → "12a", 13 → "1p").
   *
   * @param hour - Hour value from 0 to 23.
   * @returns A short string suitable for the heatmap column header.
   */
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
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle>Trainer Coverage Heatmap</CardTitle>
            <CardDescription>
              Visual representation of trainer coverage by hour of the day
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!onCertificationChange && allCertifications.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={certFilter} onValueChange={setCertFilter}>
                  <SelectTrigger aria-label="Certification filter" className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="All Certifications" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Certifications</SelectItem>
                    {allCertifications.map(cert => (
                      <SelectItem key={cert} value={cert}>{cert}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {certFilter !== 'all' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCertFilter('all')}
                  >
                    <X size={14} />
                  </Button>
                )}
              </div>
            )}
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
                                data-day={key}
                                data-hour={hourData.hour}
                                data-coverage-tier={getCoverageTier(hourData.count, targetCoverage || 4)}
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
                {certFilter !== 'all' && (
                  <span className="ml-1">
                    • Showing only trainers certified in <span className="font-semibold">{certFilter}</span>.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
