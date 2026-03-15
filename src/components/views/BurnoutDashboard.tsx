import { useMemo, useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  TrendUp, 
  TrendDown, 
  Warning, 
  ChartLine,
  Users,
  Calendar,
  Clock,
  Fire,
  Heart,
  WarningCircle,
  CheckCircle,
  ClockCounterClockwise
} from '@phosphor-icons/react'
import { User, Session, Course, WellnessCheckIn } from '@/lib/types'
import { 
  calculateTrainerUtilization,
  getUtilizationTrend,
  getBurnoutRiskLevel,
  type TrainerUtilization,
  type UtilizationTrend
} from '@/lib/burnout-analytics'
import { UtilizationChart } from '@/components/charts/UtilizationChart'
import { BurnoutRiskGauge } from '@/components/charts/BurnoutRiskGauge'
import { TrendChart } from '@/components/charts/TrendChart'
import { WorkloadDistribution } from '@/components/charts/WorkloadDistribution'
import { RiskTrendChart } from '@/components/charts/RiskTrendChart'
import { useRiskHistory } from '@/hooks/use-risk-history'
import { aggregateSnapshotsByDay } from '@/lib/risk-history-tracker'

interface BurnoutDashboardProps {
  users: User[]
  sessions: Session[]
  courses: Course[]
  onNavigate: (view: string, data?: any) => void
}

