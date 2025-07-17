import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

const Layout: React.FC = () => {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg p-6 hidden md:block">
        <div className="font-bold text-xl mb-8 text-instagram-primary">IG Automation</div>
        <nav className="space-y-4">
          <a href="/" className="block text-neutral-900 hover:text-instagram-primary">Dashboard</a>
          <a href="/content" className="block text-neutral-900 hover:text-instagram-primary">Content</a>
          <a href="/engagement" className="block text-neutral-900 hover:text-instagram-primary">Engagement</a>
          <a href="/analytics" className="block text-neutral-900 hover:text-instagram-primary">Analytics</a>
          <a href="/ugc" className="block text-neutral-900 hover:text-instagram-primary">UGC</a>
          <a href="/settings" className="block text-neutral-900 hover:text-instagram-primary">Settings</a>
        </nav>
      </aside>
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between bg-white shadow p-4">
          <div className="font-semibold text-lg text-instagram-secondary">Welcome, {user?.username || 'User'}</div>
          <button onClick={handleLogout} className="bg-instagram-primary text-white px-4 py-2 rounded hover:bg-instagram-secondary transition">Logout</button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout; 