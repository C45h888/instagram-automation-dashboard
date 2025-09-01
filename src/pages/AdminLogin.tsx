import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Shield, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';

const AdminLogin: React.FC = () => {
  const { signInAsAdmin, adminLogin, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [message, setMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);

  // Combined loading state (from store or local)
  const isAuthenticating = isLoading || localLoading;

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage(null);
    setLocalLoading(true);

    // Basic validation
    if (!email || !password) {
      setError('Please enter both email and password');
      setLocalLoading(false);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLocalLoading(false);
      return;
    }

    // Check if account is temporarily locked
    if (attempts >= 5) {
      setError('Account temporarily locked due to multiple failed attempts');
      setMessage({
        type: 'error',
        text: 'Please wait before attempting to login again'
      });
      setLocalLoading(false);
      return;
    }

    try {
      // Try Supabase authentication first
      await signInAsAdmin(email, password);
      
      // Success! Show success message
      setMessage({
        type: 'success',
        text: 'Welcome back, Administrator!'
      });

      // Navigate after brief delay to show success message
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1000);

    } catch (supabaseError: any) {
      console.log('Supabase admin login failed, checking fallback...', supabaseError.message);
      
      // Fallback to legacy hardcoded authentication for development
      try {
        // Simulate API call delay for UX consistency
        await new Promise(resolve => setTimeout(resolve, 500));

        // Development admin credentials (matching your existing logic)
        const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@888intelligence.com';
        const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'Admin@888Intelligence2024';

        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
          // Successful legacy admin login
          const adminUser = {
            id: 'admin-dev-001', // Updated to match new auth store
            username: 'admin',
            email: email,
            role: 'admin' as const,
            avatarUrl: '',
            permissions: [
              'dashboard',
              'content',
              'engagement',
              'analytics',
              'settings',
              'automations',
              'admin',
              'user-management',
              'system-config'
            ],
          };

          // Generate a mock admin token
          const adminToken = btoa(JSON.stringify({ 
            type: 'admin', 
            timestamp: Date.now(),
            sessionId: Math.random().toString(36).substring(7)
          }));

          // Use legacy adminLogin method as fallback
          adminLogin(adminUser, adminToken);
          
          setMessage({
            type: 'success',
            text: 'Welcome back, Administrator! (Development Mode)'
          });

          console.log('📝 Development admin login successful (fallback)');

          // Navigate after brief delay
          setTimeout(() => {
            navigate(from, { replace: true });
          }, 1000);

        } else {
          // Failed login attempt
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          
          if (newAttempts >= 5) {
            setError('Too many failed attempts. Account temporarily locked.');
            setMessage({
              type: 'error',
              text: 'Account temporarily locked due to multiple failed attempts'
            });
          } else {
            setError(`Invalid credentials. ${5 - newAttempts} attempts remaining.`);
            setMessage({
              type: 'error',
              text: 'Invalid email or password'
            });
          }
        }
      } catch (fallbackError) {
        console.error('Fallback authentication error:', fallbackError);
        setError('Authentication failed. Please try again.');
        setMessage({
          type: 'error',
          text: 'Login failed. Please check your connection and try again.'
        });
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setMessage({
      type: 'info',
      text: 'Please contact system administrator for password reset'
    });
  };

  // Auto-fill development credentials (new feature)
  const fillDevCredentials = () => {
    setEmail(import.meta.env.VITE_ADMIN_EMAIL || 'admin@888intelligence.com');
    setPassword(import.meta.env.VITE_ADMIN_PASSWORD || 'Admin@888Intelligence2024');
    setMessage({
      type: 'info',
      text: 'Development credentials filled'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20">
        {/* Admin Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Access</h1>
          <p className="text-gray-400">Secure administrative portal</p>
        </div>

        {/* Security Notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-yellow-300 text-sm">
              This is a restricted area. All login attempts are monitored and logged.
            </p>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.type === 'error' ? 'bg-red-500/10 border border-red-500/30' :
            message.type === 'success' ? 'bg-green-500/10 border border-green-500/30' :
            'bg-blue-500/10 border border-blue-500/30'
          }`}>
            <p className={`text-sm ${
              message.type === 'error' ? 'text-red-400' :
              message.type === 'success' ? 'text-green-400' :
              'text-blue-400'
            }`}>{message.text}</p>
          </div>
        )}

        {/* Admin Login Form */}
        <form onSubmit={handleAdminLogin} className="space-y-6">
          {/* Email Field */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-400 focus:border-red-500/50 focus:outline-none backdrop-blur-xl transition-colors"
                disabled={isAuthenticating || attempts >= 5}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Admin Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter secure password"
                className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-400 focus:border-red-500/50 focus:outline-none backdrop-blur-xl transition-colors"
                disabled={isAuthenticating || attempts >= 5}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                tabIndex={-1}
                disabled={isAuthenticating}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isAuthenticating || attempts >= 5}
            className={`w-full py-3 rounded-lg font-semibold transition-all duration-200 transform ${
              isAuthenticating || attempts >= 5
                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white hover:scale-105'
            }`}
          >
            {isAuthenticating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Authenticating...
              </span>
            ) : attempts >= 5 ? (
              'Account Locked'
            ) : (
              'Sign In as Administrator'
            )}
          </button>
        </form>

        {/* Footer Links */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between text-sm">
            <Link
              to="/login"
              className="text-gray-400 hover:text-white transition-colors flex items-center"
            >
              ← Back to User Login
            </Link>
            <button
              type="button"
              className="text-gray-400 hover:text-white transition-colors"
              onClick={handleForgotPassword}
            >
              Forgot Password?
            </button>
          </div>
        </div>

        {/* Development Helpers */}
        {import.meta.env.VITE_ENVIRONMENT === 'development' && (
          <div className="mt-4 space-y-2">
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <p className="text-purple-300 text-xs text-center mb-2">
                Development Mode: Enhanced with Supabase + Fallback
              </p>
              <button
                onClick={fillDevCredentials}
                className="w-full py-2 px-4 bg-purple-600/20 text-purple-300 text-sm rounded-lg hover:bg-purple-600/30 transition-colors"
                disabled={isAuthenticating}
              >
                Fill Dev Credentials
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLogin;