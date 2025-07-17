"use client"

import { Line, LineChart, CartesianGrid, XAxis, YAxis, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./chart"

interface DataPoint {
  date: string
  followers: number
  engagement: number
  reach: number
}

interface PerformanceChartsProps {
  chart_data: DataPoint[]
  chart_type: string
  time_range: string
  metrics: string[]
  comparison_data: any
}

export function PerformanceCharts({ chart_data }: PerformanceChartsProps) {
  return (
    <Card className="glass-morphism-card">
      <CardHeader>
        <CardTitle className="text-white font-sf-pro">Performance Overview</CardTitle>
      </CardHeader>
      <CardContent className="h-[420px]">
        <div className="h-full">
          <ChartContainer>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart_data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="followers"
                  stroke="var(--color-followers)"
                  name="Followers"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="engagement"
                  stroke="var(--color-engagement)"
                  name="Engagement %"
                  strokeWidth={2}
                />
                <Line type="monotone" dataKey="reach" stroke="var(--color-reach)" name="Reach" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}
 