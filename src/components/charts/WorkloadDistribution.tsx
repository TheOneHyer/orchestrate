import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { TrainerUtilization } from '@/lib/burnout-analytics'
import { User } from '@/lib/types'

interface WorkloadDistributionProps {
  data: TrainerUtilization[]
  trainers: User[]
}

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
      <div className="sr-only" aria-hidden="true">
        {chartData.map((entry) => (
          <span key={`risk-${entry.name}`} className={getRiskClass(entry.utilization)}>
            {entry.name}
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
            formatter={(value: number, name: string) => {
              if (name === 'utilization') return [`${value}%`, 'Utilization']
              if (name === 'hours') return [`${value}h`, 'Hours']
              if (name === 'sessions') return [value, 'Sessions']
              return [value, name]
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
