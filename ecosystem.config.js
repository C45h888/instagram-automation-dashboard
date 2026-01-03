
// Place this file in the project root directory

module.exports = {
  apps: [
    {
      // Backend Express Server
      name: 'instagram-backend',
      script: './backend/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      // Health monitoring
      min_uptime: '10s',
      max_restarts: 10
    },
    
    {
      // Unified Tunnel Manager - Dual Mode
      name: 'tunnel-dual',
      script: './scripts/tunnel-manager-unified.js',
      args: 'start --mode dual',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/tunnel-error.log',
      out_file: './logs/tunnel-out.log',
      log_file: './logs/tunnel-combined.log',
      time: true,
      // Don't restart too quickly if tunnels fail
      min_uptime: '30s',
      max_restarts: 5,
      restart_delay: 10000
    },
    
    {
      // Optional: Frontend server for production (if not using Vercel/Netlify)
      name: 'frontend',
      script: 'npm',
      args: 'run preview',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      // Only include if self-hosting frontend
      enabled: false  // Set to true if self-hosting
    },
    
    {
      // Health Monitor - Checks system health every 5 minutes
      name: 'health-monitor',
      script: './scripts/health-monitor.js',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '*/5 * * * *',  // Every 5 minutes
      env: {
        NODE_ENV: 'production',
        HEALTH_CHECK_URL: 'https://api.888intelligenceautomation.in/health',
        WEBHOOK_STATUS_URL: 'https://api.888intelligenceautomation.in/webhook/n8n-status'
      },
      error_file: './logs/monitor-error.log',
      out_file: './logs/monitor-out.log',
      time: true,
      // Optional - create health-monitor.js if needed
      enabled: false  // Set to true if you create the health monitor script
    }
  ],

  // Deploy configuration (optional - for remote deployment)
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'YOUR_SERVER_IP',
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/instagram-automation-dashboard.git',
      path: '/home/ubuntu/instagram-automation',
      'pre-deploy-local': 'npm run test',
      'post-deploy': 'npm install && npm run backend:install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt-get update && apt-get install -y nodejs npm cloudflared',
      env: {
        NODE_ENV: 'production'
      }
    },
    
    staging: {
      user: 'ubuntu',
      host: 'YOUR_STAGING_SERVER_IP',
      ref: 'origin/develop',
      repo: 'https://github.com/yourusername/instagram-automation-dashboard.git',
      path: '/home/ubuntu/instagram-automation-staging',
      'post-deploy': 'npm install && npm run backend:install && pm2 reload ecosystem.config.js --env development',
      env: {
        NODE_ENV: 'development'
      }
    }
  }
};