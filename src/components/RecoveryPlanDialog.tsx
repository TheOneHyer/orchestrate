import { useState, useEffect } from 'react'
import { addDays, format } from 'date-fns'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash, FirstAid } from '@phosphor-icons/react'
import { RecoveryPlan, RecoveryAction, RecoveryPlanAction, WellnessCheckIn, User } from '@/lib/types'
import { getRecoveryPlanRecommendations, calculateWellnessScore } from '@/lib/wellness-analytics'

/**
 * Props for the {@link RecoveryPlanDialog} component.
 */
interface RecoveryPlanDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Callback to close the dialog. */
  onClose: () => void
  /** The ID of the trainer for whom the plan is being created. */
  trainerId: string
  /** Display name of the trainer shown in the dialog header. */
  trainerName: string
  /** The currently authenticated user; stored as `createdBy` on the plan. */
  currentUser: User
  /**
   * Callback invoked with the completed plan data when the user saves.
   * @param plan - The new recovery plan without auto-generated `id` and `createdAt` fields.
   */
  onSubmit: (plan: Omit<RecoveryPlan, 'id' | 'createdAt'>) => void
  /** The trainer's most recent wellness check-in, used to pre-populate the trigger reason and suggest actions. */
  latestCheckIn?: WellnessCheckIn
  /** The trainer's current utilization percentage; defaults to 75 if not provided. */
  currentUtilization?: number
}

/**
 * Lookup table mapping each {@link RecoveryAction} type to a default description string.
 *
 * Used to seed new action items with sensible descriptions that the user can then customise.
 */
const RECOVERY_ACTION_TEMPLATES: Record<RecoveryAction, string> = {
  'workload-reduction': 'Reduce weekly teaching hours by 20%',
  'time-off': 'Provide 3-5 consecutive days of paid time off',
  'schedule-adjustment': 'Adjust schedule to eliminate back-to-back sessions',
  'support-session': 'Schedule one-on-one support session with manager',
  'training': 'Provide access to stress management resources',
  'custom': 'Custom action'
}

const DEFAULT_TARGET_UTILIZATION = 70
const DEFAULT_DURATION_WEEKS = 4

const parseNumericInput = (value: string, fallbackValue: number, min?: number, max?: number) => {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) {
    return fallbackValue
  }
  let result = Math.trunc(parsedValue)
  if (min !== undefined) {
    result = Math.max(min, result)
  }
  if (max !== undefined) {
    result = Math.min(max, result)
  }
  return result
}

type EditableRecoveryPlanActionField = keyof Pick<RecoveryPlanAction, 'description' | 'targetDate' | 'notes'>

/**
 * Render a dialog for creating a structured recovery plan to support a trainer's wellbeing.
 *
 * When opened with a `latestCheckIn`, the form is pre-populated with a generated trigger reason
 * and suggested recovery actions; the user can add, edit, or remove actions, set target utilization
 * and plan duration, add optional notes, and submit the finalized plan via `onSubmit`.
 *
 * Validation enforces a non-empty trigger reason and at least one action before submission.
 * Numeric inputs are normalized and clamped to their allowed ranges, and the form resets to defaults on close.
 */
