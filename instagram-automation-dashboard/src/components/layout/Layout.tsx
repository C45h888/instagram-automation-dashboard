import React from 'react';
import { Outlet } from 'react-router-dom';

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: '🏠' },
  { name: 'Content', href: '/content', icon: '📅' },
  { name: 'Engagement', href: '/engagement', icon: '💬' },
  { name: 'Analytics', href: '/analytics', icon: '📊' },
  { name: 'UGC', href: '/ugc', icon: '👥' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between h-20">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
              <div className="w-6 h-6 bg-white/20 rounded-lg backdrop-blur-sm"></div>
            </div>
            <span className="text-white font-semibold text-xl tracking-tight">AutomationPro</span>
          </div>
          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-2">
            {navigationItems.map((item) => (
              <a key={item.name} href={item.href} className="text-gray-300 hover:text-white px-4 py-2 rounded transition-all duration-300 font-medium flex items-center">
                <span className="mr-2">{item.icon}</span>
                {item.name}
              </a>
            ))}
          </nav>
          {/* Search and User */}
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search..."
              className="hidden lg:block pl-12 w-80 bg-gray-800/50 text-white placeholder:text-gray-400 border border-gray-600 rounded-md py-2 focus:border-yellow-500/50 outline-none"
            />
            <button className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-500 via-yellow-400 to-yellow-300 border-2 border-white/30 flex items-center justify-center shadow">
              <span className="text-white font-bold">U</span>
            </button>
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-8 py-12">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout; 