import { useState } from "react"
import MetricCard from "../components/ui/metric-card"
// import PerformanceCharts, SalesAttribution, CompetitorAnalysis as needed

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
    trend_direction: "flat",
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

const tabList = [
  { value: "performance", label: "Performance" },
  { value: "sales", label: "Sales Attribution" },
  { value: "competitors", label: "Competitor Analysis" },
]

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("performance")
  return (
    <div className="space-y-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Analytics Dashboard</h1>
        <p className="text-gray-300 text-lg">Deep insights into your Instagram performance and ROI</p>
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
      {/* Metrics Cards */}
      {activeTab === "performance" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {metricsData.map((metric, idx) => (
            <MetricCard key={idx} {...metric} />
          ))}
        </div>
      )}
      {/* Tab Content Placeholder */}
      <div className="bg-white/10 border border-white/20 rounded-xl p-8 shadow animate-fade-in">
        <h2 className="text-2xl font-semibold text-white mb-4">
          {activeTab === "performance" && "Performance Overview"}
          {activeTab === "sales" && "Sales Attribution"}
          {activeTab === "competitors" && "Competitor Analysis"}
        </h2>
        {/* Replace below with actual charts/components as you build them */}
        <div className="h-64 flex items-center justify-center text-gray-400">
          {activeTab === "performance" && "[PerformanceCharts goes here]"}
          {activeTab === "sales" && "[SalesAttribution goes here]"}
          {activeTab === "competitors" && "[CompetitorAnalysis goes here]"}
        </div>
      </div>
    </div>
  )
} 