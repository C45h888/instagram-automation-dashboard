import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useAgentHealth } from '../../hooks/useAgentHealth';
import { useInstagramAccount } from '../../hooks/useInstagramAccount';
import { useToastContext } from '../../contexts/ToastContext';
import type { SystemAlert } from '@/types';
import type { Toast } from '../../contexts/ToastContext';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert type → color config
// ─────────────────────────────────────────────────────────────────────────────

const ALERT_COLORS: Record<string, { dot: string; text: string }> = {
  auth_failure:      { dot: 'bg-red-400',    text: 'text-red-400' },
  rate_limit:        { dot: 'bg-yellow-400', text: 'text-yellow-400' },
  content_violation: { dot: 'bg-orange-400', text: 'text-orange-400' },
  agent_down:        { dot: 'bg-red-500',    text: 'text-red-400' },
  sync_failure:      { dot: 'bg-blue-400',   text: 'text-blue-400' },
};

function alertColor(type: string) {
  return ALERT_COLORS[type] ?? { dot: 'bg-gray-400', text: 'text-gray-400' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast history icon
// ─────────────────────────────────────────────────────────────────────────────

function ToastIcon({ type }: { type: Toast['type'] }) {
  switch (type) {
    case 'success': return <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />;
    case 'error':   return <XCircle     className="w-4 h-4 text-red-400 flex-shrink-0" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
    case 'info':    return <Info        className="w-4 h-4 text-blue-400 flex-shrink-0" />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SystemAlertRow
// ─────────────────────────────────────────────────────────────────────────────

interface AlertRowProps {
  alert: SystemAlert;
  onResolve: (id: string) => void;
}

const SystemAlertRow: React.FC<AlertRowProps> = ({ alert, onResolve }) => {
  const { dot, text } = alertColor(alert.alert_type ?? '');
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors group">
      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${text} truncate`}>
          {alert.alert_type?.replace(/_/g, ' ')}
        </p>
        <p className="text-xs text-gray-400 truncate">{alert.message}</p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[10px] text-gray-600">
          {alert.created_at ? relativeTime(alert.created_at) : ''}
        </span>
        <button
          onClick={() => onResolve(alert.id)}
          className="text-[10px] text-gray-500 hover:text-yellow-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          Resolve
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const NotificationDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const { businessAccountId } = useInstagramAccount();
  const { alerts, isLoading, resolveAlert } = useAgentHealth(businessAccountId);
  const { history, clearHistory } = useToastContext();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const unreadCount = alerts.length;

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`relative p-2 rounded-lg transition-colors ${
          open
            ? 'text-yellow-400 bg-yellow-500/10'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-50 animate-slideDown">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-gray-500 hover:text-white transition-colors"
              >
                Clear history
              </button>
            )}
          </div>

          {/* Section 1 — System Alerts */}
          <div>
            <p className="px-3 pt-2.5 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              System Alerts
            </p>

            {isLoading ? (
              <div className="px-3 py-2 space-y-2">
                {[0, 1].map(i => (
                  <div key={i} className="flex gap-2.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-gray-700 animate-pulse" />
                    <div className="h-3 bg-gray-700 rounded animate-pulse flex-1" />
                  </div>
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-600">No active alerts</p>
            ) : (
              alerts.map(alert => (
                <SystemAlertRow
                  key={alert.id}
                  alert={alert}
                  onResolve={resolveAlert}
                />
              ))
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-gray-700/60 mt-1" />

          {/* Section 2 — Recent Notifications */}
          <div>
            <p className="px-3 pt-2.5 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Recent
            </p>

            {history.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-600">No recent notifications</p>
            ) : (
              history.map(item => (
                <div key={item.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors">
                  <ToastIcon type={item.type} />
                  <div className="flex-1 min-w-0">
                    {item.title && (
                      <p className="text-xs font-medium text-white">{item.title}</p>
                    )}
                    <p className="text-xs text-gray-400 truncate">{item.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {history.length > 0 && (
            <div className="border-t border-gray-700/60 px-3 py-2">
              <button
                onClick={clearHistory}
                className="w-full text-xs text-gray-500 hover:text-white transition-colors text-center"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="h-1" />
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
