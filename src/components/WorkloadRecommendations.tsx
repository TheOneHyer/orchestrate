import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Warning,
  CheckCircle,
  Info,
  TrendUp,
  TrendDown,
  ArrowsLeftRight,
  UserPlus,
  Gauge
} from '@phosphor-icons/react'
import { WorkloadRecommendation, WorkloadAnalysis } from '@/lib/workload-balancer'
import { User } from '@/lib/types'

/**
 * Props for the {@link WorkloadRecommendations} component.
 */
interface WorkloadRecommendationsProps {
  /** Workload analysis result produced by the workload-balancer library. */
  analysis: WorkloadAnalysis
  /** Full list of users; used to resolve trainer names from IDs in recommendation cards. */
  users: User[]
  /**
   * Optional callback invoked when the user clicks a trainer's name badge.
   * @param trainerId - ID of the trainer whose profile should be opened.
   */
  onViewTrainer?: (trainerId: string) => void
  /**
   * Optional callback invoked when the user clicks "View Details" on an actionable recommendation.
   * @param recommendation - The specific recommendation the user wants to act on.
   */
  onApplyRecommendation?: (recommendation: WorkloadRecommendation) => void
}

/**
 * Component that renders workload balance analysis and actionable recommendations.
 *
 * Shows a summary card with a numeric balance score (0–100), progress bar, and counts of
 * over/balanced/under-utilised trainers. When recommendations exist, each is displayed as
 * an alert with a priority badge, affected-trainer buttons, and an optional "View Details"
 * action. Separate cards list the top overutilised and underutilised trainers. When the
 * workload is already well balanced (score ≥ 80 and no recommendations), a success state
 * card is rendered instead.
 */
