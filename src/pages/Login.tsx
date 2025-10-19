import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Instagram, Lock, ChevronRight } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';
  
  const [isInstagramLoading, setIsInstagramLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);

  const handleInstagramLogin = async () => {
    setIsInstagramLoading(true);
    setMessage(null);
    
    try {
      // Simulate Instagram OAuth flow
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In production, this would redirect to Instagram OAuth
      // For now, show a message about Instagram API pending
      setMessage({
        type: 'info',
        text: 'Instagram OAuth integration pending Meta API approval'
      });
      
      // Temporary mock login for development
      // Remove this in production
      if (process.env.NODE_ENV === 'development') {
        // Wait a bit to show the message
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        login({
          id: '1',
          username: 'instauser',
          avatarUrl: '',
          permissions: ['dashboard', 'content', 'engagement', 'analytics', 'settings'],
        }, 'mock_token');
        
        setMessage({
          type: 'success',
          text: 'Development mode: Mock login successful'
        });
        
        // Navigate after showing success message
        setTimeout(() => {
          navigate(from, { replace: true });
        }, 1000);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Instagram login failed. Please try again.'
      });
    } finally {
      setIsInstagramLoading(false);
    }
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

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-3 rounded-lg ${
            message.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-400' :
            message.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' :
            'bg-blue-500/10 border border-blue-500/30 text-blue-400'
          }`}>
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        {/* Instagram OAuth Button (Primary) */}
        <div className="space-y-6">
          <button
            onClick={handleInstagramLogin}
            disabled={isInstagramLoading}
            className={`w-full py-4 rounded-lg font-semibold transition-all duration-200 transform flex items-center justify-center ${
              isInstagramLoading
                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white hover:scale-105'
            }`}
          >
            {isInstagramLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting to Instagram...
              </span>
            ) : (
              <>
                <Instagram className="w-5 h-5 mr-2" />
                Continue with Instagram
              </>
            )}
          </button>

          {/* OAuth Status Message */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-blue-300 font-medium mb-1">Instagram Integration Status</h3>
                <p className="text-blue-200 text-sm">
                  We're currently awaiting Meta API approval for Instagram Business features. 
                  Full automation capabilities will be available once approved.
                </p>
              </div>
            </div>
          </div>

          {/* Security Features */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center text-gray-400 text-sm">
              <Lock className="w-4 h-4 mr-2" />
              <span>Secure authentication via Instagram OAuth 2.0</span>
            </div>
            <div className="flex items-center text-gray-400 text-sm">
              <Lock className="w-4 h-4 mr-2" />
              <span>Your data is encrypted and protected</span>
            </div>
            <div className="flex items-center text-gray-400 text-sm">
              <Lock className="w-4 h-4 mr-2" />
              <span>Powered by Cloudflare security</span>
            </div>
          </div>
        </div>

        {/* Hidden Admin Portal Link */}
        {/* Subtle footer with hidden admin access */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>© 2024 888Intelligence</span>
            {/* Hidden admin link - appears as a period but is clickable */}
            <Link
              to="/admin/login"
              className="hover:text-gray-400 transition-colors"
              title="Administrative Access"
              style={{ fontSize: '8px', opacity: 0.3 }}
            >
              •
            </Link>
          </div>
        </div>

        {/* Alternative: More visible admin link - controlled by environment variable */}
        {import.meta.env.VITE_SHOW_ADMIN_LINK === 'true' && (
          <div className="mt-4 text-center">
            <Link
              to="/admin/login"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors inline-flex items-center"
            >
              Admin Portal <ChevronRight className="w-3 h-3 ml-1" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;