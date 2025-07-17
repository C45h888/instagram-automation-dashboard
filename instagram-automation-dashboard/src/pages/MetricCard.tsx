import MetricCard from '../components/ui/metric-card';

export default function MetricCardPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <MetricCard
        title="Total Followers"
        value="24.8K"
        change_percentage={12.5}
        trend_direction="up"
        time_period="vs last month"
        sparkline_data={[20, 22, 21, 24, 23, 25, 24.8]}
      />
    </div>
  );
} 