export function RecoveryPlanDialog({
  open,
  onClose,
  trainerId,
  trainerName,
  currentUser,
  onSubmit,
  latestCheckIn,
  currentUtilization = 75
}: RecoveryPlanDialogProps) {
  const [targetUtilizationInput, setTargetUtilizationInput] = useState(String(DEFAULT_TARGET_UTILIZATION))
  const [durationWeeksInput, setDurationWeeksInput] = useState(String(DEFAULT_DURATION_WEEKS))
  const [triggerReason, setTriggerReason] = useState('')
  const [triggerReasonTouched, setTriggerReasonTouched] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [notes, setNotes] = useState('')
  const [actions, setActions] = useState<Omit<RecoveryPlanAction, 'id'>[]>([])

  useEffect(() => {
    if (!open) return
    setTriggerReasonTouched(false)
    setSubmitAttempted(false)

    if (latestCheckIn) {
      const wellnessScore = calculateWellnessScore(latestCheckIn)
      const recommendations = getRecoveryPlanRecommendations(
        currentUtilization,
        wellnessScore,
        latestCheckIn.stress,
        latestCheckIn.energy
      )

      let reason = `Wellness score: ${wellnessScore}/100. `
      if (latestCheckIn.stress === 'critical' || latestCheckIn.stress === 'high') {
        reason += `High stress level (${latestCheckIn.stress}). `
      }
      if (currentUtilization >= 85) {
        reason += `Utilization at ${currentUtilization.toFixed(0)}%. `
      }
      if (latestCheckIn.concerns && latestCheckIn.concerns.length > 0) {
        reason += `Concerns raised: ${latestCheckIn.concerns.slice(0, 2).join(', ')}.`
      }

      setTriggerReason(reason)
      const initialActions: Omit<RecoveryPlanAction, 'id'>[] = []

      if (currentUtilization >= 85) {
        initialActions.push({
          type: 'workload-reduction',
          description: RECOVERY_ACTION_TEMPLATES['workload-reduction'],
          targetDate: addDays(new Date(), 7).toISOString(),
          completed: false
        })
      }

      if (latestCheckIn.stress === 'critical' || wellnessScore < 50) {
        initialActions.push({
          type: 'time-off',
          description: RECOVERY_ACTION_TEMPLATES['time-off'],
          targetDate: addDays(new Date(), 3).toISOString(),
          completed: false
        })
      }

      if (latestCheckIn.followUpRequired || latestCheckIn.stress === 'high' || latestCheckIn.stress === 'critical') {
        initialActions.push({
          type: 'support-session',
          description: 'Schedule wellness consultation with HR or manager',
          targetDate: addDays(new Date(), 5).toISOString(),
          completed: false
        })
      }

      setActions(initialActions)
    }
  }, [open, latestCheckIn, currentUtilization])

  const handleSubmit = () => {
    setSubmitAttempted(true)

    if (!triggerReason.trim() || actions.length === 0) {
      return
    }

    const targetUtilization = parseNumericInput(targetUtilizationInput, DEFAULT_TARGET_UTILIZATION, 40, 80)
    const durationWeeks = parseNumericInput(durationWeeksInput, DEFAULT_DURATION_WEEKS, 1, 12)

    const plan: Omit<RecoveryPlan, 'id' | 'createdAt'> = {
      trainerId,
      createdBy: currentUser.id,
      status: 'active',
      triggerReason,
      targetUtilization,
      currentUtilization,
      startDate: new Date().toISOString(),
      targetCompletionDate: addDays(new Date(), durationWeeks * 7).toISOString(),
      actions: actions.map((action, idx) => ({
        ...action,
        id: `action-${Date.now()}-${idx}`
      })),
      checkIns: [],
      notes: notes.trim() || undefined
    }

    onSubmit(plan)
    handleClose()
  }

  const handleClose = () => {
    setTargetUtilizationInput(String(DEFAULT_TARGET_UTILIZATION))
    setDurationWeeksInput(String(DEFAULT_DURATION_WEEKS))
    setTriggerReason('')
    setTriggerReasonTouched(false)
    setSubmitAttempted(false)
    setNotes('')
    setActions([])
    onClose()
  }

  const addAction = (type: RecoveryAction) => {
    const newAction: Omit<RecoveryPlanAction, 'id'> = {
      type,
      description: RECOVERY_ACTION_TEMPLATES[type],
      targetDate: addDays(new Date(), 7).toISOString(),
      completed: false
    }
    setActions([...actions, newAction])
  }

  /**
   * Update a specific editable field of the action at the given index in the local actions state.
   *
   * @param index - Zero-based index of the action to update; must refer to an existing action
   * @param field - One of the editable action fields (`description`, `targetDate`, `notes`)
   * @param value - New value for the specified field; must be the appropriate value for that field
   */
  function updateAction<K extends EditableRecoveryPlanActionField>(index: number, field: K, value: RecoveryPlanAction[K]) {
    const updated = [...actions]
    updated[index] = { ...updated[index], [field]: value }
    setActions(updated)
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, idx) => idx !== index))
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <FirstAid weight="fill" className="text-accent" />
            Create Recovery Plan: {trainerName}
          </DialogTitle>
          <DialogDescription>
            Design a structured intervention plan to support trainer wellbeing and workload management
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="trigger-reason" className="text-base font-medium">
              Trigger Reason
            </Label>
            <Textarea
              id="trigger-reason"
              aria-invalid={!triggerReason.trim() && (triggerReasonTouched || submitAttempted)}
              aria-describedby={!triggerReason.trim() && (triggerReasonTouched || submitAttempted) ? 'trigger-reason-error' : undefined}
              value={triggerReason}
              onChange={(e) => {
                setTriggerReason(e.target.value)
                setTriggerReasonTouched(true)
              }}
              onBlur={() => setTriggerReasonTouched(true)}
              placeholder="Why is this recovery plan needed?"
              rows={3}
            />
            {!triggerReason.trim() && (triggerReasonTouched || submitAttempted) && (
              <p id="trigger-reason-error" className="text-sm text-destructive" role="alert">Trigger reason is required</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current-util">Current Utilization</Label>
              <Input
                id="current-util"
                type="number"
                value={currentUtilization}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-util">Target Utilization (%)</Label>
              <Input
                id="target-util"
                type="number"
                min={40}
                max={80}
                step={1}
                value={targetUtilizationInput}
                onChange={(e) => setTargetUtilizationInput(e.target.value)}
                onBlur={() => setTargetUtilizationInput(String(parseNumericInput(targetUtilizationInput, DEFAULT_TARGET_UTILIZATION, 40, 80)))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (weeks)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={12}
                step={1}
                value={durationWeeksInput}
                onChange={(e) => setDurationWeeksInput(e.target.value)}
                onBlur={() => setDurationWeeksInput(String(parseNumericInput(durationWeeksInput, DEFAULT_DURATION_WEEKS, 1, 12)))}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Recovery Actions</Label>
              <Select onValueChange={(value) => addAction(value as RecoveryAction)}>
                <SelectTrigger className="w-[200px]">
                  <Plus className="mr-2" size={16} />
                  <span>Add Action</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workload-reduction">Workload Reduction</SelectItem>
                  <SelectItem value="time-off">Time Off</SelectItem>
                  <SelectItem value="schedule-adjustment">Schedule Adjustment</SelectItem>
                  <SelectItem value="support-session">Support Session</SelectItem>
                  <SelectItem value="training">Training/Resources</SelectItem>
                  <SelectItem value="custom">Custom Action</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {actions.length === 0 ? (
              <>
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <FirstAid className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No actions added yet</p>
                  <p className="text-sm mt-1">Add recovery actions using the dropdown above</p>
                </div>
                {submitAttempted && (
                  <p className="text-sm text-destructive" role="alert">At least one recovery action is required</p>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {actions.map((action, idx) => (
                  <div key={idx} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">
                        {action.type.replace('-', ' ')}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove action ${action.type.replace(/-/g, ' ')}`}
                        onClick={() => removeAction(idx)}
                      >
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`action-desc-${idx}`}>Description</Label>
                      <Textarea
                        id={`action-desc-${idx}`}
                        value={action.description}
                        onChange={(e) => updateAction(idx, 'description', e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`action-date-${idx}`}>Target Date</Label>
                        <Input
                          id={`action-date-${idx}`}
                          type="date"
                          value={format(new Date(action.targetDate), 'yyyy-MM-dd')}
                          onChange={(e) =>
                            updateAction(idx, 'targetDate', new Date(e.target.value).toISOString())
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`action-notes-${idx}`}>Notes (Optional)</Label>
                        <Input
                          id={`action-notes-${idx}`}
                          value={action.notes || ''}
                          onChange={(e) => updateAction(idx, 'notes', e.target.value)}
                          placeholder="Additional details..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="plan-notes">Plan Notes (Optional)</Label>
            <Textarea
              id="plan-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context, coordination notes, or special considerations..."
              rows={3}
            />
          </div>

          {latestCheckIn && (
            <div className="p-4 bg-muted/30 rounded-lg space-y-2">
              <p className="text-sm font-medium">Latest Check-In Summary:</p>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Mood:</span> {latestCheckIn.mood}/5
                </div>
                <div>
                  <span className="text-muted-foreground">Stress:</span> {latestCheckIn.stress}
                </div>
                <div>
                  <span className="text-muted-foreground">Energy:</span> {latestCheckIn.energy}
                </div>
                <div>
                  <span className="text-muted-foreground">Workload:</span> {latestCheckIn.workloadSatisfaction}/5
                </div>
              </div>
              {latestCheckIn.concerns && latestCheckIn.concerns.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Concerns:</span>{' '}
                  {latestCheckIn.concerns.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!triggerReason.trim() || actions.length === 0}
          >
            Create Recovery Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}