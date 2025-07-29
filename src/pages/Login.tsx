@@ .. @@
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
   )
 }
-    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50">
-      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
-        <h1 className="text-2xl font-bold mb-6 text-instagram-primary">Login</h1>
+    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
+      {/* Logo/Brand */}
+      <div className="flex items-center space-x-4 mb-8">
+        <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
+          <div className="w-8 h-8 bg-white/20 rounded-lg backdrop-blur-sm"></div>
+        </div>
+        <span className="text-white font-semibold text-2xl tracking-tight font-sf-pro">AutomationPro</span>
+      </div>
+      
+      <div className="glass-morphism-card p-8 rounded-2xl shadow-lg border border-white/10 bg-white/5 backdrop-blur-md w-full max-w-sm">
+        <h1 className="text-2xl font-bold mb-6 text-white font-sf-pro text-center">Welcome Back</h1>
+        <p className="text-gray-300 text-center mb-8 font-sf-pro">Sign in to access your Instagram automation dashboard</p>
         <button
           onClick={handleLogin}
-          className="w-full bg-instagram-primary text-white py-2 rounded hover:bg-instagram-secondary transition"
+          className="w-full glass-morphism-button-primary px-5 py-3 text-base rounded-lg font-sf-pro font-medium transition-all duration-300 hover:transform hover:translateY(-1px)"
         >
-          Login with Instagram
+          Continue with Instagram
         </button>
+        
+        <div className="mt-6 text-center">
+          <p className="text-gray-400 text-sm font-sf-pro">
+            Secure authentication powered by Meta
+          </p>
+        </div>
       </div>
+      
+      <div className="mt-8 text-center">
+        <p className="text-gray-500 text-sm font-sf-pro">
+          © 2024 AutomationPro. All rights reserved.
+        </p>
+      </div>
     </div>
   );
 };