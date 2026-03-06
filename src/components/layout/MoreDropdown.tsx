import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronDown, BarChart3, Activity,
  Target, Users, Settings, Shield, Terminal
} from 'lucide-react';

interface DropdownItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface DropdownGroup {
  heading: string;
  items: DropdownItem[];
}

const GROUPS: DropdownGroup[] = [
  {
    heading: 'Insights',          // ← was 'Analytics', renamed to avoid confusion with main nav item
    items: [
      { label: 'Content Analytics',  path: '/content/analytics',          icon: <BarChart3 className="w-4 h-4" /> },
      { label: 'Engagement Monitor', path: '/engagement-monitor',         icon: <Activity  className="w-4 h-4" /> },
    ],
  },
  {
    heading: 'Management',
    items: [
      { label: 'Campaigns', path: '/campaigns', icon: <Target className="w-4 h-4" /> },
      { label: 'Audience',  path: '/audience',  icon: <Users  className="w-4 h-4" /> },
    ],
  },
  {
    heading: 'Account',
    items: [
      { label: 'Settings',         path: '/settings',                   icon: <Settings className="w-4 h-4" /> },
      { label: 'Privacy Controls', path: '/dashboard/privacy-controls', icon: <Shield   className="w-4 h-4" /> },
      { label: 'Agent Terminal',   path: '/agent-terminal',             icon: <Terminal className="w-4 h-4" /> },
    ],
  },
];

const DROPDOWN_PATHS = GROUPS.flatMap(g => g.items.map(i => i.path));

const MoreDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

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

  // Close when route changes (user selected an item)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Highlight trigger button yellow when current route is inside the dropdown
  const isAnyActive = DROPDOWN_PATHS.some(p =>
    location.pathname === p || location.pathname.startsWith(p + '/')
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`relative px-3 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all duration-200 ${
          isAnyActive || open
            ? 'text-yellow-400 bg-yellow-500/10'
            : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}
      >
        More
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-50 animate-slideDown">
          {GROUPS.map((group, gi) => (
            <div key={group.heading}>
              {gi > 0 && <div className="border-t border-gray-700/60" />}
              <p className="px-3 pt-2.5 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {group.heading}
              </p>
              {group.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'text-yellow-400 bg-yellow-500/10'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
              {gi === GROUPS.length - 1 && <div className="h-1" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoreDropdown;
