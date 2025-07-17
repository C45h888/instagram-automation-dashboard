"use client"

import { useState } from "react"
import { HeaderNavigation } from "../ui/header-navigation"
import { LiveEngagementMonitor } from "../ui/live-engagement-monitor"
import { ResponseTemplates } from "../ui/response-templates"
import { CustomerServiceDashboard } from "../ui/customer-service-dashboard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { MessageSquare, Zap, HeadphonesIcon } from "lucide-react"

export default function EngagementPage() {
  const [activeTab, setActiveTab] = useState("monitor")

  const monitorData = {
    live_comments: [
      {
        id: 1,
        post_id: "post_123",
        user: "@sarah_johnson",
        comment: "Love this new collection! When will it be available?",
        timestamp: "2 minutes ago",
        sentiment: "positive",
        priority: "high",
      },
      {
        id: 2,
        post_id: "post_124",
        user: "@mike_design",
        comment: "The quality looks amazing in this video",
        timestamp: "5 minutes ago",
        sentiment: "positive",
        priority: "medium",
      },
    ],
    dm_conversations: [
      {
        id: 1,
        user: "@potential_customer",
        last_message: "Hi, I'm interested in your premium package",
        timestamp: "1 minute ago",
        status: "unread",
        priority: "high",
      },
    ],
    mentions: [
      {
        id: 1,
        user: "@fashion_blogger",
        content: "Just discovered @yourbrand and I'm obsessed!",
        timestamp: "10 minutes ago",
        platform: "story",
      },
    ],
    response_queue: [],
    auto_response_settings: {
      enabled: true,
      business_hours_only: true,
      response_delay: 5,
    },
  }

  const templatesData = {
    template_categories: ["greeting", "product_inquiry", "support", "closing"],
    templates: [
      {
        id: 1,
        category: "greeting",
        title: "Welcome Message",
        content: "Hi there! Thanks for reaching out. How can we help you today?",
        usage_count: 156,
        performance_score: 4.8,
      },
      {
        id: 2,
        category: "product_inquiry",
        title: "Product Information",
        content:
          "Thanks for your interest! You can find detailed product information on our website. Would you like me to send you a direct link?",
        usage_count: 89,
        performance_score: 4.6,
      },
    ],
    performance_metrics: {
      response_rate: 94,
      satisfaction_score: 4.7,
      avg_response_time: "2.3 minutes",
    },
    ab_testing_data: {},
    usage_stats: {},
  }

  const serviceData = {
    response_times: {
      avg_response_time: "2.3 minutes",
      target_response_time: "5 minutes",
      within_target: 87,
    },
    inquiry_classifications: [
      { type: "Product Questions", count: 45, percentage: 35 },
      { type: "Order Support", count: 32, percentage: 25 },
      { type: "General Inquiry", count: 28, percentage: 22 },
      { type: "Complaints", count: 23, percentage: 18 },
    ],
    team_metrics: {
      total_agents: 3,
      active_agents: 2,
      avg_satisfaction: 4.7,
    },
    satisfaction_scores: {
      current_score: 4.7,
      target_score: 4.5,
      trend: "up",
    },
    resolution_rates: {
      first_contact: 78,
      within_24h: 94,
      overall: 98,
    },
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <HeaderNavigation />

      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Engagement Hub</h1>
          <p className="text-gray-300 text-lg">Monitor and manage customer interactions in real-time</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-2 h-auto">
            <TabsTrigger
              value="monitor"
              className="flex items-center space-x-2 px-6 py-3 text-gray-300 data-[state=active]:text-yellow-500 data-[state=active]:bg-yellow-500/10"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Live Monitor</span>
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="flex items-center space-x-2 px-6 py-3 text-gray-300 data-[state=active]:text-yellow-500 data-[state=active]:bg-yellow-500/10"
            >
              <Zap className="w-4 h-4" />
              <span>Templates</span>
            </TabsTrigger>
            <TabsTrigger
              value="service"
              className="flex items-center space-x-2 px-6 py-3 text-gray-300 data-[state=active]:text-yellow-500 data-[state=active]:bg-yellow-500/10"
            >
              <HeadphonesIcon className="w-4 h-4" />
              <span>Service Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitor" className="animate-fade-in">
            <LiveEngagementMonitor {...monitorData} />
          </TabsContent>

          <TabsContent value="templates" className="animate-fade-in">
            <ResponseTemplates {...templatesData} />
          </TabsContent>

          <TabsContent value="service" className="animate-fade-in">
            <CustomerServiceDashboard {...serviceData} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