export function WorkloadRecommendations({
  analysis,
  users,
  onViewTrainer,
  onApplyRecommendation
}: WorkloadRecommendationsProps) {
  const { recommendations, balanceScore, overutilizedTrainers, underutilizedTrainers } = analysis

  /**
   * Returns a priority-coloured icon element for a recommendation priority level.
   *
   * @param priority - The recommendation priority: `"high"`, `"medium"`, or `"low"`.
   * @returns An icon JSX element with appropriate colour styling.
   */
  const getPriorityIcon = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return <Warning size={20} weight="fill" className="text-red-600" />
      case 'medium':
        return <Info size={20} weight="fill" className="text-amber-600" />
      case 'low':
        return <CheckCircle size={20} weight="fill" className="text-blue-600" />
    }
  }

  /**
   * Returns the Tailwind CSS class string for a priority badge background and text.
   *
   * @param priority - The recommendation priority: `"high"`, `"medium"`, or `"low"`.
   * @returns Space-separated Tailwind classes for the badge colour.
   */
  const getPriorityBadgeColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'bg-red-600 text-white hover:bg-red-700'
      case 'medium':
        return 'bg-amber-600 text-white hover:bg-amber-700'
      case 'low':
        return 'bg-blue-600 text-white hover:bg-blue-700'
    }
  }

  /**
   * Returns a small icon element representing the type of a workload recommendation.
   *
   * @param type - The recommendation type from {@link WorkloadRecommendation}.
   * @returns An icon JSX element matching the recommendation category.
   */
  const getTypeIcon = (type: WorkloadRecommendation['type']) => {
    switch (type) {
      case 'redistribute':
        return <ArrowsLeftRight size={18} />
      case 'hire':
        return <UserPlus size={18} />
      case 'reduce':
        return <TrendDown size={18} />
      case 'optimize':
        return <Gauge size={18} />
    }
  }

  /**
   * Returns a Tailwind text-colour class based on the balance score value.
   *
   * @param score - Numeric balance score from 0 to 100.
   * @returns A Tailwind CSS class for green (≥80), amber (60–79), or red (<60) text.
   */
  const getBalanceScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  /**
   * Returns a human-readable label for the balance score range.
   *
   * @param score - Numeric balance score from 0 to 100.
   * @returns `"Excellent Balance"`, `"Moderate Balance"`, or `"Poor Balance"`.
   */
  const getBalanceScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent Balance'
    if (score >= 60) return 'Moderate Balance'
    return 'Poor Balance'
  }

  /**
   * Looks up a user by ID from the `users` prop array.
   *
   * @param id - The user ID to search for.
   * @returns The matching {@link User} or `undefined` if not found.
   */
  const getUserById = (id: string) => users.find(u => u.id === id)

  if (recommendations.length === 0 && balanceScore >= 80) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle size={32} weight="fill" className="text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Workload is Well Balanced</h3>
              <p className="text-sm text-green-700 mt-1">
                Your trainer workload distribution is optimal. No immediate action needed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gauge size={24} />
                Workload Balance Score
              </CardTitle>
              <CardDescription>Overall trainer utilization distribution</CardDescription>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${getBalanceScoreColor(balanceScore)}`}>
                {balanceScore.toFixed(0)}
              </div>
              <div className="text-sm text-muted-foreground">
                {getBalanceScoreLabel(balanceScore)}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={balanceScore} className="h-2" />
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div data-testid="overutilized-tile" className="text-center p-3 rounded-lg bg-secondary/50">
              <div className="text-2xl font-semibold text-foreground">
                {overutilizedTrainers.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Overutilized</div>
            </div>
            <div data-testid="balanced-tile" className="text-center p-3 rounded-lg bg-secondary/50">
              <div className="text-2xl font-semibold text-foreground">
                {analysis.workloads.length - overutilizedTrainers.length - underutilizedTrainers.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Balanced</div>
            </div>
            <div data-testid="underutilized-tile" className="text-center p-3 rounded-lg bg-secondary/50">
              <div className="text-2xl font-semibold text-foreground">
                {underutilizedTrainers.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Underutilized</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendUp size={24} />
              Recommendations ({recommendations.length})
            </CardTitle>
            <CardDescription>
              AI-powered suggestions to optimize trainer workload distribution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recommendations.map((rec, index) => (
              <Alert key={index} className="border-l-4 border-l-primary">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getPriorityIcon(rec.priority)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <AlertTitle className="flex items-center gap-2 text-base">
                          {getTypeIcon(rec.type)}
                          {rec.title}
                        </AlertTitle>
                        <AlertDescription className="mt-2 text-sm">
                          {rec.description}
                        </AlertDescription>
                      </div>
                      <Badge className={getPriorityBadgeColor(rec.priority)}>
                        {rec.priority}
                      </Badge>
                    </div>

                    {rec.affectedTrainers.length > 0 && (
                      <div className="flex flex-wrap gap-2 items-center mt-3">
                        <span className="text-xs text-muted-foreground">Affected:</span>
                        {rec.affectedTrainers.map(trainerId => {
                          const trainer = getUserById(trainerId)
                          return trainer ? (
                            <Button
                              key={trainerId}
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => onViewTrainer?.(trainerId)}
                            >
                              {trainer.name}
                            </Button>
                          ) : null
                        })}
                      </div>
                    )}

                    {rec.potentialSavings && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                        <TrendDown size={14} />
                        Can free up {rec.potentialSavings.toFixed(1)} hours
                      </div>
                    )}

                    {rec.actionable && onApplyRecommendation && (
                      <div className="mt-3">
                        <Separator className="mb-3" />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onApplyRecommendation(rec)}
                          className="w-full sm:w-auto"
                        >
                          View Details
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {(overutilizedTrainers.length > 0 || underutilizedTrainers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overutilizedTrainers.length > 0 && (
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-900">
                  <Warning size={20} weight="fill" className="text-red-600" />
                  Overutilized Trainers
                </CardTitle>
                <CardDescription>Trainers at or above 85% capacity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {overutilizedTrainers.slice(0, 5).map(workload => (
                    <button
                      key={workload.trainer.id}
                      onClick={() => onViewTrainer?.(workload.trainer.id)}
                      className="w-full p-3 rounded-lg border border-red-200 bg-white hover:bg-red-50 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{workload.trainer.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {workload.sessionCount} sessions • {workload.totalHours.toFixed(1)}h
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-red-600">
                            {workload.utilizationRate.toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">utilized</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {underutilizedTrainers.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
                  <TrendDown size={20} className="text-blue-600" />
                  Underutilized Trainers
                </CardTitle>
                <CardDescription>Trainers below 60% capacity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {underutilizedTrainers.slice(0, 5).map(workload => (
                    <button
                      key={workload.trainer.id}
                      onClick={() => onViewTrainer?.(workload.trainer.id)}
                      className="w-full p-3 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{workload.trainer.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {workload.sessionCount} sessions • {workload.totalHours.toFixed(1)}h
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">
                            {workload.utilizationRate.toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">utilized</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
