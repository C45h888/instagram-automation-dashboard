import React from 'react';
import { Plus, Calendar, BarChart3, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Create Post',
      icon: <Plus className="w-5 h-5" />,
      onClick: () => navigate('/content'),
      gradient: 'from-blue-500 to-purple-600',
      description: 'Create new content'
    },
    {
      label: 'Schedule Content',
      icon: <Calendar className="w-5 h-5" />,
      onClick: () => navigate('/content'),
      gradient: 'from-green-500 to-teal-600',
      description: 'Plan your posts'
    },
    {
      label: 'View Analytics',
      icon: <BarChart3 className="w-5 h-5" />,
      onClick: () => navigate('/analytics'),
      gradient: 'from-orange-500 to-red-600',
      description: 'Track performance'
    },
    {
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      onClick: () => navigate('/settings'),
      gradient: 'from-gray-500 to-gray-700',
      description: 'Configure automation'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          className={`group p-6 rounded-xl bg-gradient-to-r ${action.gradient} hover:scale-105 transition-all duration-300 text-white font-medium shadow-lg hover:shadow-xl`}
        >
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="p-2 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors">
              {action.icon}
            </div>
            <div>
              <div className="font-semibold">{action.label}</div>
              <div className="text-xs opacity-80">{action.description}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;