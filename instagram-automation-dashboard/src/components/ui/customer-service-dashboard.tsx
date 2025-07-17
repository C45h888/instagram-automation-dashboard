"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Progress } from "./progress"
import { CircleGauge, Users } from "lucide-react"

interface ServiceData {
  response_times: {
    avg_response_time: string
    target_response_time: string
    within_target: number
  }
  inquiry_classifications: { type: string; count: number; percentage: number }[]
  team_metrics: { total_agents: number; active_agents: number; avg_satisfaction: number }
  satisfaction_scores: { current_score: number; target_score: number; trend: string }
  resolution_rates: { first_contact: number; within_24h: number; overall: number }
}

export function CustomerServiceDashboard({ response_times, inquiry_classifications, team_metrics }: ServiceData) {
  return (
    <div className="space-y-8">
      {/* Response Time */}
      <Card className="glass-morphism-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3 text-white font-sf-pro">
            <CircleGauge className="w-5 h-5 text-gold-500" />
            <span>Response Times</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-white/80 font-sf-pro">
            <span>Average</span>
            <span>{response_times.avg_response_time}</span>
          </div>
          <Progress
            value={response_times.within_target}
            className="h-3 rounded-full"
            indicatorClassName="gold-gradient"
          />
          <div className="flex items-center justify-between text-xs text-white/50 font-sf-pro">
            <span>Responses within {response_times.target_response_time}</span>
            <span>{response_times.within_target}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Team Metrics */}
      <Card className="glass-morphism-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3 text-white font-sf-pro">
            <Users className="w-5 h-5 text-gold-500" />
            <span>Team Metrics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg text-white font-sf-pro font-semibold">{team_metrics.total_agents}</p>
              <p className="text-xs text-white/60 font-sf-pro">Total Agents</p>
            </div>
            <div>
              <p className="text-lg text-white font-sf-pro font-semibold">{team_metrics.active_agents}</p>
              <p className="text-xs text-white/60 font-sf-pro">Active Now</p>
            </div>
            <div>
              <p className="text-lg text-white font-sf-pro font-semibold">{team_metrics.avg_satisfaction}</p>
              <p className="text-xs text-white/60 font-sf-pro">Avg Rating</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inquiry Breakdown */}
      <Card className="glass-morphism-card">
        <CardHeader>
          <CardTitle className="text-white font-sf-pro">Inquiry Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {inquiry_classifications.map((i) => (
            <div key={i.type} className="flex items-center justify-between py-2 text-white/80 font-sf-pro text-sm">
              <span>{i.type}</span>
              <span>
                {i.count} ({i.percentage}%)
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
