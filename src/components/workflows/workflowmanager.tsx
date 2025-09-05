import React, { useState } from 'react';
import { DatabaseService } from '../../services/databaseservices';
import { useRealtimeWorkflows, useRealtimeExecutions } from '../../hooks/realtimedata';
import { useAuthStore } from '../../stores/authStore';
import { Play, Pause, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';

// ✅ IMPORT OFFICIAL TYPES FROM SUPABASE
import type { Database } from '../../lib/supabase';

// ✅ USE DATABASE TYPE ALIASES - These are the official types from database.types.ts
type AutomationWorkflow = Database['public']['Tables']['automation_workflows']['Row'];
type WorkflowExecution = Database['public']['Tables']['workflow_executions']['Row'];

// Note: If these exact table names don't match your database.types.ts, 
// you may need to adjust them to match your actual schema

export const WorkflowManager: React.FC = () => {
  const { workflows, loading } = useRealtimeWorkflows();
  const { user } = useAuthStore();
  const [creating, setCreating] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  
  const workflowTemplates = [
    {
      type: 'engagement_monitor' as const,
      name: 'Engagement Monitor',
      description: 'Track and analyze engagement metrics',
      icon: '📊',
      config: {
        monitor_comments: true,
        monitor_likes: true,
        monitor_shares: true,
        alert_threshold: 100
      }
    },
    {
      type: 'analytics_pipeline' as const,
      name: 'Analytics Pipeline',
      description: 'Process and store Instagram analytics',
      icon: '📈',
      config: {
        sync_interval: 3600,
        include_stories: true,
        include_reels: true
      }
    },
    {
      type: 'sales_attribution' as const,
      name: 'Sales Attribution',
      description: 'Track Instagram-driven sales',
      icon: '💰',
      config: {
        tracking_params: ['utm_source', 'utm_campaign'],
        conversion_window: 7
      }
    },
    {
      type: 'ugc_collection' as const,
      name: 'UGC Collection',
      description: 'Collect user-generated content',
      icon: '📸',
      config: {
        hashtags: ['#yourbrand'],
        auto_request_rights: false
      }
    },
    {
      type: 'customer_service' as const,
      name: 'Customer Service',
      description: 'Automated customer support',
      icon: '💬',
      config: {
        response_time: 30,
        ai_enabled: false,
        escalation_rules: []
      }
    }
  ];
  
  const createWorkflow = async (template: typeof workflowTemplates[0]) => {
    if (!user) return;
    
    setCreating(true);
    
    try {
      const result = await DatabaseService.createWorkflow({
        user_id: user.id,
        name: template.name,
        description: template.description,
        automation_type: template.type,
        status: 'inactive',
        is_active: false,
        configuration: template.config,
        n8n_workflow_id: `n8n_${template.type}_${Date.now()}`,
        n8n_webhook_url: `${import.meta.env.VITE_N8N_BASE_URL}/webhook/${template.type}`
      });
      
      if (result.success) {
        console.log(`✅ Workflow "${template.name}" created!`);
      }
    } catch (error) {
      console.error('Workflow creation error:', error);
    } finally {
      setCreating(false);
    }
  };
  
  // ✅ FIXED: Now accepts nullable status
  const toggleWorkflow = async (workflowId: string, currentStatus: string | null) => {
    const newStatus = (currentStatus || 'inactive') === 'active' ? 'inactive' : 'active';
    await DatabaseService.updateWorkflowStatus(workflowId, newStatus as any);
  };
  
  const deleteWorkflow = async (workflowId: string) => {
    if (!user || !confirm('Are you sure you want to delete this workflow?')) return;
    await DatabaseService.deleteWorkflow(workflowId, user.id);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Automation Workflows</h2>
        <p className="text-gray-400">Create and manage your Instagram automation workflows</p>
      </div>
      
      {/* Workflow Templates */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Create New Workflow</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflowTemplates.map(template => (
            <div
              key={template.type}
              className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 hover:border-indigo-500 transition-all cursor-pointer"
              onClick={() => !creating && createWorkflow(template)}
            >
              <div className="text-3xl mb-3">{template.icon}</div>
              <h4 className="text-lg font-semibold text-white mb-2">{template.name}</h4>
              <p className="text-gray-400 text-sm mb-4">{template.description}</p>
              <button
                disabled={creating}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating...' : 'Create Workflow'}
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Active Workflows */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Active Workflows ({workflows.length})</h3>
        
        {workflows.length === 0 ? (
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 border border-gray-700 text-center">
            <p className="text-gray-400">No workflows created yet. Create your first workflow above!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map((workflow: AutomationWorkflow) => (
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
      
      {/* Workflow Executions */}
      {selectedWorkflow && (
        <WorkflowExecutions workflowId={selectedWorkflow} />
      )}
    </div>
  );
};

// Workflow Card Component
const WorkflowCard: React.FC<{
  workflow: AutomationWorkflow;
  onToggle: () => void;
  onDelete: () => void;
  onSelect: () => void;
  isSelected: boolean;
}> = ({ workflow, onToggle, onDelete, onSelect, isSelected }) => {
  // ✅ FIXED: Now accepts and handles null status
  const getStatusColor = (status: string | null) => {
    // Handle null case explicitly for pending/unset state
    if (status === null) {
      return 'text-yellow-400 bg-yellow-400/20';
    }
    
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/20';
      case 'inactive': return 'text-gray-400 bg-gray-400/20';
      case 'error': return 'text-red-400 bg-red-400/20';
      case 'pending': return 'text-yellow-400 bg-yellow-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };
  
  const getWorkflowIcon = (type: string) => {
    const icons: any = {
      engagement_monitor: '📊',
      analytics_pipeline: '📈',
      sales_attribution: '💰',
      ugc_collection: '📸',
      customer_service: '💬'
    };
    return icons[type] || '⚙️';
  };
  
  return (
    <div
      className={`bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border transition-all ${
        isSelected ? 'border-indigo-500' : 'border-gray-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-2xl">{getWorkflowIcon(workflow.automation_type)}</div>
          <div>
            <h4 className="text-lg font-semibold text-white">{workflow.name}</h4>
            <p className="text-gray-400 text-sm">Type: {workflow.automation_type}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* ✅ FIXED: Using Solution Pattern A - Provide fallback at call site */}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(workflow.status)}`}>
            {(workflow.status || 'inactive').toUpperCase()}
          </span>
          
          <button
            onClick={onToggle}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title={workflow.status === 'active' ? 'Pause' : 'Activate'}
          >
            {workflow.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
          </button>
          
          <button
            onClick={onSelect}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="View Executions"
          >
            <Clock size={18} />
          </button>
          
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      {/* Workflow Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-gray-400 text-xs">Total Runs</p>
          <p className="text-white font-semibold">{workflow.total_executions || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-xs">Success Rate</p>
          <p className="text-white font-semibold">
            {workflow.total_executions && workflow.successful_executions
              ? Math.round((workflow.successful_executions / workflow.total_executions) * 100) 
              : 0}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-xs">Last Run</p>
          <p className="text-white font-semibold">
            {workflow.last_execution_at 
              ? new Date(workflow.last_execution_at).toLocaleDateString() 
              : 'Never'}
          </p>
        </div>
      </div>
    </div>
  );
};

// Workflow Executions Component
const WorkflowExecutions: React.FC<{ workflowId: string }> = ({ workflowId }) => {
  const { executions, loading } = useRealtimeExecutions(workflowId);
  
  if (loading) {
    return <div className="text-gray-400 text-center py-4">Loading executions...</div>;
  }
  
  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-white mb-4">Recent Executions</h3>
      
      {executions.length === 0 ? (
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 text-center">
          <p className="text-gray-400">No executions yet</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Trigger
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {executions.map((execution: WorkflowExecution) => (
                <tr key={execution.id}>
                  <td className="px-4 py-3">
                    {execution.status === 'success' ? (
                      <CheckCircle className="text-green-400" size={16} />
                    ) : execution.status === 'error' ? (
                      <XCircle className="text-red-400" size={16} />
                    ) : (
                      <Clock className="text-yellow-400 animate-spin" size={16} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {/* ✅ Already handles null correctly */}
                    {execution.started_at 
                      ? new Date(execution.started_at).toLocaleString()
                      : 'Not started'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {execution.execution_time_ms
                      ? `${execution.execution_time_ms}ms`
                      : 'Running...'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {execution.trigger_source || 'Manual'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WorkflowManager;