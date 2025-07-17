import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const Login: React.FC = () => {
  const login = useAuthStore((s) => s.login);
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-instagram-primary">Login</h1>
        <button
          onClick={handleLogin}
          className="w-full bg-instagram-primary text-white py-2 rounded hover:bg-instagram-secondary transition"
        >
          Login with Instagram
        </button>
      </div>
    </div>
  );
};

export default Login; 