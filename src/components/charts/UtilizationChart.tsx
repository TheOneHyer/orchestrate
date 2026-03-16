import { useMemo } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { DataPoint } from '@/lib/burnout-analytics'

interface UtilizationChartProps {
  data: DataPoint[]
  trainerName: string
}

function formatDate(dateValue: string) {
  const d = parseISO(dateValue)
  return isValid(d) ? format(d, 'MMM d') : 'Invalid date'
}

export function UtilizationChart({ data, trainerName }: UtilizationChartProps) {
  const chartData = useMemo(() => {
    return data.map(point => ({
      date: formatDate(point.date),
      utilization: Math.min(100, Math.max(0, Math.round((point.utilization || 0) * 10) / 10)),
      hours: Math.max(0, Math.round((point.hours || 0) * 10) / 10),
    }))
  }, [data])

  const summary = useMemo(() => {
    if (chartData.length === 0) {
      return {
        min: null,
        max: null,
        average: null,
        recentEntries: [] as typeof chartData,
      }
    }

    const utilizationValues = chartData.map(point => point.utilization)
    const min = Math.min(...utilizationValues)
    const max = Math.max(...utilizationValues)

    return {
      min,
      max,
      average: Math.round(
        utilizationValues.reduce((sum, value) => sum + value, 0) / utilizationValues.length
      ),
      recentEntries: chartData.slice(-3),
    }
  }, [chartData])

  return (
    <div
      data-testid="utilization-chart"
      className="w-full h-[300px] flex flex-col"
      role="figure"
      aria-label={`Utilization trend chart for ${trainerName}`}
    >
      <h3 className="text-sm text-muted-foreground mb-2">Utilization trend for {trainerName}</h3>
      {chartData.length > 0 && summary.min != null && summary.max != null && summary.average != null ? (
        <span className="sr-only">
          {`Utilization for ${trainerName}: min ${summary.min}%, max ${summary.max}%, average ${summary.average}%. Recent entries: ` +
            summary.recentEntries.map(d => `${d.date}: ${d.utilization}%`).join(', ')}
        </span>
      ) : (
        <span className="sr-only">No utilization data available for {trainerName}</span>
      )}
      <div className="flex-1 min-h-0">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No utilization data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                yAxisId="utilization"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
                label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="hours"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
                label={{ value: 'Hours', angle: 90, position: 'insideRight' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              />
              <Legend />
              <Line
                yAxisId="utilization"
                type="monotone"
                dataKey="utilization"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
                name="Utilization %"
              />
              <Line
                yAxisId="hours"
                type="monotone"
                dataKey="hours"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--accent))', r: 3 }}
                name="Hours"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
