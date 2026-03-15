import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts'
import { format, parseISO } from 'date-fns'

interface RiskHistoryPoint {
  date: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  utilizationRate: number
  sessionCount: number
  hoursScheduled: number
}

interface RiskTrendChartProps {
  data: RiskHistoryPoint[]
  trainerName?: string
  showUtilization?: boolean
}

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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{data.fullDate}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Risk Score:</span>
              <span className="font-bold">{data['Risk Score']}</span>
            </div>
            {showUtilization && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Utilization:</span>
                <span className="font-semibold">{data['Utilization %']?.toFixed(1)}%</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Sessions:</span>
              <span className="font-semibold">{data.sessions}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Hours:</span>
              <span className="font-semibold">{data.hours}h</span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-border mt-2">
              <span className="text-muted-foreground">Risk Level:</span>
              <span className={`font-bold uppercase text-xs px-2 py-0.5 rounded ${
                data.riskLevel === 'critical' ? 'bg-destructive/20 text-destructive' :
                data.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-500' :
                data.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                'bg-green-500/20 text-green-500'
              }`}>
                {data.riskLevel}
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
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="font-medium">No historical data available</p>
          <p className="text-sm mt-1">Risk tracking will appear as data is collected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {trainerName && (
        <p className="text-sm text-muted-foreground">
          Tracking {trainerName}'s risk level over time
        </p>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.45 0.15 250)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="oklch(0.45 0.15 250)" stopOpacity={0.05}/>
            </linearGradient>
            {showUtilization && (
              <linearGradient id="utilizationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.68 0.18 45)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="oklch(0.68 0.18 45)" stopOpacity={0.05}/>
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
            label={{ value: 'Low Risk', position: 'insideTopRight', fill: 'oklch(0.55 0.01 250)', fontSize: 11 }}
          />
          <ReferenceLine 
            y={45} 
            stroke="oklch(0.769 0.188 70.08)" 
            strokeDasharray="5 5" 
            strokeOpacity={0.4}
            label={{ value: 'Medium Risk', position: 'insideTopRight', fill: 'oklch(0.55 0.01 250)', fontSize: 11 }}
          />
          <ReferenceLine 
            y={70} 
            stroke="oklch(0.646 0.222 41.116)" 
            strokeDasharray="5 5" 
            strokeOpacity={0.4}
            label={{ value: 'High Risk', position: 'insideTopRight', fill: 'oklch(0.55 0.01 250)', fontSize: 11 }}
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
