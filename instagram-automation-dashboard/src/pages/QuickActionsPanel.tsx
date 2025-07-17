import QuickActionsPanel from '../components/ui/quick-actions-panel';

export default function QuickActionsPanelPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <QuickActionsPanel
        workflow_states={{ 'Auto-Post': true, 'Content Gen': false, Analytics: true, 'DM Bot': false }}
        system_health="Healthy"
        emergency_mode={false}
        on_toggle_workflow={() => {}}
      />
    </div>
  );
} 