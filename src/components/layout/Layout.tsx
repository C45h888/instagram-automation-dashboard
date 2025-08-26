// src/components/layout/Layout.tsx
import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import LegalFooter from '../layout/LegalFooter'; // Fixed import path
import { 
  Home, Calendar, MessageCircle, BarChart3, Settings, 
  Users, Bot, Target, Search, Bell, Menu, X, LogOut,
  ChevronDown, Plus
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
    { 
      name: 'Dashboard', 
      path: '/', 
      icon: <Home className="w-5 h-5" /> 
    },
    { 
      name: 'Content', 
      path: '/content', 
      icon: <Calendar className="w-5 h-5" />,
      subItems: [
        { name: 'Create Post', path: '/content/create' },
        { name: 'Schedule', path: '/content' },
      ]
    },
    { 
      name: 'Engagement', 
      path: '/engagement', 
      icon: <MessageCircle className="w-5 h-5" />,
      badge: 3 
    },
    { 
      name: 'Analytics', 
      path: '/analytics', 
      icon: <BarChart3 className="w-5 h-5" /> 
    },
    { 
      name: 'Automations', 
      path: '/automations', 
      icon: <Bot className="w-5 h-5" /> 
    },
    { 
      name: 'Campaigns', 
      path: '/campaigns', 
      icon: <Target className="w-5 h-5" /> 
    },
    { 
      name: 'Audience', 
      path: '/audience', 
      icon: <Users className="w-5 h-5" /> 
    },
    { 
      name: 'Settings', 
      path: '/settings', 
      icon: <Settings className="w-5 h-5" /> 
    },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Searching for:', searchQuery);
    // Implement search functionality
  };

  const handleLogout = () => {
    // Clear any auth tokens/state
    navigate('/login');
  };

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo/Brand */}
            <div className="flex items-center space-x-4">
              <NavLink to="/" className="flex items-center space-x-3 group">
                <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-all duration-200">
                  <div className="w-6 h-6 bg-white/20 rounded-lg backdrop-blur-sm"></div>
                </div>
                <span className="text-white font-semibold text-xl tracking-tight hidden sm:block">
                  InstaAutomation
                </span>
              </NavLink>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navigationItems.map((item) => (
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
                    {item.subItems && (
                      <ChevronDown className="w-4 h-4 ml-1" />
                    )}
                  </NavLink>
                  
                  {/* Dropdown for sub-items */}
                  {item.subItems && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      {item.subItems.map((subItem) => (
                        <NavLink
                          key={subItem.path}
                          to={subItem.path}
                          className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {subItem.name}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center space-x-3">
              {/* Quick Create Button */}
              <button
                onClick={() => navigate('/content/create')}
                className="hidden md:flex items-center gap-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden lg:inline">Create</span>
              </button>

              {/* Search Bar - Hidden on mobile */}
              <form onSubmit={handleSearch} className="hidden lg:block relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 w-48 xl:w-64 bg-gray-800/50 text-white placeholder:text-gray-400 border border-gray-600 rounded-lg py-2 focus:border-yellow-500/50 outline-none transition-all"
                />
              </form>

              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                <Bell className="w-6 h-6" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User Avatar with Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-500 via-yellow-400 to-yellow-300 border-2 border-white/30 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                >
                  <span className="text-white font-bold">U</span>
                </button>
                
                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl">
                    <div className="px-4 py-3 border-b border-gray-700">
                      <p className="text-white font-medium">User Name</p>
                      <p className="text-gray-400 text-sm">@username</p>
                    </div>
                    <NavLink
                      to="/settings"
                      className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Settings
                    </NavLink>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-gray-800/95 backdrop-blur-xl border-t border-gray-700">
            <div className="px-4 py-4 space-y-2">
              {/* Mobile Search */}
              <form onSubmit={handleSearch} className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 bg-gray-900/50 text-white placeholder:text-gray-400 border border-gray-600 rounded-lg py-2 focus:border-yellow-500/50 outline-none"
                />
              </form>

              {/* Mobile Navigation Links */}
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
                  
                  {/* Mobile sub-items */}
                  {item.subItems && (
                    <div className="ml-8 mt-2 space-y-2">
                      {item.subItems.map((subItem) => (
                        <NavLink
                          key={subItem.path}
                          to={subItem.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className="block px-4 py-2 text-gray-400 hover:text-white text-sm"
                        >
                          {subItem.name}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Mobile Create Button */}
              <button
                onClick={() => {
                  navigate('/content/create');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-all mt-4"
              >
                <Plus className="w-4 h-4" />
                Create Post
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area with Outlet */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>

      {/* Legal Footer Component Integration */}
      <LegalFooter />
    </div>
  );
};

export default Layout;