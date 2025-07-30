import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Search, User } from 'lucide-react';
import AnimatedNavigation from './AnimatedNavigation';

const Layout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Top Navigation Bar */}
      <header className="bg-black/50 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg instagram-gradient flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
            <span className="text-white font-bold text-xl">InstaAutomate</span>
          </Link>
          
          {/* Navigation Links */}
          <AnimatedNavigation />
          
          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search..."
                className="hidden lg:block pl-10 pr-4 py-2 w-64 bg-white/10 text-white placeholder:text-gray-400 border border-white/20 rounded-lg focus:border-white/40 focus:outline-none backdrop-blur-xl"
              />
            </div>
            <button className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;