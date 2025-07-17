"use client"

import { useState } from "react"
import { HeaderNavigation } from "./ui/header-navigation"
import { StatusCard } from "./ui/status-card"
import { MetricCard } from "./ui/metric-card"
import { ActivityFeed } from "./ui/activity-feed"
import { QuickActionsPanel } from "./ui/quick-actions-panel"

export default function Dashboard() {
  const [workflowStates, setWorkflowStates] = useState({
    contentPosting: true,
    engagementMonitor: true,
    analytics: false,
    autoResponse: true,
  })

  const handleToggleWorkflow = (workflow: string) => {
    setWorkflowStates((prev) => ({
      ...prev,
      [workflow]: !prev[workflow as keyof typeof prev],
    }))
  }

  const statusData = [
    {
      workflow_name: "Content Posting",
      status: "active",
      last_run: "2 minutes ago",
      next_run: "In 4 hours",
      metrics: { success_rate: 98, posts_today: 12 },
    },
    {
      workflow_name: "Engagement Monitor",
      status: "active",
      last_run: "30 seconds ago",
      next_run: "Continuous",
      metrics: { responses_today: 45, avg_response_time: "2.3 min" },
    },
    {
      workflow_name: "Analytics Sync",
      status: "paused",
      last_run: "1 hour ago",
      next_run: "Manual start required",
      metrics: { last_sync: "1 hour ago", data_points: 1250 },
    },
  ]

  const metricsData = [
    {
      title: "Total Followers",
      value: "24.8K",
      change_percentage: 12.5,
      trend_direction: "up",
      time_period: "vs last month",
      sparkline_data: [20, 22, 21, 24, 23, 25, 24.8],
    },
    {
      title: "Engagement Rate",
      value: "4.2%",
      change_percentage: -2.1,
      trend_direction: "down",
      time_period: "vs last week",
      sparkline_data: [4.8, 4.6, 4.3, 4.1, 4.0, 4.1, 4.2],
    },
    {
      title: "Posts Today",
      value: "12",
      change_percentage: 0,
      trend_direction: "neutral",
      time_period: "scheduled",
      sparkline_data: [8, 10, 12, 11, 9, 10, 12],
    },
    {
      title: "Revenue Attribution",
      value: "$3,240",
      change_percentage: 18.7,
      trend_direction: "up",
      time_period: "this month",
      sparkline_data: [2800, 2900, 3100, 3000, 3150, 3200, 3240],
    },
  ]

  const activityData = [
    {
      activity_type: "post",
      description: "New post published: Summer Collection Launch",
      timestamp: "2 minutes ago",
      user: "@fashionbrand",
      status: "success",
      details: "Reached 2.3K users, 145 likes, 23 comments",
    },
    {
      activity_type: "comment",
      description: "Auto-replied to customer inquiry about sizing",
      timestamp: "5 minutes ago",
      user: "@customer_sarah",
      status: "success",
      details: "Template: Sizing Guide used",
    },
    {
      activity_type: "error",
      description: "Failed to post story - media format issue",
      timestamp: "12 minutes ago",
      user: "System",
      status: "error",
      details: "Video format not supported, converted and retried",
    },
    {
      activity_type: "message",
      description: "New DM from potential customer",
      timestamp: "18 minutes ago",
      user: "@potential_buyer",
      status: "info",
      details: "Inquiry about product availability",
    },
  ]

  return (
    <div className="min-h-screen bg-gray-900">
      <HeaderNavigation />

      <main className="max-w-7xl mx-auto px-8 py-12 space-y-12">
        {/* Quick Actions Panel */}
        <section className="animate-fade-in">
          <QuickActionsPanel
            workflow_states={workflowStates}
            system_health="healthy"
            emergency_mode={false}
            on_toggle_workflow={handleToggleWorkflow}
          />
        </section>

        {/* Status Cards */}
        <section className="animate-fade-in">
          <h2 className="text-3xl font-semibold text-white mb-8 tracking-tight">Workflow Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {statusData.map((status, index) => (
              <StatusCard key={index} {...status} />
            ))}
          </div>
        </section>

        {/* Metrics Cards */}
        <section className="animate-fade-in">
          <h2 className="text-3xl font-semibold text-white mb-8 tracking-tight">Key Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {metricsData.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))}
          </div>
        </section>

        {/* Activity Feed */}
        <section className="animate-fade-in">
          <h2 className="text-3xl font-semibold text-white mb-8 tracking-tight">Recent Activity</h2>
          <ActivityFeed activities={activityData} />
        </section>
      </main>
    </div>
  )
}
