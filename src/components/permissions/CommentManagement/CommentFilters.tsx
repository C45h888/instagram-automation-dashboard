// =====================================
// COMMENT FILTERS COMPONENT
// Filter comments by sentiment, priority, status, and search
// Provides comprehensive filtering interface
// =====================================

import React from 'react';
import { Search, Filter, X } from 'lucide-react';

export interface CommentFilterState {
  sentiment: 'all' | 'positive' | 'neutral' | 'negative';
  priority: 'all' | 'low' | 'medium' | 'high' | 'urgent';
  status: 'all' | 'automated' | 'manual' | 'requires_response';
  search: string;
}

interface CommentFiltersProps {
  filters: CommentFilterState;
  onChange: (filters: CommentFilterState) => void;
  totalCount: number;
  filteredCount: number;
  className?: string;
}

export const CommentFilters: React.FC<CommentFiltersProps> = ({
  filters,
  onChange,
  totalCount,
  filteredCount,
  className = ''
}) => {
  const hasActiveFilters =
    filters.sentiment !== 'all' ||
    filters.priority !== 'all' ||
    filters.status !== 'all' ||
    filters.search !== '';

  const clearFilters = () => {
    onChange({
      sentiment: 'all',
      priority: 'all',
      status: 'all',
      search: ''
    });
  };

  return (
    <div className={`glass-morphism-card p-4 rounded-xl border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-purple-400" />
          <h3 className="text-white font-semibold">Filters</h3>
          <span className="text-xs text-gray-400">
            ({filteredCount} of {totalCount} comments)
          </span>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center space-x-1"
          >
            <X className="w-3 h-3" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search comments..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Sentiment Filter */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 font-medium">Sentiment</label>
          <select
            value={filters.sentiment}
            onChange={(e) =>
              onChange({
                ...filters,
                sentiment: e.target.value as CommentFilterState['sentiment']
              })
            }
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 font-medium">Priority</label>
          <select
            value={filters.priority}
            onChange={(e) =>
              onChange({
                ...filters,
                priority: e.target.value as CommentFilterState['priority']
              })
            }
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 font-medium">Status</label>
          <select
            value={filters.status}
            onChange={(e) =>
              onChange({
                ...filters,
                status: e.target.value as CommentFilterState['status']
              })
            }
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">All Statuses</option>
            <option value="automated">Automated</option>
            <option value="manual">Manual</option>
            <option value="requires_response">Requires Response</option>
          </select>
        </div>
      </div>

      {/* Active Filter Pills */}
      {hasActiveFilters && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex flex-wrap gap-2">
            {filters.sentiment !== 'all' && (
              <span className="inline-flex items-center space-x-1 px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                <span>Sentiment: {filters.sentiment}</span>
                <button
                  onClick={() => onChange({ ...filters, sentiment: 'all' })}
                  className="hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.priority !== 'all' && (
              <span className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                <span>Priority: {filters.priority}</span>
                <button
                  onClick={() => onChange({ ...filters, priority: 'all' })}
                  className="hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.status !== 'all' && (
              <span className="inline-flex items-center space-x-1 px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                <span>Status: {filters.status.replace('_', ' ')}</span>
                <button
                  onClick={() => onChange({ ...filters, status: 'all' })}
                  className="hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.search && (
              <span className="inline-flex items-center space-x-1 px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">
                <span>Search: "{filters.search}"</span>
                <button
                  onClick={() => onChange({ ...filters, search: '' })}
                  className="hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentFilters;