export function BurnoutDashboard({ users, sessions, courses, onNavigate }: BurnoutDashboardProps) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month')
  const [selectedTrainer, setSelectedTrainer] = useState<string | null>(null)
  
  const [checkIns] = useKV<WellnessCheckIn[]>('wellness-check-ins', [])
  const { getTrainerHistory } = useRiskHistory(users, sessions, courses, checkIns || [])

  const trainers = useMemo(() => 
    users.filter(u => u.role === 'trainer'),
    [users]
  )

  const safeCheckIns = checkIns || []

  const trainerUtilization = useMemo(() => {
    return trainers.map(trainer => 
      calculateTrainerUtilization(trainer, sessions, courses, timeRange, safeCheckIns)
    ).sort((a, b) => b.riskScore - a.riskScore)
  }, [trainers, sessions, courses, timeRange, safeCheckIns])

  const utilizationTrends = useMemo(() => {
    return trainers.map(trainer => 
      getUtilizationTrend(trainer, sessions, timeRange)
    )
  }, [trainers, sessions, timeRange])

  const highRiskTrainers = trainerUtilization.filter(t => t.riskLevel === 'critical' || t.riskLevel === 'high')
  const avgUtilization = trainerUtilization.reduce((sum, t) => sum + t.utilizationRate, 0) / trainerUtilization.length || 0

  const selectedTrainerData = selectedTrainer 
    ? trainerUtilization.find(t => t.trainerId === selectedTrainer)
    : null

  const selectedTrainerTrend = selectedTrainer
    ? utilizationTrends.find(t => t.trainerId === selectedTrainer)
    : null

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <Fire className="text-destructive" weight="fill" />
      case 'high':
        return <Warning className="text-orange-500" weight="fill" />
      case 'medium':
        return <WarningCircle className="text-yellow-500" weight="fill" />
      default:
        return <CheckCircle className="text-green-500" weight="fill" />
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'default'
      case 'medium':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <Heart weight="fill" className="text-accent" />
            Trainer Burnout Risk Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor workload trends and identify burnout risk early
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {highRiskTrainers.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <Warning className="h-5 w-5" weight="fill" />
          <AlertTitle className="text-lg font-semibold">
            {highRiskTrainers.length} Trainer{highRiskTrainers.length > 1 ? 's' : ''} at High Burnout Risk
          </AlertTitle>
          <AlertDescription className="mt-2">
            Immediate intervention recommended. These trainers are showing signs of excessive workload and need workload redistribution.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Utilization</CardTitle>
            <ChartLine className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgUtilization.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all trainers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Trainers</CardTitle>
            <Fire className="h-5 w-5 text-destructive" weight="fill" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {highRiskTrainers.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Active Trainers</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{trainers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently scheduled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trending Up</CardTitle>
            <TrendUp className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {utilizationTrends.filter(t => t.trend === 'increasing').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Workload increasing
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trainers">Trainer Details</TabsTrigger>
          <TabsTrigger value="trends">Trends Analysis</TabsTrigger>
          <TabsTrigger value="distribution">Workload Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <CardDescription>
                  Current burnout risk levels across all trainers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BurnoutRiskGauge data={trainerUtilization} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Utilization Trend</CardTitle>
                <CardDescription>
                  Average utilization over the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart 
                  data={utilizationTrends} 
                  timeRange={timeRange}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>High Priority Actions</CardTitle>
              <CardDescription>
                Trainers requiring immediate intervention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {highRiskTrainers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">No high-risk trainers detected</p>
                  <p className="text-sm mt-1">All trainers are within healthy workload ranges</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {highRiskTrainers.map((trainer) => (
                    <div
                      key={trainer.trainerId}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedTrainer(trainer.trainerId)
                        document.getElementById('trainers-tab')?.click()
                      }}
                    >
                      <div className="flex items-center gap-4">
                        {getRiskIcon(trainer.riskLevel)}
                        <div>
                          <p className="font-semibold">
                            {trainers.find(t => t.id === trainer.trainerId)?.name}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {trainer.hoursScheduled}h scheduled
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {trainer.sessionCount} sessions
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-2xl font-bold">{trainer.utilizationRate.toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground">utilization</p>
                        </div>
                        <Badge variant={getRiskColor(trainer.riskLevel) as any}>
                          {trainer.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trainers" className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <Select value={selectedTrainer || ''} onValueChange={setSelectedTrainer}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a trainer to view details" />
              </SelectTrigger>
              <SelectContent>
                {trainers.map(trainer => (
                  <SelectItem key={trainer.id} value={trainer.id}>
                    {trainer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTrainer && (
              <Button variant="outline" onClick={() => setSelectedTrainer(null)}>
                Clear Selection
              </Button>
            )}
          </div>

          {selectedTrainerData && selectedTrainerTrend ? (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      {getRiskIcon(selectedTrainerData.riskLevel)}
                      <div>
                        <div className="text-3xl font-bold">
                          {selectedTrainerData.riskScore.toFixed(0)}
                        </div>
                        <Badge variant={getRiskColor(selectedTrainerData.riskLevel) as any} className="mt-1">
                          {selectedTrainerData.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Utilization Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {selectedTrainerData.utilizationRate.toFixed(1)}%
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-sm">
                      {selectedTrainerTrend.trend === 'increasing' ? (
                        <>
                          <TrendUp className="h-4 w-4 text-destructive" />
                          <span className="text-destructive">Increasing</span>
                        </>
                      ) : selectedTrainerTrend.trend === 'decreasing' ? (
                        <>
                          <TrendDown className="h-4 w-4 text-green-500" />
                          <span className="text-green-500">Decreasing</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Stable</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Hours Scheduled</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {selectedTrainerData.hoursScheduled}h
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedTrainerData.sessionCount} sessions
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Utilization History</CardTitle>
                  <CardDescription>
                    Week-by-week breakdown over the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UtilizationChart 
                    data={selectedTrainerTrend.dataPoints}
                    trainerName={trainers.find(t => t.id === selectedTrainer)?.name || ''}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Risk Level Trend</CardTitle>
                      <CardDescription>
                        Historical burnout risk score tracking
                      </CardDescription>
                    </div>
                    <ClockCounterClockwise className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    if (!selectedTrainer) return null
                    
                    const trainerHistory = getTrainerHistory(selectedTrainer)
                    const aggregatedHistory = aggregateSnapshotsByDay(trainerHistory)
                    
                    return (
                      <RiskTrendChart 
                        data={aggregatedHistory.map(snap => ({
                          date: snap.timestamp,
                          riskScore: snap.riskScore,
                          riskLevel: snap.riskLevel,
                          utilizationRate: snap.utilizationRate,
                          sessionCount: snap.sessionCount,
                          hoursScheduled: snap.hoursScheduled
                        }))}
                        trainerName={trainers.find(t => t.id === selectedTrainer)?.name}
                        showUtilization={true}
                      />
                    )
                  })()}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Factors</CardTitle>
                  <CardDescription>
                    Contributing factors to burnout risk
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedTrainerData.factors.map((factor, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
                        <Warning className="h-5 w-5 text-accent mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium">{factor.factor}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {factor.description}
                          </p>
                        </div>
                        <Badge variant="outline">{factor.impact}</Badge>
                      </div>
                    ))}
                    {selectedTrainerData.factors.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                        <p>No significant risk factors detected</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                  <CardDescription>
                    Actions to reduce burnout risk
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedTrainerData.recommendations.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                        <p className="text-sm flex-1">{rec}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Select a trainer to view detailed analytics</p>
                  <p className="text-sm mt-1">Choose from the dropdown above</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Comparative Trend Analysis</CardTitle>
              <CardDescription>
                Track utilization changes across all trainers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart 
                data={utilizationTrends} 
                timeRange={timeRange}
                showAll={true}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trainer Status Summary</CardTitle>
              <CardDescription>
                Current utilization and trend direction for all trainers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trainerUtilization.map((trainer) => {
                  const trainerInfo = trainers.find(t => t.id === trainer.trainerId)
                  const trend = utilizationTrends.find(t => t.trainerId === trainer.trainerId)
                  
                  return (
                    <div
                      key={trainer.trainerId}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {getRiskIcon(trainer.riskLevel)}
                        <div>
                          <p className="font-semibold">{trainerInfo?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {trainer.sessionCount} sessions • {trainer.hoursScheduled}h
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {trainer.utilizationRate.toFixed(0)}%
                          </p>
                          <div className="flex items-center gap-1 text-xs">
                            {trend?.trend === 'increasing' ? (
                              <>
                                <TrendUp className="h-3 w-3 text-destructive" />
                                <span className="text-destructive">+{trend.changeRate.toFixed(1)}%</span>
                              </>
                            ) : trend?.trend === 'decreasing' ? (
                              <>
                                <TrendDown className="h-3 w-3 text-green-500" />
                                <span className="text-green-500">{trend.changeRate.toFixed(1)}%</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Stable</span>
                            )}
                          </div>
                        </div>
                        <Badge variant={getRiskColor(trainer.riskLevel) as any}>
                          {trainer.riskLevel}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workload Distribution Analysis</CardTitle>
              <CardDescription>
                Visual representation of workload balance across trainers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkloadDistribution data={trainerUtilization} trainers={trainers} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Overutilized Trainers</CardTitle>
                <CardDescription>
                  Above 85% utilization threshold
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trainerUtilization.filter(t => t.utilizationRate >= 85).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                    <p>No overutilized trainers</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trainerUtilization
                      .filter(t => t.utilizationRate >= 85)
                      .map((trainer) => (
                        <div key={trainer.trainerId} className="flex items-center justify-between p-3 border rounded">
                          <span className="font-medium">
                            {trainers.find(t => t.id === trainer.trainerId)?.name}
                          </span>
                          <span className="text-destructive font-bold">
                            {trainer.utilizationRate.toFixed(0)}%
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Underutilized Trainers</CardTitle>
                <CardDescription>
                  Below 50% utilization threshold
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trainerUtilization.filter(t => t.utilizationRate < 50).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                    <p>All trainers well utilized</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trainerUtilization
                      .filter(t => t.utilizationRate < 50)
                      .map((trainer) => (
                        <div key={trainer.trainerId} className="flex items-center justify-between p-3 border rounded">
                          <span className="font-medium">
                            {trainers.find(t => t.id === trainer.trainerId)?.name}
                          </span>
                          <span className="text-green-600 font-bold">
                            {trainer.utilizationRate.toFixed(0)}%
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
