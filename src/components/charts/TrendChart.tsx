import { useMemo } from 'react'
import { format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { UtilizationTrend } from '@/lib/burnout-analytics'

/** Props for the {@link TrendChart} component. */
interface TrendChartProps {
  /** Array of per-trainer utilization trend data to render. */
  data: UtilizationTrend[]
  /** Time range that controls how many historical data points are included. */
  timeRange: 'week' | 'month' | 'quarter'
  /** When `true`, up to six trainers are rendered; otherwise only the first trainer is shown. */
  showAll?: boolean
}

/** Ordered palette of CSS custom-property colour strings for up to six trend lines. */
const TREND_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))'
]

/**
 * Multi-series line chart visualising utilization trends for one or more trainers.
 *
 * Data points are filtered to the selected `timeRange` before rendering.
 * When `showAll` is `false` (the default) only the first trainer's series is
 * displayed; when `true` up to six trainers are overlaid with distinct colours
 * from {@link TREND_COLORS}.
 *
 * @param props - Component props.
 * @param props.data - Utilization trend data for each trainer.
 * @param props.timeRange - Controls the date window applied to each trend's data points.
 * @param props.showAll - Whether to show all trainers or just the first.
 * @returns A responsive line chart, or an empty-state div when there is no data.
 */
export function TrendChart({ data, timeRange, showAll = false }: TrendChartProps) {
  const filteredData = useMemo(() => {
    if (data.length === 0) {
      return []
    }

    const rangeDays = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90
    const allTimestamps = data
      .flatMap((trend) => trend.dataPoints.map((point) => new Date(point.date).getTime()))
      .filter((timestamp) => !Number.isNaN(timestamp))

    if (allTimestamps.length === 0) {
      return data.map((trend) => ({ ...trend, dataPoints: [] }))
    }

    const latestTimestamp = Math.max(...allTimestamps)
    const startTimestamp = latestTimestamp - (rangeDays - 1) * 24 * 60 * 60 * 1000

    return data.map((trend) => ({
      ...trend,
      dataPoints: trend.dataPoints.filter((point) => {
        const timestamp = new Date(point.date).getTime()
        return !Number.isNaN(timestamp) && timestamp >= startTimestamp && timestamp <= latestTimestamp
      }),
    }))
  }, [data, timeRange])

  const trendsToShow = useMemo(
    () => (showAll ? filteredData.slice(0, 6) : filteredData.slice(0, 1)),
    [filteredData, showAll]
  )

  const chartData = useMemo(() => {
    if (trendsToShow.length === 0) {
      return []
    }

    const allDates = new Set<string>()
    trendsToShow.forEach((trend) => {
      trend.dataPoints.forEach((point) => {
        allDates.add(point.date)
      })
    })

    const sortedDates = Array.from(allDates).sort()

    return sortedDates.map((date) => {
      const dataPoint: any = {
        date: format(new Date(date), 'MMM d'),
      }

      trendsToShow.forEach((trend) => {
        const point = trend.dataPoints.find((entry) => entry.date === date)
        if (point) {
          dataPoint[trend.trainerId] = Math.round(point.utilization * 10) / 10
        }
      })

      return dataPoint
    })
  }, [trendsToShow])

  if (chartData.length === 0) {
    return (
      <div data-testid="trend-chart-empty" className="w-full h-[300px] flex items-center justify-center text-muted-foreground">
        No trend data available
      </div>
    )
  }

  return (
    <div data-testid="trend-chart" className="w-full h-[300px]">
      <div className="sr-only">
        {trendsToShow.map((trend, index) => {
          const seriesLabel = `Trainer ${index + 1}`
          const values = trend.dataPoints.map((point) => point.utilization)
          const latestValue = values[values.length - 1] ?? 0
          const averageValue = values.length > 0
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : 0
          const firstValue = values[0] ?? 0
          const trendDirection = latestValue > firstValue ? 'up' : latestValue < firstValue ? 'down' : 'flat'

          return (
            <span key={trend.trainerId} data-testid={`trend-series-${trend.trainerId}`}>
              {`${seriesLabel}: latest ${latestValue.toFixed(1)}%, average ${averageValue.toFixed(1)}%, trend ${trendDirection}`}
            </span>
          )
        })}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
            label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
          />
          {showAll && <Legend />}
          {trendsToShow.map((trend, index) => (
            <Line
              key={trend.trainerId}
              type="monotone"
              dataKey={trend.trainerId}
              stroke={TREND_COLORS[index % TREND_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name={`Trainer ${index + 1}`}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
