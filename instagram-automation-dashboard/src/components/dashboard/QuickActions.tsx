import React from 'react';
import { Plus, Calendar, BarChart3, Settings } from 'lucide-react';

const QuickActions: React.FC = () => {
  const actions = [
    {
      label: 'Create Post',
      icon: <Plus className="w-5 h-5" />,
      onClick: () => console.log('Create Post'),
      gradient: 'from-blue-500 to-purple-600'
    },
    {
      label: 'Schedule Content',
      icon: <Calendar className="w-5 h-5" />,
      onClick: () => console.log('Schedule Content'),
      gradient: 'from-green-500 to-teal-600'
    },
    {
      label: 'View Analytics',
      icon: <BarChart3 className="w-5 h-5" />,
      onClick: () => console.log('View Analytics'),
      gradient: 'from-orange-500 to-red-600'
    },
    {
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      onClick: () => console.log('Settings'),
      gradient: 'from-gray-500 to-gray-700'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          className={`p-4 rounded-xl bg-gradient-to-r ${action.gradient} hover:scale-105 transition-transform duration-200 text-white font-medium flex items-center space-x-3`}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;