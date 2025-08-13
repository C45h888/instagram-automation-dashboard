import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Instagram, Lock, User } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const handleLogin = () => {
    // Simulate Instagram OAuth
    login({
      id: '1',
      username: 'instauser',
      avatarUrl: '',
      permissions: ['dashboard', 'content', 'engagement', 'analytics', 'settings'],
    }, 'mock_token');
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-pink-500 to-orange-500 flex items-center justify-center">
            <Instagram className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">InstaAutomate</h1>
          <p className="text-gray-400">Sign in to your automation dashboard</p>
        </div>

        {/* Login Form */}
        <div className="space-y-6">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Username or Email
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Enter your username"
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-400 focus:border-white/40 focus:outline-none backdrop-blur-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="password"
                placeholder="Enter your password"
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-400 focus:border-white/40 focus:outline-none backdrop-blur-xl"
              />
            </div>
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
          >
            Sign In with Instagram
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;