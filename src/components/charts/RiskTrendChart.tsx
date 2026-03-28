import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts'
import { format, parseISO } from 'date-fns'

/** A single data point derived from a {@link RiskHistorySnapshot} for chart rendering. */
interface RiskHistoryPoint {
  /** ISO-8601 date string for the snapshot. */
  date: string
  /** Composite risk score (0–100). */
  riskScore: number
  /** Categorical risk level derived from `riskScore`. */
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  /** Trainer utilization rate as a percentage (0–100). */
  utilizationRate: number
  /** Number of sessions in the snapshot period. */
  sessionCount: number
  /** Total hours scheduled in the snapshot period. */
  hoursScheduled: number
}

/** Props for the {@link RiskTrendChart} component. */
interface RiskTrendChartProps {
  /** Historical risk data points to render. */
  data: RiskHistoryPoint[]
  /** Optional trainer name used in accessible labels. */
  trainerName?: string
  /** When `true`, a second line for utilization percentage is overlaid. */
  showUtilization?: boolean
}

/**
 * Full chart payload used by the custom tooltip for a hovered point.
 */
interface TooltipPointPayload {
  /** Fully formatted date label for tooltip display. */
  fullDate: string
  /** Risk score value plotted for the point. */
  'Risk Score': number
  /** Optional utilization percentage when utilization is enabled. */
  'Utilization %'?: number
  /** Session count associated with the point. */
  sessions: number
  /** Scheduled hours associated with the point. */
  hours: number
  /** Derived categorical risk level for badge styling. */
  riskLevel: RiskHistoryPoint['riskLevel']
}



/**
 * Area/line chart that visualises a trainer's burnout risk score trend over time.
 *
 * Optionally overlays the utilization-rate series when `showUtilization` is
 * `true`.  An inline `CustomTooltip` enriches hover interactions with session
 * count, hours, and full date.
 *
 * @param props - Component props.
 * @param props.data - Ordered historical risk data points.
 * @param props.trainerName - Trainer name used in accessible label text.
 * @param props.showUtilization - Whether to render the utilization line.
 * @returns A responsive chart element or an empty-state placeholder.
 */
export function RiskTrendChart({ data, trainerName, showUtilization = false }: RiskTrendChartProps) {
  const chartData = useMemo(() => {
    return data.map(point => ({
      date: format(parseISO(point.date), 'MMM d'),
      fullDate: format(parseISO(point.date), 'MMMM d, yyyy'),
      'Risk Score': point.riskScore,
      'Utilization %': showUtilization ? point.utilizationRate : undefined,
      riskLevel: point.riskLevel,
      sessions: point.sessionCount,
      hours: point.hoursScheduled
    }))
  }, [data, showUtilization])

  const utilizationSummary = useMemo(() => {
    if (!showUtilization || chartData.length === 0) {
      return ''
    }

    const values = chartData.map((point) => {
      const value = point['Utilization %']
      return typeof value === 'number' ? value : 0
    })
    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    const first = values[0]
    const last = values[values.length - 1]
    const trendDirection = last > first ? 'up' : last < first ? 'down' : 'flat'

    return `Utilization average ${average.toFixed(1)}% trend ${trendDirection}`
  }, [chartData, showUtilization])

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: TooltipPointPayload }> }) => {
    const point = payload?.[0]?.payload
    if (active && point) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{point.fullDate}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Risk Score:</span>
              <span className="font-bold">{point['Risk Score']}</span>
            </div>
            {showUtilization && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Utilization:</span>
                <span className="font-semibold">{point['Utilization %']?.toFixed(1)}%</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Sessions:</span>
              <span className="font-semibold">{point.sessions}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Hours:</span>
              <span className="font-semibold">{point.hours}h</span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-border mt-2">
              <span className="text-muted-foreground">Risk Level:</span>
              <span className={`font-bold uppercase text-xs px-2 py-0.5 rounded ${point.riskLevel === 'critical' ? 'bg-destructive/20 text-destructive' :
                point.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-500' :
                  point.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                    'bg-green-500/20 text-green-500'
                }`}>
                {point.riskLevel}
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  if (data.length === 0) {
    return (
      <div data-testid="risk-trend-chart-empty" className="h-[300px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="font-medium">No historical data available</p>
          <p className="text-sm mt-1">Risk tracking will appear as data is collected</p>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="risk-trend-chart" className="space-y-3">
      {trainerName && (
        <p className="text-sm text-muted-foreground">
          Tracking {trainerName}'s risk level over time
        </p>
      )}
      {showUtilization && <span data-testid="utilization-summary" className="sr-only">{utilizationSummary}</span>}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.45 0.15 250)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="oklch(0.45 0.15 250)" stopOpacity={0.05} />
            </linearGradient>
            {showUtilization && (
              <linearGradient id="utilizationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.68 0.18 45)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.68 0.18 45)" stopOpacity={0.05} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 250)" opacity={0.3} />
          <XAxis
            dataKey="date"
            stroke="oklch(0.55 0.01 250)"
            style={{ fontSize: '12px' }}
            tickMargin={8}
          />
          <YAxis
            stroke="oklch(0.55 0.01 250)"
            style={{ fontSize: '12px' }}
            tickMargin={8}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '13px', paddingTop: '12px' }}
            iconType="circle"
          />

          <ReferenceLine
            y={25}
            stroke="oklch(0.828 0.189 84.429)"
            strokeDasharray="5 5"
            strokeOpacity={0.4}
            label={{ value: 'Medium Risk', position: 'insideTopRight', fill: 'oklch(0.55 0.01 250)', fontSize: 11 }}
          />
          <ReferenceLine
            y={45}
            stroke="oklch(0.769 0.188 70.08)"
            strokeDasharray="5 5"
            strokeOpacity={0.4}
            label={{ value: 'High Risk', position: 'insideTopRight', fill: 'oklch(0.55 0.01 250)', fontSize: 11 }}
          />
          <ReferenceLine
            y={70}
            stroke="oklch(0.646 0.222 41.116)"
            strokeDasharray="5 5"
            strokeOpacity={0.4}
            label={{ value: 'Critical Risk', position: 'insideTopRight', fill: 'oklch(0.55 0.01 250)', fontSize: 11 }}
          />

          <Area
            type="monotone"
            dataKey="Risk Score"
            stroke="oklch(0.45 0.15 250)"
            fill="url(#riskGradient)"
            strokeWidth={3}
            dot={{ fill: 'oklch(0.45 0.15 250)', r: 4 }}
            activeDot={{ r: 6, fill: 'oklch(0.45 0.15 250)' }}
          />

          {showUtilization && (
            <Line
              type="monotone"
              dataKey="Utilization %"
              stroke="oklch(0.68 0.18 45)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: 'oklch(0.68 0.18 45)', r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-4 gap-4 pt-2 border-t border-border text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500/30 border-2 border-green-500"></div>
          <span className="text-muted-foreground">Low (0-24)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500/30 border-2 border-yellow-500"></div>
          <span className="text-muted-foreground">Medium (25-44)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500/30 border-2 border-orange-500"></div>
          <span className="text-muted-foreground">High (45-69)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-destructive/30 border-2 border-destructive"></div>
          <span className="text-muted-foreground">Critical (70+)</span>
        </div>
      </div>
    </div>
  )
}
