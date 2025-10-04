import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { UserConfig } from 'vite';
import type { ManualChunksOption } from 'rollup';

/**
 * Vite Configuration for Instagram Automation Dashboard
 * 
 * Optimized for production builds with:
 * - Advanced code splitting via manual chunking
 * - esbuild minification for fast builds
 * - Source maps for debugging
 * - Path aliases for clean imports
 */

/**
 * Manual chunking strategy function
 * Splits code into logical chunks for optimal caching and loading performance
 * 
 * @param id - The module ID being processed (file path)
 * @returns Chunk name or undefined for default chunking
 */
const manualChunks: ManualChunksOption = (id: string): string | undefined => {
  // Core React libraries - Always needed, loaded first
  if (id.includes('node_modules/react/') || 
      id.includes('node_modules/react-dom/')) {
    return 'vendor';
  }
  
  // Routing library - React Router DOM
  if (id.includes('node_modules/react-router-dom/')) {
    return 'router';
  }
  
  // UI libraries - Lucide icons and Framer Motion animations
  if (id.includes('node_modules/lucide-react/') || 
      id.includes('node_modules/framer-motion/')) {
    return 'ui';
  }
  
  // State management - Zustand
  if (id.includes('node_modules/zustand/')) {
    return 'state';
  }
  
  // Data fetching - TanStack React Query
  if (id.includes('node_modules/@tanstack/react-query/')) {
    return 'query';
  }
  
  // Supabase client - Large library, needs own chunk
  // ~180KB - Only loads when database operations needed
  if (id.includes('node_modules/@supabase/')) {
    return 'supabase';
  }
  
  // Admin pages - Only loaded for admin users
  // Includes: AdminLogin and admin dashboard pages
  if (id.includes('/src/pages/admin/') || 
      id.includes('/src/pages/Admin')) {
    return 'admin-pages';
  }
  
  // User pages - Main application pages
  // Includes: Dashboard, Analytics, Settings
  if (id.includes('/src/pages/Dashboard') ||
      id.includes('/src/pages/Analytics') ||
      id.includes('/src/pages/Settings')) {
    return 'user-pages';
  }
  
  // Authentication components and logic
  // Includes: Login page, RequireAuth component, authStore
  if (id.includes('/src/pages/Login') ||
      id.includes('/src/components/RequireAuth') ||
      id.includes('/src/stores/authStore')) {
    return 'auth';
  }
  
  // Shared components - Used across multiple pages
  // Loaded when first needed, then cached
  if (id.includes('/src/components/')) {
    return 'components';
  }
  
  // Return undefined for default Vite chunking behavior
  return undefined;
};

/**
 * Vite configuration object
 */
const config: UserConfig = {
  plugins: [
    // ✅ FIXED: Removed deprecated fastRefresh option
    // Fast Refresh is now enabled by default in modern @vitejs/plugin-react
    react(),
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@constants': path.resolve(__dirname, './src/constants'),
    },
  },
  
  build: {
    // Output directory for production build
    outDir: 'dist',
    
    // Generate source maps for debugging production issues
    sourcemap: true,
    
    // Use esbuild for minification (20-30x faster than terser)
    minify: 'esbuild',
    
    // Target modern browsers for smaller bundle
    target: 'es2015',
    
    // Warn if chunk size exceeds 500kb
    chunkSizeWarningLimit: 500,
    
    // Rollup-specific options
    rollupOptions: {
      output: {
        // Manual chunking strategy for optimal code splitting
        manualChunks,
        
        // Asset file naming pattern
        assetFileNames: (assetInfo): string => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff2?|ttf|eot/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        
        // Chunk file naming pattern
        chunkFileNames: 'assets/[name]-[hash].js',
        
        // Entry file naming pattern
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Minify CSS
    cssMinify: true,
  },
  
  server: {
    // Development server port
    port: 3000,
    
    // Listen on all network interfaces
    host: true,
    
    // Auto-open browser on server start
    open: true,
    
    // Enable CORS for development
    cors: true,
    
    // Strict port - fail if port is already in use
    strictPort: false,
  },
  
  preview: {
    // Preview server port (for testing production build)
    port: 3001,
    
    // Listen on all network interfaces
    host: true,
    
    // Enable CORS for preview
    cors: true,
  },
  
  // Dependency optimization
  optimizeDeps: {
    // Pre-bundle these dependencies for faster dev server startup
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
    ],
    
    // Exclude these from pre-bundling (optional)
    exclude: [],
  },
  
  // Define global constants
  define: {
    // Ensure process.env is available in production
    'process.env': process.env,
  },
};

export default defineConfig(config);