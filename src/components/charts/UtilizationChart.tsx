import { useMemo } from 'react'
import { format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { DataPoint } from '@/lib/burnout-analytics'

interface UtilizationChartProps {
  data: DataPoint[]
  trainerName: string
}

export function UtilizationChart({ data, trainerName }: UtilizationChartProps) {
  const chartData = useMemo(() => {
    return data.map(point => ({
      date: format(new Date(point.date), 'MMM d'),
      utilization: Math.round(point.utilization * 10) / 10,
      hours: Math.round(point.hours * 10) / 10,
      sessions: point.sessions
    }))
  }, [data])

  return (
    <div className="w-full h-[300px]">
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
          <Legend />
          <Line 
            type="monotone" 
            dataKey="utilization" 
            stroke="hsl(var(--primary))" 
            strokeWidth={3}
            dot={{ fill: 'hsl(var(--primary))', r: 4 }}
            activeDot={{ r: 6 }}
            name="Utilization %"
          />
          <Line 
            type="monotone" 
            dataKey="hours" 
            stroke="hsl(var(--accent))" 
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--accent))', r: 3 }}
            name="Hours"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
