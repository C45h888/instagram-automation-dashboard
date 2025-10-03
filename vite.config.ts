import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@constants': path.resolve(__dirname, './src/constants')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // ✅ USE THIS (comprehensive)
manualChunks: (id) => {
  // Core React libraries
  if (id.includes('node_modules/react/') || 
      id.includes('node_modules/react-dom/')) {
    return 'vendor';
  }
  
  // Routing
  if (id.includes('node_modules/react-router-dom/')) {
    return 'router';
  }
  
  // UI libraries
  if (id.includes('node_modules/lucide-react/') || 
      id.includes('node_modules/framer-motion/')) {
    return 'ui';
  }
  
  // State management
  if (id.includes('node_modules/zustand/')) {
    return 'state';
  }
  
  // Data fetching
  if (id.includes('node_modules/@tanstack/react-query/')) {
    return 'query';
  }
  
  // Supabase (LARGE - needs own chunk) - NEW!
  if (id.includes('node_modules/@supabase/')) {
    return 'supabase';
  }
  
  // Admin pages - NEW!
  if (id.includes('/src/pages/admin/') || 
      id.includes('/src/pages/Admin')) {
    return 'admin-pages';
  }
  
  // User pages - NEW!
  if (id.includes('/src/pages/Dashboard') ||
      id.includes('/src/pages/Analytics') ||
      id.includes('/src/pages/Settings')) {
    return 'user-pages';
  }
  
  // Authentication components - NEW!
  if (id.includes('/src/pages/Login') ||
      id.includes('/src/components/RequireAuth') ||
      id.includes('/src/stores/authStore')) {
    return 'auth';
  }
  
  // Shared components - NEW!
  if (id.includes('/src/components/')) {
    return 'components';
  }
}
      }
    },
    
  },
  server: {
    port: 3000,
    host: true,
    open: true
  },
  preview: {
    port: 3001,
    host: true
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand']
  }
});