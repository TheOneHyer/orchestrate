import { useMemo } from 'react'
import { format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { UtilizationTrend } from '@/lib/burnout-analytics'

interface TrendChartProps {
  data: UtilizationTrend[]
  timeRange: 'week' | 'month' | 'quarter'
  showAll?: boolean
}

const TREND_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))'
]

export function TrendChart({ data, timeRange, showAll = false }: TrendChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return []

    const allDates = new Set<string>()
    data.forEach(trend => {
      trend.dataPoints.forEach(point => {
        allDates.add(point.date)
      })
    })

    const sortedDates = Array.from(allDates).sort()

    return sortedDates.map(date => {
      const dataPoint: any = {
        date: format(new Date(date), 'MMM d')
      }

      const trendsToShow = showAll ? data : data.slice(0, 6)

      trendsToShow.forEach(trend => {
        const point = trend.dataPoints.find(p => p.date === date)
        if (point) {
          dataPoint[trend.trainerId] = Math.round(point.utilization * 10) / 10
        }
      })

      return dataPoint
    })
  }, [data, showAll])

  const trendsToShow = showAll ? data.slice(0, 6) : data.slice(0, 1)

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
