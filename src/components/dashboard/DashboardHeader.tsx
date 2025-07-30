import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Calendar, TrendingUp, Users, DollarSign } from 'lucide-react';

const DashboardHeader: React.FC = () => {
  const { user } = useAuthStore();

  const quickStats = [
    { label: 'Active Campaigns', value: '8', icon: TrendingUp, color: 'text-green-400' },
    { label: 'Scheduled Posts', value: '24', icon: Calendar, color: 'text-blue-400' },
    { label: 'New Followers', value: '+127', icon: Users, color: 'text-purple-400' },
    { label: 'Revenue Today', value: '$340', icon: DollarSign, color: 'text-yellow-400' }
  ];

  return (
    <div className="glass-morphism-card p-6 rounded-2xl mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        {/* Welcome Section */}
        <div className="mb-6 lg:mb-0">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user?.username || 'User'}! 👋
          </h1>
          <p className="text-gray-300 text-lg">
            Here's what's happening with your Instagram automation today.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {quickStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Icon className={`w-5 h-5 ${stat.color} mr-2`} />
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                </div>
                <p className="text-gray-400 text-sm">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;