import { useMemo } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { DataPoint } from '@/lib/burnout-analytics'

/** Props for the {@link UtilizationChart} component. */
interface UtilizationChartProps {
  /** Ordered array of weekly utilization data points to plot. */
  data: DataPoint[]
  /** Display name of the trainer, used in the chart heading and ARIA label. */
  trainerName: string
}

/**
 * Formats an ISO-8601 date string to a short month/day label (e.g. "Jan 5").
 *
 * @param dateValue - ISO-8601 date string.
 * @returns A formatted label, or `"Invalid date"` when parsing fails.
 */
function formatDate(dateValue: string) {
  const d = parseISO(dateValue)
  return isValid(d) ? format(d, 'MMM d') : 'Invalid date'
}

/**
 * Dual-axis line chart displaying a single trainer's weekly utilization percentage
 * and scheduled hours over time.
 *
 * The left Y-axis tracks utilization (%), the right Y-axis tracks hours.  An
 * accessible summary is rendered via a `<span className="sr-only">` element.
 * When `data` is empty an inline empty-state message is displayed.
 *
 * @param props - Component props.
 * @param props.data - Weekly data points to plot.
 * @param props.trainerName - Trainer name surfaced in heading and ARIA label.
 * @returns A responsive figure element containing the chart.
 */
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
