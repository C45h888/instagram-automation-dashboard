import React, { useState } from 'react';
import { 
  Users, Heart, MessageCircle, Eye, Filter, Download,
  ChevronUp, ChevronDown, MoreVertical
} from 'lucide-react';

// Type definitions
interface Metric {
  label: string;
  value: string | number;
  change: number;
  changeLabel: string;
  icon: React.ReactNode;
  color: string;
}

interface PostPerformance {
  id: string;
  thumbnail: string;
  title: string;
  posted: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  engagement: number;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

const Analytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'audience' | 'competitors'>('overview');
  const [dateRange, setDateRange] = useState('last30days');
  const [selectedMetric, setSelectedMetric] = useState<'engagement' | 'reach' | 'followers'>('engagement');

  // Mock metrics data
  const metrics: Metric[] = [
    {
      label: 'Total Followers',
      value: '24.5K',
      change: 12.5,
      changeLabel: 'vs last month',
      icon: <Users className="w-5 h-5" />,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      label: 'Engagement Rate',
      value: '4.8%',
      change: 8.3,
      changeLabel: 'vs last month',
      icon: <Heart className="w-5 h-5" />,
      color: 'from-pink-500 to-rose-500'
    },
    {
      label: 'Avg. Reach',
      value: '45.2K',
      change: -3.2,
      changeLabel: 'vs last month',
      icon: <Eye className="w-5 h-5" />,
      color: 'from-purple-500 to-indigo-500'
    },
    {
      label: 'Total Interactions',
      value: '128.4K',
      change: 15.7,
      changeLabel: 'vs last month',
      icon: <MessageCircle className="w-5 h-5" />,
      color: 'from-green-500 to-emerald-500'
    }
  ];

  // Mock post performance data
  const topPosts: PostPerformance[] = [
    {
      id: '1',
      thumbnail: '🖼️',
      title: 'Summer Collection Launch',
      posted: '3 days ago',
      likes: 3421,
      comments: 234,
      shares: 89,
      saves: 456,
      reach: 45231,
      engagement: 8.2
    },
    {
      id: '2',
      thumbnail: '📸',
      title: 'Behind the Scenes',
      posted: '1 week ago',
      likes: 2890,
      comments: 178,
      shares: 67,
      saves: 234,
      reach: 38900,
      engagement: 7.1
    },
    {
      id: '3',
      thumbnail: '🎥',
      title: 'Product Tutorial',
      posted: '2 weeks ago',
      likes: 4567,
      comments: 345,
      shares: 123,
      saves: 678,
      reach: 52100,
      engagement: 9.8
    }
  ];

