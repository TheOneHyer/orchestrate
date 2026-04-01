import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { TrainerUtilization } from '@/lib/burnout-analytics'
import { User } from '@/lib/types'

/** Props for the {@link WorkloadDistribution} component. */
interface WorkloadDistributionProps {
  /** Utilization records, one per trainer, used to build chart bars. */
  data: TrainerUtilization[]
  /** Full user list used to resolve trainer display names from IDs. */
  trainers: User[]
}

/**
 * Horizontal bar chart comparing utilization across all trainers.
 *
 * Bars are colour-coded by risk tier (low / medium / high / critical) and sorted
 * descending by utilization.  Reference lines at 85 % and 95 % mark the
 * over-utilization and critical thresholds respectively.
 *
 * @param props - Component props.
 * @param props.data - Utilization records sorted and rendered as bars.
 * @param props.trainers - User records used to look up trainer names.
 * @returns A responsive bar chart, or an empty-state div when there is no data.
 */
export function WorkloadDistribution({ data, trainers }: WorkloadDistributionProps) {
  const chartData = useMemo(() => {
    return data.map(utilization => {
      const trainer = trainers.find(t => t.id === utilization.trainerId)
      return {
        name: trainer?.name || 'Unknown',
        utilization: Math.round(utilization.utilizationRate),
        hours: Math.round(utilization.hoursScheduled * 10) / 10,
        sessions: utilization.sessionCount
      }
    }).sort((a, b) => b.utilization - a.utilization)
  }, [data, trainers])

  const getBarColor = (utilization: number) => {
    if (utilization >= 95) return 'hsl(var(--destructive))'
    if (utilization >= 85) return 'hsl(var(--accent))'
    if (utilization >= 70) return 'hsl(var(--chart-5))'
    return 'hsl(var(--chart-2))'
  }

  const getRiskClass = (utilization: number) => {
    if (utilization >= 95) return 'risk-indicator-critical'
    if (utilization >= 85) return 'risk-indicator-high'
    if (utilization >= 70) return 'risk-indicator-medium'
    return 'risk-indicator-low'
  }

  const getRiskLabel = (utilization: number) => {
    if (utilization >= 95) return 'Critical risk'
    if (utilization >= 85) return 'High risk'
    if (utilization >= 70) return 'Medium risk'
    return 'Low risk'
  }

  if (chartData.length === 0) {
    return (
      <div data-testid="workload-chart-empty" className="w-full h-[400px] flex items-center justify-center text-muted-foreground">
        No workload data available
      </div>
    )
  }

  return (
    <div data-testid="workload-chart" className="w-full h-[400px]" role="img" aria-label="Workload distribution chart">
      <span className="sr-only">
        {chartData.map(entry => `${entry.name}: ${entry.utilization}% utilization, ${entry.hours} hours`).join(', ')}
      </span>
      <div className="sr-only">
        {chartData.map((entry) => (
          <span key={`risk-${entry.name}`} className={getRiskClass(entry.utilization)}>
            {entry.name}: {getRiskLabel(entry.utilization)}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
          layout="horizontal"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
            label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }}
            domain={[0, 120]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
            formatter={(value: ValueType, name: NameType) => {
              const numericValue = typeof value === 'number' ? value : Number(value ?? 0)
              const seriesName = String(name)

              if (seriesName === 'utilization') return [`${numericValue}%`, 'Utilization']
              if (seriesName === 'hours') return [`${numericValue}h`, 'Hours']
              if (seriesName === 'sessions') return [numericValue, 'Sessions']
              return [numericValue, seriesName]
            }}
          />
          <ReferenceLine
            y={85}
            stroke="hsl(var(--accent))"
            strokeDasharray="3 3"
            label={{ value: 'Overutilized (85%)', position: 'right', fill: 'hsl(var(--muted-foreground))' }}
          />
          <ReferenceLine
            y={95}
            stroke="hsl(var(--destructive))"
            strokeDasharray="3 3"
            label={{ value: 'Critical (95%)', position: 'right', fill: 'hsl(var(--muted-foreground))' }}
          />
          <Bar dataKey="utilization" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.utilization)} className={getRiskClass(entry.utilization)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
