// src/components/layout/Layout.tsx
// VIEWPORT OPTIMIZED VERSION - Maximizes above-the-fold content visibility
import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import LegalFooter from '../layout/LegalFooter';
import {
  Home, Calendar, MessageCircle, BarChart3, Settings,
  Users, Bot, Target, Search, Bell, Menu, X, LogOut,
  ChevronDown, Plus, Star, Terminal
} from 'lucide-react';

interface NavigationItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
  subItems?: { name: string; path: string }[];
}

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navigationItems: NavigationItem[] = [
    { name: 'Dashboard', path: '/', icon: <Home className="w-5 h-5" /> },
    {
      name: 'Content',
      path: '/content',
      icon: <Calendar className="w-5 h-5" />,
      subItems: [
        { name: 'Create Post', path: '/content/create' },
        { name: 'Schedule', path: '/content' },
      ]
    },
    { name: 'Engagement', path: '/engagement', icon: <MessageCircle className="w-5 h-5" />, badge: 3 },
    { name: 'UGC', path: '/ugc', icon: <Star className="w-5 h-5" /> },
    { name: 'Analytics', path: '/analytics', icon: <BarChart3 className="w-5 h-5" /> },
    { name: 'Automations', path: '/automations', icon: <Bot className="w-5 h-5" /> },
    { name: 'Campaigns', path: '/campaigns', icon: <Target className="w-5 h-5" /> },
    { name: 'Audience', path: '/audience', icon: <Users className="w-5 h-5" /> },
    { name: 'Terminal', path: '/agent-terminal', icon: <Terminal className="w-5 h-5" /> },
    { name: 'Settings', path: '/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Searching for:', searchQuery);
  };

  const handleLogout = () => {
    navigate('/login');
  };

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    // Natural document scroll - allows content to grow beyond viewport
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col">

      {/* Header - ~80px height (scrolls naturally with content) */}
      <header className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Logo/Brand */}
            <div className="flex items-center space-x-4">
              <NavLink to="/" className="flex items-center space-x-3 group">
                <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-all duration-200">
                  <span className="text-white font-bold text-lg">8</span>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-white text-xl font-bold">888 Intelligence</h1>
                  <p className="text-gray-400 text-xs">Automation Platform</p>
                </div>
              </NavLink>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navigationItems.slice(0, 5).map((item) => (
                <div key={item.name} className="relative group">
                  <NavLink
                    to={item.path}
                    className={`relative px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-all duration-200 ${
                      isActivePath(item.path)
                        ? 'text-yellow-400 bg-yellow-500/10'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                    {item.subItems && <ChevronDown className="w-4 h-4 ml-1" />}
                  </NavLink>
                  
                  {item.subItems && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      {item.subItems.map((subItem) => (
                        <NavLink
                          key={subItem.path}
                          to={subItem.path}
                          className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg transition-colors"
                        >
                          {subItem.name}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center space-x-3">
              <form onSubmit={handleSearch} className="hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 lg:w-64 pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                  />
                </div>
              </form>

              <button
                onClick={() => navigate('/content/create')}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-all shadow-lg hover:shadow-yellow-500/25"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden lg:block">Create</span>
              </button>

              <button
                onClick={() => navigate('/agent-terminal')}
                className="hidden sm:flex p-2 text-gray-400 hover:text-green-400 transition-colors rounded-lg hover:bg-green-500/10"
                title="Agent Terminal"
              >
                <Terminal className="w-5 h-5" />
              </button>

              <button className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-300 border-2 border-white/30 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                >
                  <span className="text-white font-bold">U</span>
                </button>
                
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-700">
                      <p className="text-white font-medium">User Name</p>
                      <p className="text-gray-400 text-sm">@username</p>
                    </div>
                    <NavLink
                      to="/settings"
                      className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Settings
                    </NavLink>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-gray-800/95 backdrop-blur-xl border-t border-gray-700">
            <div className="px-4 py-4 space-y-2">
              <form onSubmit={handleSearch} className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900/50 text-white placeholder:text-gray-400 border border-gray-600 rounded-lg focus:border-yellow-500/50 outline-none transition-all"
                />
              </form>

              {navigationItems.map((item) => (
                <div key={item.name}>
                  <NavLink
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`relative px-4 py-3 rounded-lg font-medium flex items-center gap-3 transition-all ${
                      isActivePath(item.path)
                        ? 'text-yellow-400 bg-yellow-500/10'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                  
                  {item.subItems && (
                    <div className="ml-8 mt-2 space-y-2">
                      {item.subItems.map((subItem) => (
                        <NavLink
                          key={subItem.path}
                          to={subItem.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className="block px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                        >
                          {subItem.name}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              <button
                onClick={() => {
                  navigate('/content/create');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-all mt-4 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Create Post
              </button>
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTAINER - Natural scroll, browser handles overflow */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 lg:py-4">
          <Outlet />
        </div>
      </main>

      {/* Condensed Footer - Appears at bottom after scrolling */}
      <LegalFooter />
    </div>
  );
};

export default Layout;