  // Mock chart data
  const chartData: ChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Engagement',
        data: [3200, 3800, 3500, 4200, 4800, 5200, 4900],
        color: '#facc15'
      },
      {
        label: 'Reach',
        data: [28000, 32000, 30000, 35000, 38000, 42000, 40000],
        color: '#3b82f6'
      }
    ]
  };

  // Audience demographics data
  const audienceData = {
    ageGroups: [
      { range: '13-17', percentage: 8 },
      { range: '18-24', percentage: 32 },
      { range: '25-34', percentage: 35 },
      { range: '35-44', percentage: 18 },
      { range: '45+', percentage: 7 }
    ],
    topLocations: [
      { city: 'New York', percentage: 18 },
      { city: 'Los Angeles', percentage: 15 },
      { city: 'London', percentage: 12 },
      { city: 'Paris', percentage: 10 },
      { city: 'Tokyo', percentage: 8 }
    ],
    gender: {
      female: 62,
      male: 35,
      other: 3
    }
  };

  const SimpleLineChart: React.FC<{ data: ChartData }> = ({ data }) => {
    const maxValue = Math.max(...data.datasets.flatMap(d => d.data));
    
    return (
      <div className="relative h-[300px] w-full">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-400">
          <span>{(maxValue / 1000).toFixed(0)}k</span>
          <span>{(maxValue / 2000).toFixed(0)}k</span>
          <span>0</span>
        </div>
        
        {/* Chart area */}
        <div className="ml-14 h-full relative">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {data.datasets.map((dataset, idx) => {
              const points = dataset.data.map((value, index) => {
                const x = (index / (data.labels.length - 1)) * 100;
                const y = 100 - (value / maxValue) * 100;
                return `${x},${y}`;
              });
              
              return (
                <polyline
                  key={idx}
                  points={points.join(' ')}
                  fill="none"
                  stroke={dataset.color}
                  strokeWidth="2"
                  className="opacity-70"
                />
              );
            })}
          </svg>
          
          {/* X-axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-400 mt-2">
            {data.labels.map((label, idx) => (
              <span key={idx}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Analytics Dashboard</h1>
          <p className="text-gray-300 text-lg">Track your Instagram performance and growth</p>
        </div>
        
        {/* Date Range Selector */}
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-yellow-500/50 outline-none"
          >
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="last90days">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
          <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:bg-gray-800/70 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-3 rounded-lg bg-gradient-to-r ${metric.color} bg-opacity-20`}>
                {metric.icon}
              </div>
              <button className="text-gray-400 hover:text-white">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{metric.value}</div>
            <div className="text-sm text-gray-400 mb-2">{metric.label}</div>
            <div className="flex items-center gap-2">
              {metric.change > 0 ? (
                <ChevronUp className="w-4 h-4 text-green-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm ${metric.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Math.abs(metric.change)}%
              </span>
              <span className="text-xs text-gray-500">{metric.changeLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 pb-4">
        {(['overview', 'posts', 'audience', 'competitors'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart */}
          <div className="lg:col-span-2 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Performance Trend</h3>
              <div className="flex gap-2">
                {(['engagement', 'reach', 'followers'] as const).map(metric => (
                  <button
                    key={metric}
                    onClick={() => setSelectedMetric(metric)}
                    className={`px-3 py-1 rounded-lg text-sm capitalize transition-all ${
                      selectedMetric === metric
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {metric}
                  </button>
                ))}
              </div>
            </div>
            <SimpleLineChart data={chartData} />
          </div>

          {/* Best Performing Content */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Top Content</h3>
            <div className="space-y-4">
              {topPosts.slice(0, 3).map(post => (
                <div key={post.id} className="flex items-center gap-3">
                  <div className="text-3xl">{post.thumbnail}</div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{post.title}</p>
                    <p className="text-gray-400 text-xs">{post.posted}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">{post.engagement}%</p>
                    <p className="text-gray-400 text-xs">engagement</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'posts' && (
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-white">Post Performance</h3>
              <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Post
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Likes
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Comments
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Shares
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Saves
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Reach
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Engagement
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {topPosts.map(post => (
                  <tr key={post.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{post.thumbnail}</div>
                        <div>
                          <p className="text-white font-medium">{post.title}</p>
                          <p className="text-gray-400 text-sm">{post.posted}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-white">
                      {post.likes.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center text-white">
                      {post.comments}
                    </td>
                    <td className="px-6 py-4 text-center text-white">
                      {post.shares}
                    </td>
                    <td className="px-6 py-4 text-center text-white">
                      {post.saves}
                    </td>
                    <td className="px-6 py-4 text-center text-white">
                      {(post.reach / 1000).toFixed(1)}K
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                        {post.engagement}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audience' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Age Distribution */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Age Groups</h3>
            <div className="space-y-3">
              {audienceData.ageGroups.map(group => (
                <div key={group.range}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{group.range}</span>
                    <span className="text-white font-medium">{group.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-2 rounded-full"
                      style={{ width: `${group.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Locations */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Top Locations</h3>
            <div className="space-y-3">
              {audienceData.topLocations.map((location, idx) => (
                <div key={location.city} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-600">#{idx + 1}</span>
                    <span className="text-gray-300">{location.city}</span>
                  </div>
                  <span className="text-white font-medium">{location.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gender Split */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Gender Distribution</h3>
            <div className="flex justify-center items-center h-48">
              <div className="relative w-40 h-40">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="#374151"
                    strokeWidth="10"
                    fill="none"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="#ec4899"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 70 * audienceData.gender.female / 100} ${2 * Math.PI * 70}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white">{audienceData.gender.female}%</span>
                  <span className="text-sm text-gray-400">Female</span>
                </div>
              </div>
            </div>
            <div className="flex justify-around mt-4">
              <div className="text-center">
                <p className="text-blue-400 font-semibold">{audienceData.gender.male}%</p>
                <p className="text-gray-400 text-sm">Male</p>
              </div>
              <div className="text-center">
                <p className="text-purple-400 font-semibold">{audienceData.gender.other}%</p>
                <p className="text-gray-400 text-sm">Other</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'competitors' && (
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-2xl font-semibold text-white mb-2">Competitor Analysis Coming Soon</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Track your performance against competitors and industry benchmarks. This feature will be available in the next update.
            </p>
            <button className="mt-6 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-all">
              Get Notified
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;