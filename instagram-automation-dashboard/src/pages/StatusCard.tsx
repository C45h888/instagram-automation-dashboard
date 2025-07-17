import StatusCard from '../components/ui/status-card';

export default function StatusCardPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <StatusCard
        workflow_name="Content Posting"
        status="Active"
        last_run="2 minutes ago"
        next_run="In 4 hours"
        metrics={{ success_rate: 98, posts_today: 12 }}
      />
    </div>
  );
} 