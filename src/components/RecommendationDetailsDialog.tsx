import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useEffect, useMemo, useRef } from 'react'
import { WorkloadRecommendation } from '@/lib/workload-balancer'
import { User } from '@/lib/types'

/**
 * Props for the RecommendationDetailsDialog component.
 */
interface RecommendationDetailsDialogProps {
  /** Whether the dialog is currently open. */
  open: boolean
  /** Handler invoked when the dialog open state changes. */
  onOpenChange: (open: boolean) => void
  /** Recommendation currently selected for inspection, or null when none is selected. */
  recommendation: WorkloadRecommendation | null
  /** All users used to resolve trainer names from recommendation IDs. */
  users: User[]
  /** Optional callback to open a trainer profile from the dialog. */
  onViewTrainer?: (trainerId: string) => void
  /** Optional callback to navigate to schedule context from the dialog. */
  onOpenScheduleContext?: (recommendation: WorkloadRecommendation) => void
}

/**
 * Renders a details dialog for an actionable workload recommendation.
 *
 * Displays recommendation metadata, affected trainers, and optional next-step
 * actions for opening trainer profiles or schedule context.
 *
 * @param props - Dialog state, selected recommendation, and action handlers.
 * @returns The rendered recommendation details dialog.
 */
export function RecommendationDetailsDialog({
  open,
  onOpenChange,
  recommendation,
  users,
  onViewTrainer,
  onOpenScheduleContext,
}: RecommendationDetailsDialogProps) {
  const onOpenChangeRef = useRef(onOpenChange)
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  useEffect(() => {
    if (open && !recommendation) {
      onOpenChangeRef.current(false)
    }
  }, [open, recommendation])

  const affectedTrainers = useMemo(() => {
    if (!recommendation) {
      return []
    }

    return recommendation.affectedTrainers
      .map((trainerId) => userById.get(trainerId))
      .filter((trainer): trainer is User => !!trainer)
  }, [recommendation, userById])

  if (!recommendation) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{recommendation.title}</DialogTitle>
          <DialogDescription>{recommendation.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Type</div>
              <div className="font-medium capitalize">{recommendation.type}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Priority</div>
              <div className="font-medium capitalize">{recommendation.priority}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Actionable</div>
              <div className="font-medium">{recommendation.actionable ? 'Yes' : 'No'}</div>
            </div>
          </div>

          {typeof recommendation.potentialSavings === 'number' && (
            <div className="rounded-md border p-3 text-sm">
              <div className="text-muted-foreground">Potential Savings</div>
              <div className="font-medium">{recommendation.potentialSavings.toFixed(1)} hours</div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Affected Trainers</div>
            {affectedTrainers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {affectedTrainers.map((trainer) => (
                  <Button
                    key={trainer.id}
                    variant="outline"
                    size="sm"
                    onClick={onViewTrainer ? () => onViewTrainer(trainer.id) : undefined}
                    disabled={!onViewTrainer}
                    title={!onViewTrainer ? 'Trainer profile action unavailable' : undefined}
                  >
                    {trainer.name}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No mapped trainer records.</div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Recommendation Details</Badge>
            {recommendation.actionable ? <Badge>Action Available</Badge> : <Badge variant="outline">Advisory Only</Badge>}
          </div>
        </div>

        <DialogFooter>
          <Button data-testid="recommendation-dialog-close" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {recommendation.actionable && onOpenScheduleContext && (
            <Button onClick={() => onOpenScheduleContext?.(recommendation)}>
              Open Schedule Context
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
