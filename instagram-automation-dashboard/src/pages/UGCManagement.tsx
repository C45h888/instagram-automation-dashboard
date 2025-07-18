import { CustomerServiceDashboard } from "../components/ui/customer-service-dashboard"

const ugcData = {
  response_times: {
    avg_response_time: "2.1 min",
    target_response_time: "5 min",
    within_target: 92,
  },
  inquiry_classifications: [
    { type: "Product Inquiry", count: 34, percentage: 40 },
    { type: "Order Status", count: 28, percentage: 33 },
    { type: "Collab Request", count: 12, percentage: 14 },
    { type: "Other", count: 11, percentage: 13 },
  ],
  team_metrics: {
    total_agents: 8,
    active_agents: 5,
    avg_satisfaction: 4.7,
  },
  satisfaction_scores: {
    current_score: 4.7,
    target_score: 4.9,
    trend: "up",
  },
  resolution_rates: {
    first_contact: 78,
    within_24h: 92,
    overall: 95,
  },
}

export default function UGCManagement() {
  return (
    <div className="space-y-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">UGC & Influencer Management</h1>
        <p className="text-gray-300 text-lg">Manage user-generated content and influencers efficiently</p>
      </div>
      <div className="animate-fade-in">
        <CustomerServiceDashboard {...ugcData} />
      </div>
    </div>
  )
} 