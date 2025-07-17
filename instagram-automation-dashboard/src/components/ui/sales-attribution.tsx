"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Progress } from "./progress"

interface FunnelStage {
  stage: string
  users: number
  conversion: number
}

interface SalesAttributionProps {
  funnel_data: FunnelStage[]
  conversion_rates: any
  revenue_attribution: {
    total_revenue: number
    instagram_attributed: number
    attribution_percentage: number
  }
  customer_journeys: any[]
  roi_metrics: { ad_spend: number; revenue: number; roi: number }
}

export function SalesAttribution({ funnel_data, revenue_attribution, roi_metrics }: SalesAttributionProps) {
  return (
    <div className="space-y-8">
      {/* Funnel */}
      <Card className="glass-morphism-card">
        <CardHeader>
          <CardTitle className="text-white font-sf-pro">Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {funnel_data.map((f) => (
            <div key={f.stage}>
              <div className="flex items-center justify-between text-sm text-white/80 font-sf-pro mb-1">
                <span>{f.stage}</span>
                <span>{f.users}</span>
              </div>
              <Progress value={f.conversion} indicatorClassName="gold-gradient" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Revenue */}
      <Card className="glass-morphism-card">
        <CardHeader>
          <CardTitle className="text-white font-sf-pro">Revenue Attribution</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg text-white font-sf-pro font-semibold">${revenue_attribution.total_revenue}</p>
            <p className="text-xs text-white/60 font-sf-pro">Total Revenue</p>
          </div>
          <div>
            <p className="text-lg text-white font-sf-pro font-semibold">${revenue_attribution.instagram_attributed}</p>
            <p className="text-xs text-white/60 font-sf-pro">Attributed to IG</p>
          </div>
          <div>
            <p className="text-lg text-white font-sf-pro font-semibold">
              {revenue_attribution.attribution_percentage}%
            </p>
            <p className="text-xs text-white/60 font-sf-pro">Attribution %</p>
          </div>
        </CardContent>
      </Card>

      {/* ROI */}
      <Card className="glass-morphism-card">
        <CardHeader>
          <CardTitle className="text-white font-sf-pro">ROI Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg text-white font-sf-pro font-semibold">${roi_metrics.ad_spend}</p>
            <p className="text-xs text-white/60 font-sf-pro">Ad Spend</p>
          </div>
          <div>
            <p className="text-lg text-white font-sf-pro font-semibold">${roi_metrics.revenue}</p>
            <p className="text-xs text-white/60 font-sf-pro">Revenue</p>
          </div>
          <div>
            <p className="text-lg text-white font-sf-pro font-semibold">{roi_metrics.roi}%</p>
            <p className="text-xs text-white/60 font-sf-pro">ROI</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
