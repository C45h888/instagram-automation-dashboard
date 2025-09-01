import React, { useState, useMemo, useCallback } from 'react';
import { DatabaseService } from '@/services/databaseService';
import { useRealtimeWorkflows, useRealtimeExecutions } from '@/hooks/useRealtimeData';
import { useAuthStore } from '@/stores/authStore';
import { 
  Play, Pause, Trash2, Settings, Clock, CheckCircle, 
  XCircle, Activity, TrendingUp, Zap, MessageSquare,
  Camera, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

// Workflow templates with proper typing
const WORKFLOW_TEMPLATES = [
  {
    type: 'engagement_monitor' as const,
    name: 'Engagement Monitor',
    description: 'Track and respond to comments and DMs',
    icon: MessageSquare,
    color: 'from-blue-500 to-blue-600',
    config: {
      auto_reply: true,
      sentiment_analysis: true,
      keywords: [],
      response_time: 30
    }
  },
  {
    type: 'analytics_pipeline' as const,
    name: 'Analytics Pipeline',
    description: 'Automated daily/weekly analytics reports',
    icon: TrendingUp,
    color: 'from-green-500 to-green-600',
    config: {
      frequency: 'daily',
      send_time: '09:00',
      email_recipients: [],
      include_competitors: false
    }
  },
  {
    type: 'sales_attribution' as const,
    name: 'Sales Attribution',
    description: 'Track Instagram-driven sales',
    icon: DollarSign,
    color: 'from-purple-500 to-purple-600',
    config: {
      tracking_params: ['utm_source', 'utm_campaign'],
      conversion_window: 7,
      shopify_integration: false
    }
  },
  {
    type: 'ugc_collection' as const,
    name: 'UGC Collection',
    description: 'Collect user-generated content',
    icon: Camera,
    color: 'from-pink-500 to-pink-600',
    config: {
      hashtags: [],
      mentions: true,
      quality_threshold: 0.7
    }
  },
  {
    type: 'customer_service' as const,
    name: 'Customer Service',
    description: 'AI-powered customer support',
    icon: Activity,
    color: 'from-yellow-500 to-yellow-600',
    config: {
      ai_enabled: true,
      business_hours: '9-5',
      escalation_rules: []
    }
  }
];

export const WorkflowManager: React.FC = () => {
  const { workflows, loading, refetch } = useRealtimeWorkflows();
  const { user } = useAuthStore();
  const [creating, setCreating] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Memoized filtered workflows
  const filteredWorkflows = useMemo(() => {
    if (!searchTerm) return workflows;
    
    const term = searchTerm.toLowerCase();
    return workflows.filter(w => 
      w.name.toLowerCase().includes(term) ||
      w.automation_type.toLowerCase().includes(term)
    );
  }, [workflows, searchTerm]);
  
  const createWorkflow = useCallback(async (template: typeof WORKFLOW_TEMPLATES[0]) => {
    if (!user) {
      toast.error('Please login to create workflows');
      return;
    }
    
    setCreating(true);
    try {
      const result = await DatabaseService.createWorkflow({
        user_id: user.id,
        name: template.name,
        automation_type: template.type,
        configuration: template.config
      });
      
      if (result.success) {
        await refetch();
      }
    } finally {
      setCreating(false);
    }
  }, [user, refetch]);
  
  const toggleWorkflow = useCallback(async (workflowId: string, currentStatus: string) => {
    if (!user) return;
    
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const result = await DatabaseService.updateWorkflowStatus(workflowId, newStatus, user.id);
    
    if (result.success) {
      await refetch();
    }
  }, [user, refetch]);
  
  const deleteWorkflow = useCallback(async (workflowId: string) => {
    if (!user || !confirm('Are you sure you want to delete this workflow?')) return;
    
    const result = await DatabaseService.deleteWorkflow(workflowId, user.id);
    
    if (result.success) {
      setSelectedWorkflow(null);
      await refetch();
    }
  }, [user, refetch]);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-morphism-card p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Automation Workflows</h2>
            <p className="text-gray-400 mt-1">Create and manage your Instagram automations</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-400">
              {workflows.length} workflows
            </span>
          </div>
        </div>
      </div>
      
      {/* Templates Grid */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Create New Workflow</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {WORKFLOW_TEMPLATES.map(template => {
            const Icon = template.icon;
            return (
              <button
                key={template.type}
                onClick={() => !creating && createWorkflow(template)}
                disabled={creating}
                className="glass-morphism-card p-4 rounded-xl border border-gray-700 hover:border-indigo-500 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${template.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">{template.name}</h4>
                <p className="text-xs text-gray-400 line-clamp-2">{template.description}</p>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Active Workflows */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          Active Workflows ({filteredWorkflows.length})
        </h3>
        
        {filteredWorkflows.length === 0 ? (
          <div className="glass-morphism-card p-8 rounded-2xl text-center">
            <Zap className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-400">
              {searchTerm ? 'No workflows found matching your search' : 'No workflows created yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredWorkflows.map(workflow => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onToggle={() => toggleWorkflow(workflow.id, workflow.status)}
                onDelete={() => deleteWorkflow(workflow.id)}
                onSelect={() => setSelectedWorkflow(workflow.id)}
                isSelected={selectedWorkflow === workflow.id}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Workflow Executions Panel */}
      {selectedWorkflow && (
        <WorkflowExecutions 
          workflowId={selectedWorkflow}
          onClose={() => setSelectedWorkflow(null)}
        />
      )}
    </div>
  );
};

// Optimized Workflow Card
const WorkflowCard: React.FC<{
  workflow: any;
  onToggle: () => void;
  onDelete: () => void;
  onSelect: () => void;
  isSelected: boolean;
}> = React.memo(({ workflow, onToggle, onDelete, onSelect, isSelected }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/20 border-green-400/30';
      case 'inactive': return 'text-gray-400 bg-gray-400/20 border-gray-400/30';
      case 'error': return 'text-red-400 bg-red-400/20 border-red-400/30';
      default: return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30';
    }
  };
  
  const template = WORKFLOW_TEMPLATES.find(t => t.type === workflow.automation_type);
  const Icon = template?.icon || Activity;
  
  return (
    <div className={`glass-morphism-card p-5 rounded-xl border transition-all ${
      isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-700'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${template?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="text-white font-semibold">{workflow.name}</h4>
            <p className="text-gray-400 text-sm mt-1">
              Type: {workflow.automation_type.replace('_', ' ')}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>Executions: {workflow.total_executions || 0}</span>
              <span>Success: {workflow.successful_executions || 0}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(workflow.status)}`}>
            {workflow.status}
          </span>
          
          <button
            onClick={onToggle}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title={workflow.status === 'active' ? 'Pause' : 'Activate'}
          >
            {workflow.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
          </button>
          
          <button
            onClick={onSelect}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="View Executions"
          >
            <Clock size={16} />
          </button>
          
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});

// Optimized Executions Component
const WorkflowExecutions: React.FC<{ 
  workflowId: string;
  onClose: () => void;
}> = React.memo(({ workflowId, onClose }) => {
  const { executions, loading, hasMore, loadMore } = useRealtimeExecutions(workflowId);
  
  return (
    <div className="glass-morphism-card p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Recent Executions</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
      
      {loading && executions.length === 0 ? (
        <div className="text-gray-400 text-center py-4">Loading executions...</div>
      ) : executions.length === 0 ? (
        <div className="text-gray-400 text-center py-4">No executions yet</div>
      ) : (
        <>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {executions.map(execution => (
              <div key={execution.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center space-x-3">
                  {execution.status === 'success' ? (
                    <CheckCircle className="text-green-400" size={16} />
                  ) : execution.status === 'error' ? (
                    <XCircle className="text-red-400" size={16} />
                  ) : (
                    <Clock className="text-yellow-400 animate-spin" size={16} />
                  )}
                  <div>
                    <p className="text-sm text-white">
                      {new Date(execution.started_at).toLocaleString()}
                    </p>
                    {execution.execution_time_ms && (
                      <p className="text-xs text-gray-400">
                        Duration: {execution.execution_time_ms}ms
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {execution.trigger_source || 'Manual'}
                </span>
              </div>
            ))}
          </div>
          
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="w-full mt-4 py-2 text-indigo-400 hover:text-indigo-300 transition-colors text-sm"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          )}
        </>
      )}
    </div>
  );
});