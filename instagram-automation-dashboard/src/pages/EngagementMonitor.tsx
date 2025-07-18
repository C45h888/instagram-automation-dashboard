import { useState } from "react"
import { LiveEngagementMonitor } from "../components/ui/live-engagement-monitor"

const engagementData = {
  live_comments: [
    { id: 1, post_id: "p1", user: "@user1", comment: "Great post!", timestamp: "1m ago", sentiment: "positive", priority: "high" },
    { id: 2, post_id: "p2", user: "@user2", comment: "Love this!", timestamp: "2m ago", sentiment: "positive", priority: "medium" },
    { id: 3, post_id: "p3", user: "@user3", comment: "Can you share more details?", timestamp: "5m ago", sentiment: "neutral", priority: "low" },
  ],
  dm_conversations: [
    { id: 1, user: "@dmuser1", last_message: "Is this available in blue?", timestamp: "3m ago", status: "open", priority: "high" },
    { id: 2, user: "@dmuser2", last_message: "Thank you!", timestamp: "7m ago", status: "closed", priority: "low" },
  ],
  mentions: [
    { id: 1, user: "@mention1", content: "Check out @yourbrand!", timestamp: "10m ago", platform: "Instagram" },
    { id: 2, user: "@mention2", content: "Loving the new drop from @yourbrand", timestamp: "12m ago", platform: "Instagram" },
  ],
  response_queue: [],
  auto_response_settings: {},
}

const tabList = [
  { value: "live", label: "Live Monitor" },
  { value: "templates", label: "Templates" },
  { value: "service", label: "Service Analytics" },
]

export default function EngagementMonitor() {
  const [activeTab, setActiveTab] = useState("live")
  return (
    <div className="space-y-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Engagement Hub</h1>
        <p className="text-gray-300 text-lg">Monitor and manage customer interactions in real-time</p>
      </div>
      {/* Premium Tabs */}
      <div className="flex flex-wrap gap-4 mb-8">
        {tabList.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 border border-gray-700 backdrop-blur-sm shadow-sm text-base
              ${activeTab === tab.value ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'bg-gray-800/50 text-gray-300 hover:text-white hover:bg-white/10'}`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === "live" && <LiveEngagementMonitor {...engagementData} />}
        {activeTab === "templates" && (
          <div className="h-64 flex items-center justify-center text-gray-400">[ResponseTemplates goes here]</div>
        )}
        {activeTab === "service" && (
          <div className="h-64 flex items-center justify-center text-gray-400">[ServiceAnalytics goes here]</div>
        )}
      </div>
    </div>
  )
} 