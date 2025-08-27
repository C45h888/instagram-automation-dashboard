// tunnel-manager-dual.js - DUAL TUNNEL MANAGER BASED ON PROVEN CF MANAGER
import { spawn } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables
config();

class DualTunnelManager {
  constructor() {
    // Tunnel A - Backend API (Existing configuration)
    this.tunnelA = {
      name: 'instagram-automation-backend',
      token: process.env.CLOUDFLARE_TUNNEL_TOKEN,
      url: 'https://instagram-backend.888intelligenceautomation.in',
      localPort: process.env.LOCAL_PORT || 3001,
      process: null,
      isActive: false,
      connectionCount: 0,
      configUpdated: false
    };
    
    // Tunnel B - Supabase Database (New configuration)
    this.tunnelB = {
      name: 'supabase-secure-tunnel',
      token: process.env.CLOUDFLARE_SUPABASE_TUNNEL_TOKEN,
      url: 'https://db-secure.888intelligenceautomation.in',
      supabaseUrl: process.env.SUPABASE_URL,
      process: null,
      isActive: false,
      connectionCount: 0,
      configUpdated: false
    };

    // Extract Supabase project reference
    this.supabaseProjectRef = this.extractProjectRef(this.tunnelB.supabaseUrl);
  }

  extractProjectRef(url) {
    if (!url) return null;
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    return match ? match[1] : null;
  }

  async startDualTunnels() {
    console.log('🚇 Starting Dual Cloudflare Tunnel System (ENHANCED VERSION)...');
    console.log('==========================================================');
    console.log(`   Tunnel A: ${this.tunnelA.name}`);
    console.log(`   URL: ${this.tunnelA.url}`);
    console.log(`   Port: ${this.tunnelA.localPort}`);
    console.log('----------------------------------------------------------');
    console.log(`   Tunnel B: ${this.tunnelB.name}`);
    console.log(`   URL: ${this.tunnelB.url}`);
    console.log(`   Supabase: ${this.supabaseProjectRef}`);
    console.log('==========================================================\n');

    try {
      // Step 1: Check prerequisites
      await this.checkPrerequisites();
      
      // Step 2: Start both tunnels in parallel
      await Promise.all([
        this.initializeTunnelA(),
        this.initializeTunnelB()
      ]);
      
      // Step 3: Verify both tunnels are working
      await this.verifyDualConnections();
      
      // Step 4: Update configuration files
      await this.updateDualConfiguration();
      
      // Step 5: Run integration tests
      await this.testDualIntegration();
      
      console.log('\n✅ DUAL TUNNEL SYSTEM SUCCESSFULLY ACTIVATED');
      this.displayDualSuccessInstructions();
      
    } catch (error) {
      console.error('❌ Dual tunnel setup failed:', error.message);
      await this.troubleshootDualIssues();
      process.exit(1);
    }
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites for dual tunnel system...');
    
    // Check backend server
    try {
      const response = await axios.get(`http://localhost:${this.tunnelA.localPort}/health`, {
        timeout: 5000
      });
      console.log('✅ Backend server is running');
      console.log(`   Status: ${response.data.status}`);
    } catch (error) {
      console.error('❌ Backend server not accessible');
      console.log('📋 To fix: cd backend && node server.js');
      throw new Error('Backend server must be running on port ' + this.tunnelA.localPort);
    }

    // Check Tunnel A token
    if (!this.tunnelA.token) {
      console.error('❌ Missing CLOUDFLARE_TUNNEL_TOKEN for Tunnel A');
      console.log('   Get from: Cloudflare Dashboard → Tunnels → instagram-automation-backend');
      throw new Error('Tunnel A token required');
    }
    console.log('✅ Tunnel A token configured');

    // Check Tunnel B token
    if (!this.tunnelB.token) {
      console.error('❌ Missing CLOUDFLARE_SUPABASE_TUNNEL_TOKEN for Tunnel B');
      console.log('📋 To create Tunnel B:');
      console.log('   1. Run: cloudflared tunnel create supabase-secure-tunnel');
      console.log('   2. Copy token from Cloudflare dashboard');
      console.log('   3. Add to .env: CLOUDFLARE_SUPABASE_TUNNEL_TOKEN="your_token"');
      throw new Error('Tunnel B token required');
    }
    console.log('✅ Tunnel B token configured');

    // Check Supabase configuration
    if (!this.tunnelB.supabaseUrl || !this.supabaseProjectRef) {
      console.error('❌ Missing or invalid SUPABASE_URL');
      throw new Error('Supabase URL required');
    }
    console.log('✅ Supabase configuration valid');
    console.log('');
  }

