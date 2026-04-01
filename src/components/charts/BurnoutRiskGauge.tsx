import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, type PieLabelRenderProps } from 'recharts'
import { TrainerUtilization } from '@/lib/burnout-analytics'

/** Props for the {@link BurnoutRiskGauge} component. */
interface BurnoutRiskGaugeProps {
  /** Array of trainer utilization records used to compute risk-level distribution. */
  data: TrainerUtilization[]
}

/** Color map keyed by risk level used to fill pie-chart cells. */
const COLORS = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444'
}

/**
 * Pie chart that visualises the distribution of trainer burnout risk levels.
 *
 * Trainers are bucketed into four risk categories (low / medium / high / critical)
 * and rendered as proportional pie slices.  When there is no data the component
 * renders an empty-state placeholder instead.
 *
 * @param props - Component props.
 * @param props.data - Utilization records for each trainer.
 * @returns A responsive pie chart element, or an empty-state div.
 */
export function BurnoutRiskGauge({ data }: BurnoutRiskGaugeProps) {
  const chartData = useMemo(() => {
    const counts = {
      low: data.filter(t => t.riskLevel === 'low').length,
      medium: data.filter(t => t.riskLevel === 'medium').length,
      high: data.filter(t => t.riskLevel === 'high').length,
      critical: data.filter(t => t.riskLevel === 'critical').length
    }

    return [
      { name: 'Low Risk', value: counts.low, level: 'low' },
      { name: 'Medium Risk', value: counts.medium, level: 'medium' },
      { name: 'High Risk', value: counts.high, level: 'high' },
      { name: 'Critical Risk', value: counts.critical, level: 'critical' }
    ].filter(item => item.value > 0)
  }, [data])

  if (chartData.length === 0) {
    return (
      <div data-testid="burnout-risk-gauge-empty" className="w-full h-[300px] flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    )
  }

  return (
    <div data-testid="burnout-risk-gauge" className="w-full h-[300px]">
      <div data-testid="burnout-risk-gauge-chart" className="h-full">
        <span className="sr-only">
          Burnout risk distribution: {chartData.map(d => `${d.value} ${d.name}`).join(', ')}
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(props: PieLabelRenderProps) => `${props.name}: ${((props.percent ?? 0) * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.level as keyof typeof COLORS]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
