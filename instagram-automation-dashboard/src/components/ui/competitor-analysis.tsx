"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Badge } from "./badge"
import { Users2 } from "lucide-react"

interface Competitor {
  name: string
  followers: number
  engagement_rate: number
  posting_frequency: number
  top_content_types: string[]
}

interface CompetitorAnalysisProps {
  competitor_data: Competitor[]
  market_share: any
  trending_content: any[]
  engagement_benchmarks: any
  recommendations: string[]
}

export function CompetitorAnalysis({ competitor_data, recommendations }: CompetitorAnalysisProps) {
  return (
    <div className="space-y-8">
      {/* Competitor Table */}
      <Card className="glass-morphism-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3 text-white font-sf-pro">
            <Users2 className="w-5 h-5 text-gold-500" />
            <span>Competitors</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm text-white/80 font-sf-pro">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Followers</th>
                <th className="py-3 pr-4">Engagement %</th>
                <th className="py-3 pr-4">Posts / Day</th>
                <th className="py-3">Top Content</th>
              </tr>
            </thead>
            <tbody>
              {competitor_data.map((c) => (
                <tr key={c.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4">{c.name}</td>
                  <td className="py-3 pr-4">{c.followers.toLocaleString()}</td>
                  <td className="py-3 pr-4">{c.engagement_rate}%</td>
                  <td className="py-3 pr-4">{c.posting_frequency}</td>
                  <td className="py-3 space-x-1">
                    {c.top_content_types.map((t) => (
                      <Badge key={t} className="bg-white/10 text-white/70 text-xs font-sf-pro capitalize">
                        {t}
                      </Badge>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="glass-morphism-card">
        <CardHeader>
          <CardTitle className="text-white font-sf-pro">Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendations.map((r, i) => (
            <div key={i} className="glass-morphism-workflow p-4 rounded-xl text-white font-sf-pro">
              {r}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// Competitor Analysis component (paste your code here) 