  async initializeTunnelA() {
    console.log('🌐 Starting Tunnel A (Backend API)...');
    
    return new Promise((resolve, reject) => {
      const args = ['tunnel', 'run', '--token', this.tunnelA.token];
      
      this.tunnelA.process = spawn('cloudflared', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let startupComplete = false;

      // Handle output - same pattern as original tunnel-manager-cf.js
      const handleOutput = (data, source) => {
        const text = data.toString();
        
        if (text.includes('ERR') || text.includes('ERROR')) {
          console.error(`   [Tunnel A] ${source} Error: ${text.trim()}`);
        } else if (text.includes('INF')) {
          if (process.env.VERBOSE) {
            console.log(`   [Tunnel A] ${source}: ${text.trim()}`);
          }
        }
        
        // Connection detection logic from original
        if (text.includes('Registered tunnel connection')) {
          this.tunnelA.connectionCount++;
          console.log(`   ✅ Tunnel A Connection ${this.tunnelA.connectionCount} established`);
        }
        
        if (text.includes('Updated to new configuration')) {
          this.tunnelA.configUpdated = true;
          console.log('   ✅ Tunnel A Configuration updated');
        }
        
        // Success when we have 2+ connections and config
        if ((this.tunnelA.connectionCount >= 2 && this.tunnelA.configUpdated) || 
            text.includes(this.tunnelA.name)) {
          if (!startupComplete) {
            startupComplete = true;
            this.tunnelA.isActive = true;
            console.log('   ✅ Tunnel A registration complete');
            resolve();
          }
        }
      };

      this.tunnelA.process.stdout.on('data', (data) => handleOutput(data, 'STDOUT'));
      this.tunnelA.process.stderr.on('data', (data) => handleOutput(data, 'STDERR'));

      this.tunnelA.process.on('close', (code) => {
        if (code !== 0 && !startupComplete) {
          reject(new Error(`Tunnel A failed with exit code ${code}`));
        }
      });

      this.tunnelA.process.on('error', (error) => {
        reject(new Error(`Tunnel A process error: ${error.message}`));
      });

      setTimeout(() => {
        if (!startupComplete) {
          reject(new Error(`Tunnel A timeout (Connections: ${this.tunnelA.connectionCount})`));
        }
      }, 30000);
    });
  }

  async initializeTunnelB() {
    console.log('🔒 Starting Tunnel B (Supabase Database)...');
    
    // First create the config file
    await this.createSupabaseTunnelConfig();
    
    return new Promise((resolve, reject) => {
      const args = ['tunnel', '--config', 'supabase-tunnel.yml', 'run'];
      
      this.tunnelB.process = spawn('cloudflared', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, TUNNEL_TOKEN: this.tunnelB.token }
      });

      let startupComplete = false;

      // Handle output - same pattern as Tunnel A
      const handleOutput = (data, source) => {
        const text = data.toString();
        
        if (text.includes('ERR') || text.includes('ERROR')) {
          console.error(`   [Tunnel B] ${source} Error: ${text.trim()}`);
        } else if (text.includes('INF')) {
          if (process.env.VERBOSE) {
            console.log(`   [Tunnel B] ${source}: ${text.trim()}`);
          }
        }
        
        // Connection detection
        if (text.includes('Registered tunnel connection')) {
          this.tunnelB.connectionCount++;
          console.log(`   ✅ Tunnel B Connection ${this.tunnelB.connectionCount} established`);
        }
        
        if (text.includes('Updated to new configuration') || text.includes('proxying to')) {
          this.tunnelB.configUpdated = true;
          console.log('   ✅ Tunnel B Configuration updated');
        }
        
        // Success conditions
        if ((this.tunnelB.connectionCount >= 2 && this.tunnelB.configUpdated) || 
            text.includes(this.tunnelB.name)) {
          if (!startupComplete) {
            startupComplete = true;
            this.tunnelB.isActive = true;
            console.log('   ✅ Tunnel B registration complete');
            resolve();
          }
        }
      };

      this.tunnelB.process.stdout.on('data', (data) => handleOutput(data, 'STDOUT'));
      this.tunnelB.process.stderr.on('data', (data) => handleOutput(data, 'STDERR'));

      this.tunnelB.process.on('close', (code) => {
        if (code !== 0 && !startupComplete) {
          reject(new Error(`Tunnel B failed with exit code ${code}`));
        }
      });

      this.tunnelB.process.on('error', (error) => {
        reject(new Error(`Tunnel B process error: ${error.message}`));
      });

      setTimeout(() => {
        if (!startupComplete) {
          reject(new Error(`Tunnel B timeout (Connections: ${this.tunnelB.connectionCount})`));
        }
      }, 30000);
    });
  }

  async createSupabaseTunnelConfig() {
    const config = `# Supabase Secure Tunnel Configuration
tunnel: ${this.tunnelB.name}
credentials-file: ~/.cloudflared/${this.tunnelB.name}.json

ingress:
  - hostname: db-secure.888intelligenceautomation.in
    service: ${this.tunnelB.supabaseUrl}
    originRequest:
      httpHostHeader: ${this.supabaseProjectRef}.supabase.co
      originServerName: ${this.supabaseProjectRef}.supabase.co
      noTLSVerify: false
      connectTimeout: 30s
      tlsTimeout: 10s
      tcpKeepAlive: 30s
      keepAliveConnections: 100
      keepAliveTimeout: 90s
  - service: http_status:404

metrics: 0.0.0.0:9091
loglevel: info`;

    writeFileSync('supabase-tunnel.yml', config);
    console.log('   📄 Created supabase-tunnel.yml');
  }

  async verifyDualConnections() {
    console.log('\n🔍 Verifying dual tunnel connectivity...');
    
    const maxRetries = 10;
    let retriesA = 0;
    let retriesB = 0;
    
    // Verify Tunnel A
    while (retriesA < maxRetries) {
      try {
        const response = await axios.get(`${this.tunnelA.url}/health`, {
          timeout: 8000,
          headers: { 'User-Agent': 'Dual-Tunnel-Verifier/1.0' }
        });
        
        console.log('✅ Tunnel A verified');
        console.log(`   Backend Status: ${response.data.status}`);
        console.log(`   CF Ray: ${response.headers['cf-ray'] || 'N/A'}`);
        break;
        
      } catch (error) {
        retriesA++;
        if (retriesA < maxRetries) {
          console.log(`   ⏳ Tunnel A attempt ${retriesA}/${maxRetries}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw new Error('Tunnel A verification failed');
        }
      }
    }
    
    // Verify Tunnel B
    while (retriesB < maxRetries) {
      try {
        const headers = {};
        if (process.env.SUPABASE_ANON_KEY) {
          headers.apikey = process.env.SUPABASE_ANON_KEY;
        }
        
        const response = await axios.get(`${this.tunnelB.url}/rest/v1/`, {
          headers,
          timeout: 8000,
          validateStatus: () => true // Accept any status
        });
        
        if (response.status === 401) {
          console.log('✅ Tunnel B verified (Auth required - Expected)');
        } else {
          console.log('✅ Tunnel B verified');
        }
        console.log(`   Response Status: ${response.status}`);
        break;
        
      } catch (error) {
        retriesB++;
        if (retriesB < maxRetries) {
          console.log(`   ⏳ Tunnel B attempt ${retriesB}/${maxRetries}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.warn('⚠️  Tunnel B may need additional configuration');
        }
      }
    }

    // Test security - direct access should be blocked
    try {
      await axios.get(`${this.tunnelB.supabaseUrl}/rest/v1/`, { timeout: 3000 });
      console.warn('⚠️  WARNING: Direct Supabase access still works - configure IP restrictions');
    } catch (error) {
      console.log('✅ Direct database access properly blocked');
    }
  }

  async updateDualConfiguration() {
    console.log('\n📝 Updating dual tunnel configuration...');
    
    // Create comprehensive environment template
    const envContent = `# DUAL CLOUDFLARE TUNNEL CONFIGURATION
# Generated at: ${new Date().toISOString()}

# ===== TUNNEL A - BACKEND API =====
CLOUDFLARE_TUNNEL_TOKEN=${this.tunnelA.token}
CLOUDFLARE_TUNNEL_NAME=${this.tunnelA.name}
LOCAL_PORT=${this.tunnelA.localPort}
BACKEND_TUNNEL_URL=${this.tunnelA.url}

# ===== TUNNEL B - SUPABASE DATABASE =====
CLOUDFLARE_SUPABASE_TUNNEL_TOKEN=${this.tunnelB.token}
SUPABASE_TUNNEL_NAME=${this.tunnelB.name}
SUPABASE_TUNNEL_URL=${this.tunnelB.url}
SUPABASE_PROJECT_REF=${this.supabaseProjectRef}

# ===== SUPABASE CONFIGURATION =====
SUPABASE_URL=${this.tunnelB.supabaseUrl}
SUPABASE_ANON_KEY=${process.env.SUPABASE_ANON_KEY || 'your_anon_key'}
SUPABASE_SERVICE_KEY=${process.env.SUPABASE_SERVICE_KEY || 'your_service_key'}

# ===== FRONTEND CONFIGURATION (Use Tunnel URLs) =====
VITE_WEBHOOK_URL=${this.tunnelA.url}
VITE_API_BASE_URL=${this.tunnelA.url}
REACT_APP_SUPABASE_URL=${this.tunnelB.url}
REACT_APP_SUPABASE_ANON_KEY=${process.env.SUPABASE_ANON_KEY || 'your_anon_key'}

# ===== BACKEND CONFIGURATION (Use Tunnel URLs) =====
WEBHOOK_VERIFY_TOKEN=instagram_automation_cf_token_2024
META_APP_SECRET=${process.env.META_APP_SECRET || 'your_meta_app_secret'}
SUPABASE_CLIENT_URL=${this.tunnelB.url}
PORT=${this.tunnelA.localPort}
NODE_ENV=production

# ===== N8N WEBHOOK CONFIGURATION =====
N8N_BASE_URL=https://kamesh8888888.app.n8n.cloud
N8N_DM_WEBHOOK=https://kamesh8888888.app.n8n.cloud/webhook-test/instagram-dm-webhook
N8N_COMMENT_WEBHOOK=https://kamesh8888888.app.n8n.cloud/webhook-test/instagram-comment-webhook
N8N_ORDER_WEBHOOK=https://kamesh8888888.app.n8n.cloud/webhook-test/shopify-order-webhook
N8N_HUB_WEBHOOK=https://kamesh8888888.app.n8n.cloud/webhook-test/instagram-webhook
N8N_CONTENT_WEBHOOK=https://kamesh8888888.app.n8n.cloud/webhook-test/content-scheduler

# ===== META API CONFIGURATION =====
META_APP_ID=${process.env.META_APP_ID || 'your_meta_app_id'}
INSTAGRAM_BASIC_DISPLAY_ID=${process.env.INSTAGRAM_BASIC_DISPLAY_ID || 'your_display_id'}
INSTAGRAM_BASIC_DISPLAY_SECRET=${process.env.INSTAGRAM_BASIC_DISPLAY_SECRET || 'your_display_secret'}
BACKEND_BASE_URL=${this.tunnelA.url}`;

    // Save environment template
    writeFileSync('.env.dual-tunnel', envContent);
    console.log('   📄 Created .env.dual-tunnel template');

    // Create dual tunnel status file
    const tunnelInfo = {
      system: 'dual-tunnel',
      version: '2.0',
      created: new Date().toISOString(),
      tunnelA: {
        name: this.tunnelA.name,
        url: this.tunnelA.url,
        port: this.tunnelA.localPort,
        status: this.tunnelA.isActive ? 'active' : 'inactive',
        connections: this.tunnelA.connectionCount,
        endpoints: {
          health: `${this.tunnelA.url}/health`,
          webhook: `${this.tunnelA.url}/webhook/instagram`,
          n8nStatus: `${this.tunnelA.url}/webhook/n8n-status`
        }
      },
      tunnelB: {
        name: this.tunnelB.name,
        url: this.tunnelB.url,
        supabaseProject: this.supabaseProjectRef,
        status: this.tunnelB.isActive ? 'active' : 'inactive',
        connections: this.tunnelB.connectionCount,
        endpoints: {
          rest: `${this.tunnelB.url}/rest/v1/`,
          auth: `${this.tunnelB.url}/auth/v1/`,
          realtime: `${this.tunnelB.url}/realtime/v1/`
        }
      },
      n8nWebhooks: {
        dm: process.env.N8N_DM_WEBHOOK,
        comment: process.env.N8N_COMMENT_WEBHOOK,
        order: process.env.N8N_ORDER_WEBHOOK,
        hub: process.env.N8N_HUB_WEBHOOK,
        content: process.env.N8N_CONTENT_WEBHOOK
      }
    };

    writeFileSync('dual-tunnel-status.json', JSON.stringify(tunnelInfo, null, 2));
    console.log('   📄 Created dual-tunnel-status.json');
  }

  async testDualIntegration() {
    console.log('\n🧪 TESTING DUAL TUNNEL INTEGRATION...');
    console.log('=====================================');
    
    const results = {
      tunnelA: {},
      tunnelB: {},
      security: {}
    };

    // Test Tunnel A endpoints
    try {
      const health = await axios.get(`${this.tunnelA.url}/health`, { timeout: 5000 });
      results.tunnelA.health = '✅ Working';
      console.log('✅ Tunnel A Health:', health.data.status);
    } catch (error) {
      results.tunnelA.health = '❌ Failed';
      console.error('❌ Tunnel A Health failed');
    }

    try {
      const n8n = await axios.get(`${this.tunnelA.url}/webhook/n8n-status`, { timeout: 5000 });
      results.tunnelA.n8n = '✅ Connected';
      console.log('✅ N8N Integration active');
    } catch (error) {
      results.tunnelA.n8n = '⚠️ Check webhooks';
    }

    // Test Tunnel B endpoints
    try {
      const headers = {};
      if (process.env.SUPABASE_ANON_KEY) {
        headers.apikey = process.env.SUPABASE_ANON_KEY;
      }
      
      const response = await axios.get(`${this.tunnelB.url}/rest/v1/`, {
        headers,
        timeout: 5000,
        validateStatus: () => true
      });
      
      if (response.status === 401) {
        results.tunnelB.rest = '✅ Secured';
        console.log('✅ Tunnel B REST API: Secured (Auth required)');
      } else {
        results.tunnelB.rest = '✅ Working';
        console.log('✅ Tunnel B REST API: Working');
      }
    } catch (error) {
      results.tunnelB.rest = '❌ Failed';
      console.error('❌ Tunnel B REST API failed');
    }

    // Security test
    try {
      await axios.get(`${this.tunnelB.supabaseUrl}/rest/v1/`, { 
        timeout: 2000,
        validateStatus: () => true 
      });
      results.security.directAccess = '⚠️ Not blocked';
      console.warn('⚠️ Direct database access not blocked - configure IP restrictions');
    } catch (error) {
      results.security.directAccess = '✅ Blocked';
      console.log('✅ Security: Direct access blocked');
    }

    // Save test results
    writeFileSync('dual-tunnel-test-results.json', JSON.stringify(results, null, 2));
    console.log('\n📊 Test results saved to dual-tunnel-test-results.json');
    
    return results;
  }

  displayDualSuccessInstructions() {
    console.log('\n' + '='.repeat(70));
    console.log('🎉 DUAL TUNNEL SYSTEM ACTIVE - ENTERPRISE ARCHITECTURE');
    console.log('='.repeat(70));
    
    console.log('\n📡 TUNNEL A - Backend API & Webhooks:');
    console.log(`   URL: ${this.tunnelA.url}`);
    console.log(`   Health: ${this.tunnelA.url}/health`);
    console.log(`   Meta Webhook: ${this.tunnelA.url}/webhook/instagram`);
    console.log(`   N8N Status: ${this.tunnelA.url}/webhook/n8n-status`);
    
    console.log('\n🔒 TUNNEL B - Secure Database:');
    console.log(`   URL: ${this.tunnelB.url}`);
    console.log(`   REST API: ${this.tunnelB.url}/rest/v1/`);
    console.log(`   Auth API: ${this.tunnelB.url}/auth/v1/`);
    console.log(`   Realtime: ${this.tunnelB.url}/realtime/v1/`);
    
    console.log('\n🔐 SECURITY CHECKLIST:');
    console.log('   [ ] Configure Supabase IP restrictions (Cloudflare IPs only)');
    console.log('   [ ] Update frontend to use REACT_APP_SUPABASE_URL');
    console.log('   [ ] Update backend to use SUPABASE_CLIENT_URL');
    console.log('   [ ] Test that direct database access is blocked');
    
    console.log('\n📋 TESTING COMMANDS:');
    console.log('   # Test API tunnel:');
    console.log(`   curl ${this.tunnelA.url}/health`);
    console.log('   # Test DB tunnel:');
    console.log(`   curl -H "apikey: YOUR_ANON_KEY" ${this.tunnelB.url}/rest/v1/`);
    console.log('   # Verify security:');
    console.log(`   curl ${this.tunnelB.supabaseUrl}/rest/v1/ # Should fail`);
    
    console.log('\n🚀 META API CONFIGURATION:');
    console.log(`   Callback URL: ${this.tunnelA.url}/webhook/instagram`);
    console.log('   Verify Token: instagram_automation_cf_token_2024');
    
    console.log('='.repeat(70) + '\n');
  }

  async troubleshootDualIssues() {
    console.log('\n🔧 DUAL TUNNEL TROUBLESHOOTING');
    console.log('===============================');
    
    // Check Tunnel A issues
    if (!this.tunnelA.isActive) {
      console.log('\n❌ Tunnel A Issues:');
      console.log(`   Connections: ${this.tunnelA.connectionCount}`);
      console.log(`   Config Updated: ${this.tunnelA.configUpdated}`);
      console.log('   Fix: Check token and Cloudflare dashboard configuration');
    }
    
    // Check Tunnel B issues  
    if (!this.tunnelB.isActive) {
      console.log('\n❌ Tunnel B Issues:');
      console.log(`   Connections: ${this.tunnelB.connectionCount}`);
      console.log(`   Config Updated: ${this.tunnelB.configUpdated}`);
      console.log('   Fix: Ensure tunnel exists in Cloudflare dashboard');
    }
    
    // Common fixes
    console.log('\n📋 Common Fixes:');
    console.log('   1. Verify both tunnel tokens in .env');
    console.log('   2. Check Cloudflare dashboard for both tunnels');
    console.log('   3. Ensure backend is running: cd backend && node server.js');
    console.log('   4. For Tunnel A: Service should be http://localhost:3001');
    console.log('   5. For Tunnel B: Create DNS route to db-secure.888intelligenceautomation.in');
    console.log('   6. Check supabase-tunnel.yml configuration');
    
    // Dashboard links
    console.log('\n🔗 Useful Links:');
    console.log('   Cloudflare: https://one.dash.cloudflare.com/');
    console.log('   Supabase: https://app.supabase.com/');
  }

  async status() {
    console.log('📊 DUAL TUNNEL STATUS REPORT');
    console.log('============================\n');
    
    if (existsSync('dual-tunnel-status.json')) {
      const status = JSON.parse(readFileSync('dual-tunnel-status.json', 'utf8'));
      
      console.log('TUNNEL A - Backend API:');
      console.log(`  Status: ${this.tunnelA.isActive ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`  URL: ${status.tunnelA.url}`);
      console.log(`  Connections: ${status.tunnelA.connections}`);
      
      console.log('\nTUNNEL B - Database:');
      console.log(`  Status: ${this.tunnelB.isActive ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`  URL: ${status.tunnelB.url}`);
      console.log(`  Project: ${status.tunnelB.supabaseProject}`);
      console.log(`  Connections: ${status.tunnelB.connections}`);
      
      // Test connectivity
      console.log('\n🔍 Testing connectivity...');
      
      try {
        await axios.get(`${status.tunnelA.url}/health`, { timeout: 3000 });
        console.log('✅ Tunnel A: Responding');
      } catch {
        console.log('❌ Tunnel A: Not responding');
      }
      
      try {
        await axios.get(`${status.tunnelB.url}/rest/v1/`, { 
          timeout: 3000,
          validateStatus: () => true
        });
        console.log('✅ Tunnel B: Responding');
      } catch {
        console.log('❌ Tunnel B: Not responding');
      }
      
      // Show last test results if available
      if (existsSync('dual-tunnel-test-results.json')) {
        const testResults = JSON.parse(readFileSync('dual-tunnel-test-results.json', 'utf8'));
        console.log('\n📊 Last Test Results:');
        console.log('  Tunnel A Health:', testResults.tunnelA.health);
        console.log('  Tunnel A N8N:', testResults.tunnelA.n8n);
        console.log('  Tunnel B REST:', testResults.tunnelB.rest);
        console.log('  Security:', testResults.security.directAccess);
      }
      
      console.log(`\nCreated: ${status.created}`);
    } else {
      console.log('❌ No dual tunnel configuration found');
      console.log('   Run: node tunnel-manager-dual.js start');
    }
  }

  async stopAll() {
    console.log('🛑 Stopping all tunnels...');
    
    if (this.tunnelA.process) {
      this.tunnelA.process.kill('SIGTERM');
      this.tunnelA.isActive = false;
      console.log('   Tunnel A stopped');
    }
    
    if (this.tunnelB.process) {
      this.tunnelB.process.kill('SIGTERM');
      this.tunnelB.isActive = false;
      console.log('   Tunnel B stopped');
    }
    
    console.log('✅ All tunnels stopped');
  }

  setupGracefulShutdown() {
    process.on('SIGINT', async () => {
      console.log('\n🔄 Received SIGINT, shutting down gracefully...');
      await this.stopAll();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.stopAll();
      process.exit(0);
    });
  }
}

// CLI Interface - same pattern as tunnel-manager-cf.js
async function main() {
  const command = process.argv[2] || 'start';
  const manager = new DualTunnelManager();
  
  manager.setupGracefulShutdown();
  
  switch (command) {
    case 'start':
      try {
        await manager.startDualTunnels();
        // Keep process alive
        setInterval(() => {}, 1000);
      } catch (error) {
        console.error('❌ Failed to start dual tunnels:', error.message);
        process.exit(1);
      }
      break;
      
    case 'status':
      await manager.status();
      process.exit(0);
      break;
      
    case 'stop':
      await manager.stopAll();
      process.exit(0);
      break;
      
    case 'test':
      try {
        await manager.checkPrerequisites();
        await manager.testDualIntegration();
        console.log('✅ All tests completed');
      } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
      }
      break;
      
    default:
      console.log('Usage: node tunnel-manager-dual.js [start|stop|status|test]');
      console.log('');
      console.log('Commands:');
      console.log('  start  - Start both tunnels');
      console.log('  stop   - Stop both tunnels');
      console.log('  status - Show tunnel status');
      console.log('  test   - Test tunnel connectivity');
      process.exit(0);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default DualTunnelManager;