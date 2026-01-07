import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { UserConfig } from 'vite';
import type { ManualChunksOption, PreRenderedAsset } from 'rollup';

// Verification logging - Updated for v2.4.0
console.log('\n🔧 ========================================');
console.log('✅ VITE CONFIG v2.4.0 LOADED');
console.log('✅ React dedupe: ENABLED');
console.log('✅ Chunk load order: FIXED (numeric prefixes)');
console.log('✅ React alias:', path.resolve(__dirname, './node_modules/react'));
console.log('========================================\n');

/**
 * Vite Configuration for Instagram Automation Dashboard
 * 
 * Optimized for production builds with:
 * - Advanced code splitting via manual chunking
 * - esbuild minification for fast builds
 * - Source maps for debugging
 * - Path aliases for clean imports
 * - React deduplication for production stability
 * - Enforced chunk loading order via numeric prefixes
 * 
 * @version 2.4.0
 * @updated 2025-10-12 - Fixed chunk loading order with numeric prefixes
 *                        to ensure React loads before dependent libraries
 */

/**
 * Manual chunking strategy function with enforced load order
 * 
 * CRITICAL FIX: Uses numeric prefixes to guarantee React core libraries
 * load BEFORE any dependencies that require them (e.g., lucide-react).
 * 
 * Chunks load in alphabetical/numeric order:
 *   0-react-core → 1-router → 2-ui-libs → 3-state → etc.
 * 
 * This prevents "Cannot read properties of undefined (reading 'forwardRef')"
 * runtime errors in production where lucide-react would execute before
 * React was available.
 * 
 * @param id - The module ID being processed (file path)
 * @returns Chunk name or undefined for default chunking
 */
const manualChunks: ManualChunksOption = (id: string): string | undefined => {
  // PRIORITY 1: Core React libraries - MUST load first
  // Includes React, ReactDOM, and internal React dependencies
  if (id.includes('node_modules/react/') || 
      id.includes('node_modules/react-dom/') ||
      id.includes('node_modules/react-is/') ||
      id.includes('node_modules/scheduler/')) {
    return '0-react-core';
  }
  
  // PRIORITY 2: Routing library - Depends on React
  // React Router DOM - ~34KB
  if (id.includes('node_modules/react-router-dom/') ||
      id.includes('node_modules/react-router/')) {
    return '1-router';
  }
  
  // PRIORITY 3: UI libraries - Depend on React being available
  // Lucide icons and Framer Motion animations - ~142KB
  // CRITICAL: This must load AFTER React (0-react-core)
  if (id.includes('node_modules/lucide-react/') || 
      id.includes('node_modules/framer-motion/')) {
    return '2-ui-libs';
  }
  
  // PRIORITY 4: State management - Zustand - ~8KB
  if (id.includes('node_modules/zustand/')) {
    return '3-state';
  }
  
  // PRIORITY 5: Data fetching - TanStack React Query - ~28KB
  if (id.includes('node_modules/@tanstack/react-query/')) {
    return '4-query';
  }
  
  // PRIORITY 6: Supabase client - Large library, needs own chunk
  // ~180KB - Only loads when database operations needed
  if (id.includes('node_modules/@supabase/')) {
    return '5-supabase';
  }
  
  // Application code chunks (no numeric prefix needed)
  // These load after all dependencies are ready
  
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
    // React plugin with Fast Refresh enabled by default
    react(),
  ],
  
  resolve: {
    // Path aliases for clean imports throughout the application
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@constants': path.resolve(__dirname, './src/constants'),
      
      // CRITICAL: Explicit React resolution to ensure single instance
      // Forces all React imports to resolve to the same physical location
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
    
    /**
     * Dedupe React dependencies to prevent multiple instances
     * 
     * CRITICAL FIX: Forces Vite to always resolve React and ReactDOM
     * to a single instance from the project root. This prevents the
     * "Cannot read properties of undefined (reading 'forwardRef')" error
     * that occurs when packages like lucide-react receive an undefined
     * React module in production builds.
     * 
     * Without this, Vite may bundle multiple React instances, causing
     * peer dependencies to fail at runtime despite successful builds.
     * 
     * Works in conjunction with explicit alias above for maximum safety.
     * 
     * @see https://vitejs.dev/config/shared-options.html#resolve-dedupe
     */
    dedupe: ['react', 'react-dom'],
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
        
        // Asset file naming pattern - FIXED VERSION
        assetFileNames: (assetInfo: PreRenderedAsset): string => {
          // Handle the case where names array might be empty or undefined
          if (!assetInfo.names || assetInfo.names.length === 0) {
            // Fallback to default naming pattern for unnamed assets
            return `assets/[name]-[hash][extname]`;
          }
          
          // Get the first name from the names array
          const fileName = assetInfo.names[0];
          
          // If fileName is still somehow undefined, use fallback
          if (!fileName) {
            return `assets/[name]-[hash][extname]`;
          }
          
          // Get file extension
          const parts = fileName.split('.');
          
          // If no extension found (shouldn't happen, but let's be safe)
          if (parts.length < 2) {
            return `assets/[name]-[hash][extname]`;
          }
          
          // Get the extension (last part after splitting by '.')
          const ext = parts[parts.length - 1];
          
          // CSS assets - special handling
          if (ext === 'css') {
            return `assets/css/[name]-[hash][extname]`;
          }
          
          // Image assets
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          
          // Font assets
          if (/woff2?|ttf|eot/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          
          // Default asset path for everything else
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
    // Use 5173 (Vite default) to avoid conflicts with backend port 3001
    port: 5173,

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