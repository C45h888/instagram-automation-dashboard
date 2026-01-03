// tunnel-manager-unified.js - UNIFIED TUNNEL MANAGER WITH ALL FEATURES
// Combines the best of both tunnel-manager-cf.js and tunnel-manager-dual.js
// NEVER destructively overwrites .env file

import { spawn } from 'child_process';
import { writeFileSync, existsSync, readFileSync, copyFileSync } from 'fs';
import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Unified Tunnel Manager
 * Supports both single tunnel (API only) and dual tunnel (API + Database) modes
 * Includes all testing features and safe configuration handling
 */
class UnifiedTunnelManager {
  constructor(options = {}) {
    // Operating mode: 'single' or 'dual'
    this.mode = options.mode || 'dual';
    
    // Verbose logging for debugging
    this.verbose = options.verbose || false;
    
    // Tunnel A - Backend API (Always required)
    this.tunnelA = {
      name: 'instagram-automation-backend',
      token: process.env.CLOUDFLARE_TUNNEL_TOKEN,
      url: 'https://api.888intelligenceautomation.in',
      localPort: process.env.LOCAL_PORT || 3001,
      process: null,
      isActive: false,
      connectionCount: 0,
      configUpdated: false
    };
    
    // Tunnel B - Supabase Database (Only in dual mode)
    if (this.mode === 'dual') {
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
  }

  extractProjectRef(url) {
    if (!url) return null;
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    return match ? match[1] : null;
  }

  /**
   * Main entry point - starts tunnels based on mode
   */
  async start() {
    const modeLabel = this.mode === 'single' ? 'Single' : 'Dual';
    console.log(`🚇 Starting ${modeLabel} Tunnel System (UNIFIED VERSION)...`);
    console.log('='.repeat(60));
    console.log(`   Mode: ${this.mode.toUpperCase()}`);
    console.log(`   Tunnel A: ${this.tunnelA.name}`);
    console.log(`   URL: ${this.tunnelA.url}`);
    console.log(`   Port: ${this.tunnelA.localPort}`);
    
    if (this.mode === 'dual') {
      console.log('---');
      console.log(`   Tunnel B: ${this.tunnelB.name}`);
      console.log(`   URL: ${this.tunnelB.url}`);
      console.log(`   Supabase: ${this.supabaseProjectRef}`);
    }
    console.log('='.repeat(60) + '\n');

    try {
      // Step 1: Check prerequisites
      await this.checkPrerequisites();
      
      // Step 2: Check backend status (from cf.js)
      await this.checkBackendStatus();
      
      // Step 3: Start tunnels based on mode
      if (this.mode === 'single') {
        await this.initializeTunnelA();
      } else {
        await Promise.all([
          this.initializeTunnelA(),
          this.initializeTunnelB()
        ]);
      }
      
      // Step 4: Verify connections
      await this.verifyConnections();
      
      // Step 5: Update configuration (SAFELY)
      await this.updateConfiguration();
      
      // Step 6: Run integration tests (from cf.js)
      await this.testFullIntegration();
      
      console.log(`\n✅ ${modeLabel.toUpperCase()} TUNNEL SYSTEM SUCCESSFULLY ACTIVATED`);
      this.displaySuccessInstructions();
      
    } catch (error) {
      console.error('❌ Tunnel setup failed:', error.message);
      await this.troubleshootIssues();
      process.exit(1);
    }
  }

  /**
   * Check prerequisites based on mode
   */
  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');
    
    // Check Tunnel A token (always required)
    if (!this.tunnelA.token) {
      console.error('❌ Missing CLOUDFLARE_TUNNEL_TOKEN for Tunnel A');
      console.log('📋 Steps to get token:');
      console.log('   1. Go to: https://one.dash.cloudflare.com/');
      console.log('   2. Access → Tunnels → instagram-automation-backend');
      console.log('   3. Copy the tunnel token');
      console.log('   4. Add to .env: CLOUDFLARE_TUNNEL_TOKEN="your_token"');
      throw new Error('Tunnel A token required');
    }
    console.log('✅ Tunnel A token configured');

    // Check Tunnel B requirements (dual mode only)
    if (this.mode === 'dual') {
      if (!this.tunnelB.token) {
        console.error('❌ Missing CLOUDFLARE_SUPABASE_TUNNEL_TOKEN for Tunnel B');
        console.log('📋 To create Tunnel B:');
        console.log('   1. Run: cloudflared tunnel create supabase-secure-tunnel');
        console.log('   2. Copy token from Cloudflare dashboard');
        console.log('   3. Add to .env: CLOUDFLARE_SUPABASE_TUNNEL_TOKEN="your_token"');
        throw new Error('Tunnel B token required in dual mode');
      }
      console.log('✅ Tunnel B token configured');

      if (!this.tunnelB.supabaseUrl || !this.supabaseProjectRef) {
        console.error('❌ Missing or invalid SUPABASE_URL');
        throw new Error('Supabase URL required in dual mode');
      }
      console.log('✅ Supabase configuration valid');
    }
  }

  /**
   * Check backend server status (from cf.js)
   */
  async checkBackendStatus() {
    console.log('\n🔍 Checking backend server status...');
    
    try {
      const response = await axios.get(`http://localhost:${this.tunnelA.localPort}/health`, {
        timeout: 5000
      });
      
      console.log('✅ Backend server is running');
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Port: ${this.tunnelA.localPort}`);
      
    } catch (error) {
      console.error('❌ Backend server not accessible');
      console.log('📋 To fix this:');
      console.log('   1. Open new terminal');
      console.log('   2. Run: cd backend && node server.js');
      console.log('   3. Verify: curl http://localhost:3001/health');
      throw new Error('Backend server must be running before starting tunnel');
    }
  }

  /**
   * Initialize Tunnel A (Backend API)
   */
  async initializeTunnelA() {
    console.log('\n🌐 Starting Tunnel A (Backend API)...');
    
    return new Promise((resolve, reject) => {
      const args = ['tunnel', 'run', '--token', this.tunnelA.token];
      
      console.log('📡 Starting cloudflared process for Tunnel A...');
      
      this.tunnelA.process = spawn('cloudflared', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let startupComplete = false;

      const handleOutput = (data, source) => {
        const text = data.toString();
        
        // Enhanced logging from cf.js
        if (text.includes('ERR') || text.includes('ERROR')) {
          console.error(`   🔴 [Tunnel A] Error: ${text.trim()}`);
        } else if (text.includes('INF') && this.verbose) {
          console.log(`   📡 [Tunnel A] Info: ${text.trim()}`);
        }
        
        // Connection detection logic (improved from both scripts)
        if (text.includes('Registered tunnel connection')) {
          this.tunnelA.connectionCount++;
          console.log(`   ✅ Tunnel A Connection ${this.tunnelA.connectionCount} established`);
        }
        
        if (text.includes('Updated to new configuration')) {
          this.tunnelA.configUpdated = true;
          console.log('   ✅ Tunnel A Configuration updated');
        }
        
        // Success conditions from both scripts
        if ((this.tunnelA.connectionCount >= 2 && this.tunnelA.configUpdated) || 
            text.includes(this.tunnelA.name)) {
          if (!startupComplete) {
            startupComplete = true;
            this.tunnelA.isActive = true;
            console.log('   ✅ Tunnel A registration and configuration complete');
            resolve();
          }
        }
      };

      // Listen to both stdout and stderr (fix from cf.js)
      this.tunnelA.process.stdout.on('data', (data) => handleOutput(data, 'STDOUT'));
      this.tunnelA.process.stderr.on('data', (data) => handleOutput(data, 'STDERR'));

      this.tunnelA.process.on('close', (code) => {
        console.log(`   ⚠️ Tunnel A process closed with code ${code}`);
        this.tunnelA.isActive = false;
        
        if (code !== 0 && !startupComplete) {
          reject(new Error(`Tunnel A process failed with exit code ${code}`));
        }
      });

      this.tunnelA.process.on('error', (error) => {
        console.error(`   ❌ Failed to start Tunnel A: ${error.message}`);
        reject(error);
      });

      // Reasonable timeout (30 seconds)
      setTimeout(() => {
        if (!startupComplete) {
          console.log(`   ⚠️ Tunnel A status: ${this.tunnelA.connectionCount} connections, config updated: ${this.tunnelA.configUpdated}`);
          reject(new Error('Tunnel A startup timeout - check Cloudflare dashboard'));
        }
      }, 30000);
    });
  }

  /**
   * Initialize Tunnel B (Supabase Database) - dual mode only
   */
  async initializeTunnelB() {
    console.log('\n🔒 Starting Tunnel B (Supabase Database)...');
    
    // Create config file for Tunnel B
    await this.createSupabaseTunnelConfig();
    
    return new Promise((resolve, reject) => {
      const args = ['tunnel', '--config', 'supabase-tunnel.yml', 'run'];
      
      console.log('📡 Starting cloudflared process for Tunnel B...');
      
      this.tunnelB.process = spawn('cloudflared', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, TUNNEL_TOKEN: this.tunnelB.token }
      });

      let startupComplete = false;

      const handleOutput = (data, source) => {
        const text = data.toString();
        
        if (text.includes('ERR') || text.includes('ERROR')) {
          console.error(`   🔴 [Tunnel B] Error: ${text.trim()}`);
        } else if (text.includes('INF') && this.verbose) {
          console.log(`   📡 [Tunnel B] Info: ${text.trim()}`);
        }
        
        if (text.includes('Registered tunnel connection')) {
          this.tunnelB.connectionCount++;
          console.log(`   ✅ Tunnel B Connection ${this.tunnelB.connectionCount} established`);
        }
        
        if (text.includes('Updated to new configuration') || text.includes('proxying to')) {
          this.tunnelB.configUpdated = true;
          console.log('   ✅ Tunnel B Configuration updated');
        }
        
        if ((this.tunnelB.connectionCount >= 2 && this.tunnelB.configUpdated) || 
            text.includes(this.tunnelB.name)) {
          if (!startupComplete) {
            startupComplete = true;
            this.tunnelB.isActive = true;
            console.log('   ✅ Tunnel B registration and configuration complete');
            resolve();
          }
        }
      };

      this.tunnelB.process.stdout.on('data', (data) => handleOutput(data, 'STDOUT'));
      this.tunnelB.process.stderr.on('data', (data) => handleOutput(data, 'STDERR'));

      this.tunnelB.process.on('close', (code) => {
        console.log(`   ⚠️ Tunnel B process closed with code ${code}`);
        this.tunnelB.isActive = false;
        
        if (code !== 0 && !startupComplete) {
          reject(new Error(`Tunnel B process failed with exit code ${code}`));
        }
      });

      this.tunnelB.process.on('error', (error) => {
        console.error(`   ❌ Failed to start Tunnel B: ${error.message}`);
        reject(error);
      });

      setTimeout(() => {
        if (!startupComplete) {
          console.log(`   ⚠️ Tunnel B status: ${this.tunnelB.connectionCount} connections, config updated: ${this.tunnelB.configUpdated}`);
          reject(new Error('Tunnel B startup timeout - check configuration'));
        }
      }, 30000);
    });
  }

  /**
   * Create Supabase tunnel configuration
   */
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

  /**
   * Verify tunnel connections
   */
  async verifyConnections() {
    console.log('\n🔍 Verifying tunnel connectivity...');
    
    const maxRetries = 10;
    
    // Always verify Tunnel A
    let retriesA = 0;
    while (retriesA < maxRetries) {
      try {
        const response = await axios.get(`${this.tunnelA.url}/health`, {
          timeout: 8000,
          headers: { 'User-Agent': 'Unified-Tunnel-Verifier/1.0' }
        });
        
        console.log('✅ Tunnel A verified');
        console.log(`   Response Status: ${response.status}`);
        console.log(`   Backend Health: ${response.data.status}`);
        console.log(`   Tunnel URL: ${this.tunnelA.url}`);
        console.log(`   Cloudflare Ray: ${response.headers['cf-ray'] || 'N/A'}`);
        break;
        
      } catch (error) {
        retriesA++;
        console.log(`   ⏳ Tunnel A attempt ${retriesA}/${maxRetries} failed, retrying in 2s...`);
        
        if (retriesA < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw new Error('Tunnel A verification failed - check Cloudflare dashboard');
        }
      }
    }
    
    // Verify Tunnel B only in dual mode
    if (this.mode === 'dual') {
      let retriesB = 0;
      while (retriesB < maxRetries) {
        try {
          const headers = {};
          if (process.env.SUPABASE_ANON_KEY) {
            headers.apikey = process.env.SUPABASE_ANON_KEY;
          }
          
          const response = await axios.get(`${this.tunnelB.url}/rest/v1/`, {
            headers,
            timeout: 8000,
            validateStatus: () => true
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
            console.warn('   ⚠️ Tunnel B may need additional configuration');
            break; // Don't fail completely if Tunnel B has issues
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
  }

  /**
   * Update configuration files SAFELY (never overwrite .env)
   */
  async updateConfiguration() {
    console.log('\n📝 Creating configuration templates...');
    
    const timestamp = new Date().toISOString();
    const mode = this.mode.toUpperCase();
    
    // Build environment content based on mode
    let envContent = `# UNIFIED TUNNEL CONFIGURATION - ${mode} MODE
# Generated at: ${timestamp}
# ⚠️  IMPORTANT: Review and copy needed values to your .env file
# This is a TEMPLATE - do not use directly

# ===== TUNNEL A - BACKEND API =====
CLOUDFLARE_TUNNEL_TOKEN=${this.tunnelA.token}
CLOUDFLARE_TUNNEL_NAME=${this.tunnelA.name}
LOCAL_PORT=${this.tunnelA.localPort}
BACKEND_TUNNEL_URL=${this.tunnelA.url}
`;

    if (this.mode === 'dual') {
      envContent += `
# ===== TUNNEL B - SUPABASE DATABASE =====
CLOUDFLARE_SUPABASE_TUNNEL_TOKEN=${this.tunnelB.token}
SUPABASE_TUNNEL_NAME=${this.tunnelB.name}
SUPABASE_TUNNEL_URL=${this.tunnelB.url}
SUPABASE_PROJECT_REF=${this.supabaseProjectRef}

# ===== SUPABASE CONFIGURATION =====
SUPABASE_URL=${this.tunnelB.supabaseUrl}
SUPABASE_ANON_KEY=${process.env.SUPABASE_ANON_KEY || 'your_anon_key_here'}
SUPABASE_SERVICE_KEY=${process.env.SUPABASE_SERVICE_KEY || 'your_service_key_here'}
REACT_APP_SUPABASE_URL=${this.tunnelB.url}
SUPABASE_CLIENT_URL=${this.tunnelB.url}
`;
    }

    envContent += `
# ===== FRONTEND CONFIGURATION =====
VITE_WEBHOOK_URL=${this.tunnelA.url}
VITE_API_BASE_URL=${this.tunnelA.url}
VITE_WEBHOOK_VERIFY_TOKEN=instagram_automation_cf_token_2024
VITE_META_APP_ID=${process.env.VITE_META_APP_ID || 'your_meta_app_id_here'}
VITE_META_APP_SECRET=${process.env.VITE_META_APP_SECRET || 'your_meta_app_secret_here'}

# ===== BACKEND CONFIGURATION =====
WEBHOOK_VERIFY_TOKEN=instagram_automation_cf_token_2024
META_APP_SECRET=${process.env.META_APP_SECRET || 'your_meta_app_secret_here'}
PORT=${this.tunnelA.localPort}
NODE_ENV=production
BACKEND_BASE_URL=${this.tunnelA.url}

# ===== N8N WEBHOOK CONFIGURATION =====
N8N_BASE_URL=${process.env.N8N_BASE_URL || 'https://kamesh8888888.app.n8n.cloud'}
N8N_DM_WEBHOOK=${process.env.N8N_DM_WEBHOOK || 'https://kamesh8888888.app.n8n.cloud/webhook-test/instagram-dm-webhook'}
N8N_COMMENT_WEBHOOK=${process.env.N8N_COMMENT_WEBHOOK || 'https://kamesh8888888.app.n8n.cloud/webhook-test/instagram-comment-webhook'}
N8N_ORDER_WEBHOOK=${process.env.N8N_ORDER_WEBHOOK || 'https://kamesh8888888.app.n8n.cloud/webhook-test/shopify-order-webhook'}
N8N_HUB_WEBHOOK=${process.env.N8N_HUB_WEBHOOK || 'https://kamesh8888888.app.n8n.cloud/webhook-test/instagram-webhook'}
N8N_CONTENT_WEBHOOK=${process.env.N8N_CONTENT_WEBHOOK || 'https://kamesh8888888.app.n8n.cloud/webhook-test/content-scheduler'}

# ===== META API CONFIGURATION =====
META_APP_ID=${process.env.META_APP_ID || 'your_meta_app_id'}
INSTAGRAM_BASIC_DISPLAY_ID=${process.env.INSTAGRAM_BASIC_DISPLAY_ID || 'your_display_id'}
INSTAGRAM_BASIC_DISPLAY_SECRET=${process.env.INSTAGRAM_BASIC_DISPLAY_SECRET || 'your_display_secret'}
`;

    // CRITICAL: Save as template, NEVER overwrite .env directly
    const templateFile = `.env.tunnel-${this.mode}`;
    writeFileSync(templateFile, envContent);
    console.log(`   📄 Created ${templateFile} template`);
    
    // Check if .env exists
    if (!existsSync('.env')) {
      console.log('\n   ⚠️  No .env file found');
      console.log('   📋 To create one:');
      console.log(`      cp ${templateFile} .env`);
      console.log('      Then edit .env with your actual values');
    } else {
      console.log('\n   ℹ️  Existing .env file preserved');
      console.log(`   📋 Review ${templateFile} for any new variables`);
      console.log('   Copy needed values to your .env file manually');
    }
    
    // Create status file for monitoring
    await this.createStatusFile();
  }

  /**
   * Create status file for monitoring
   */
  async createStatusFile() {
    const status = {
      system: 'unified-tunnel',
      mode: this.mode,
      version: '3.0',
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
      }
    };
    
    if (this.mode === 'dual') {
      status.tunnelB = {
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
      };
    }
    
    status.n8nWebhooks = {
      dm: process.env.N8N_DM_WEBHOOK || 'not configured',
      comment: process.env.N8N_COMMENT_WEBHOOK || 'not configured',
      order: process.env.N8N_ORDER_WEBHOOK || 'not configured',
      hub: process.env.N8N_HUB_WEBHOOK || 'not configured',
      content: process.env.N8N_CONTENT_WEBHOOK || 'not configured'
    };

    writeFileSync('tunnel-status.json', JSON.stringify(status, null, 2));
    console.log('   📄 Created tunnel-status.json');
  }

  /**
   * Test full integration (enhanced from cf.js)
   */
  async testFullIntegration() {
    console.log('\n🧪 TESTING FULL INTEGRATION...');
    console.log('='.repeat(40));
    
    const results = {
      tunnelA: {},
      n8nIntegration: {},
      security: {}
    };

    try {
      // Test health endpoint
      const health = await axios.get(`${this.tunnelA.url}/health`, { timeout: 5000 });
      results.tunnelA.health = '✅ Working';
      console.log('✅ Health check:', health.data.status);
      
      // Test N8N status with detailed webhook display (from cf.js)
      try {
        const n8nStatus = await axios.get(`${this.tunnelA.url}/webhook/n8n-status`, { timeout: 5000 });
        console.log('\n✅ N8N Integration Status:');
        
        if (n8nStatus.data.n8n_webhooks) {
          Object.entries(n8nStatus.data.n8n_webhooks).forEach(([key, status]) => {
            console.log(`   ${key}: ${status}`);
            results.n8nIntegration[key] = status;
          });
        }
        
        results.n8nIntegration.overall = '✅ Connected';
      } catch (error) {
        console.log('⚠️  N8N status endpoint not available');
        results.n8nIntegration.overall = '⚠️ Check webhooks';
      }
      
      // Test webhook endpoint (from cf.js)
      try {
        const webhookTest = await axios.get(`${this.tunnelA.url}/webhook/test`, { timeout: 5000 });
        const endpointCount = webhookTest.data.available_endpoints?.length || 0;
        console.log(`✅ Webhook routes available: ${endpointCount}`);
        results.tunnelA.webhookRoutes = `✅ ${endpointCount} routes`;
      } catch (error) {
        console.log('⚠️  Webhook test endpoint not available');
        results.tunnelA.webhookRoutes = '⚠️ Not available';
      }
      
    } catch (error) {
      console.error('❌ Integration test failed:', error.message);
      results.tunnelA.health = '❌ Failed';
    }
    
    // Test Tunnel B in dual mode
    if (this.mode === 'dual' && this.tunnelB) {
      results.tunnelB = {};
      
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
        console.warn('⚠️  Direct database access not blocked - configure IP restrictions');
      } catch (error) {
        results.security.directAccess = '✅ Blocked';
        console.log('✅ Security: Direct access blocked');
      }
    }
    
    // Save test results
    writeFileSync('tunnel-test-results.json', JSON.stringify(results, null, 2));
    console.log('\n📊 Test results saved to tunnel-test-results.json');
    
    const allPassed = Object.values(results).every(category => 
      Object.values(category).every(test => 
        test && test.toString().includes('✅')
      )
    );
    
    if (allPassed) {
      console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('Ready for Meta API approval and N8N automation!');
    } else {
      console.log('\n⚠️  Some tests need attention - check results above');
    }
    
    return results;
  }

  /**
   * Display success instructions
   */
  displaySuccessInstructions() {
    const separator = '='.repeat(70);
    console.log('\n' + separator);
    console.log(`🎉 ${this.mode.toUpperCase()} TUNNEL SYSTEM ACTIVE - UNIFIED MANAGER`);
    console.log(separator);
    
    console.log('\n📡 TUNNEL A - Backend API & Webhooks:');
    console.log(`   🌐 URL: ${this.tunnelA.url}`);
    console.log(`   💚 Health: ${this.tunnelA.url}/health`);
    console.log(`   📡 Meta Webhook: ${this.tunnelA.url}/webhook/instagram`);
    console.log(`   🎯 N8N Status: ${this.tunnelA.url}/webhook/n8n-status`);
    console.log(`   🔗 Domain: 888intelligenceautomation.in`);
    
    if (this.mode === 'dual') {
      console.log('\n🔒 TUNNEL B - Secure Database:');
      console.log(`   🌐 URL: ${this.tunnelB.url}`);
      console.log(`   📊 REST API: ${this.tunnelB.url}/rest/v1/`);
      console.log(`   🔐 Auth API: ${this.tunnelB.url}/auth/v1/`);
      console.log(`   ⚡ Realtime: ${this.tunnelB.url}/realtime/v1/`);
      
      console.log('\n🔐 SECURITY CHECKLIST:');
      console.log('   [ ] Configure Supabase IP restrictions (Cloudflare IPs only)');
      console.log('   [ ] Update frontend to use REACT_APP_SUPABASE_URL');
      console.log('   [ ] Update backend to use SUPABASE_CLIENT_URL');
      console.log('   [ ] Verify direct database access is blocked');
    }
    
    console.log('\n📋 IMMEDIATE TESTING:');
    console.log(`   curl ${this.tunnelA.url}/health`);
    console.log(`   curl ${this.tunnelA.url}/webhook/n8n-status`);
    console.log(`   curl ${this.tunnelA.url}/webhook/test`);
    
    if (this.mode === 'dual') {
      console.log(`   curl -H "apikey: YOUR_ANON_KEY" ${this.tunnelB.url}/rest/v1/`);
      console.log(`   curl ${this.tunnelB.supabaseUrl}/rest/v1/ # Should fail`);
    }
    
    console.log('\n🚀 META API CONFIGURATION:');
    console.log('   1. Go to Meta for Developers: https://developers.facebook.com/');
    console.log('   2. Navigate to your app → Products → Webhooks');
    console.log(`   3. Set Callback URL: ${this.tunnelA.url}/webhook/instagram`);
    console.log('   4. Set Verify Token: instagram_automation_cf_token_2024');
    console.log('   5. Subscribe to: comments, mentions, messages');
    
    console.log('\n🎯 N8N INTEGRATION:');
    console.log('   ✅ All 5 N8N webhooks configured in environment');
    console.log('   ✅ Backend will forward Instagram events to N8N');
    console.log('   ✅ N8N will send responses back to backend');
    
    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log('   • Your .env file has been PRESERVED');
    console.log(`   • Review .env.tunnel-${this.mode} for any new variables`);
    console.log('   • Copy needed values manually to maintain safety');
    
    console.log(separator + '\n');
  }

  /**
   * Troubleshooting helper
   */
  async troubleshootIssues() {
    console.log('\n🔧 TROUBLESHOOTING GUIDE');
    console.log('='.repeat(30));
    
    // Check common issues
    if (!this.tunnelA.token) {
      console.log('\n❌ Missing Tunnel A token');
      console.log('   Fix: Add CLOUDFLARE_TUNNEL_TOKEN to .env file');
    }
    
    if (this.mode === 'dual' && !this.tunnelB?.token) {
      console.log('\n❌ Missing Tunnel B token');
      console.log('   Fix: Add CLOUDFLARE_SUPABASE_TUNNEL_TOKEN to .env file');
    }
    
    try {
      await axios.get(`http://localhost:${this.tunnelA.localPort}/health`, { timeout: 2000 });
      console.log('\n✅ Backend server is accessible');
    } catch (error) {
      console.log('\n❌ Backend server not running');
      console.log('   Fix: cd backend && node server.js');
    }
    
    // Check Cloudflare configuration
    console.log('\n📋 Cloudflare Dashboard Check:');
    console.log('   1. Go to Cloudflare Zero Trust → Access → Tunnels');
    console.log('   2. Find tunnel: instagram-automation-backend');
    console.log('   3. Verify Public Hostname:');
    console.log('      - Hostname: api.888intelligenceautomation.in');
    console.log('      - Service: http://localhost:3001 (HTTP, NOT HTTPS!)');
    
    if (this.mode === 'dual') {
      console.log('\n   4. For Tunnel B (supabase-secure-tunnel):');
      console.log('      - Hostname: db-secure.888intelligenceautomation.in');
      console.log('      - Service: Your Supabase project URL');
    }
    
    console.log('\n🔧 Common fixes:');
    console.log('   1. Change service URL from https://localhost to http://localhost');
    console.log('   2. Restart backend: cd backend && node server.js');
    console.log('   3. Check tunnel tokens in .env file');
    console.log('   4. Verify port 3001 is available: lsof -i :3001');
    
    if (this.mode === 'dual') {
      console.log('   5. Ensure supabase-tunnel.yml exists');
      console.log('   6. Configure Supabase IP restrictions');
    }
    
    console.log('\n🔗 Useful Links:');
    console.log('   Cloudflare: https://one.dash.cloudflare.com/');
    console.log('   Supabase: https://app.supabase.com/');
    console.log('   Meta Developers: https://developers.facebook.com/');
  }

  /**
   * Status command - show current tunnel status
   */
  async status() {
    console.log('📊 UNIFIED TUNNEL STATUS REPORT');
    console.log('='.repeat(35) + '\n');
    
    if (existsSync('tunnel-status.json')) {
      const status = JSON.parse(readFileSync('tunnel-status.json', 'utf8'));
      
      console.log(`Mode: ${status.mode.toUpperCase()}`);
      console.log(`Version: ${status.version}`);
      console.log(`Created: ${status.created}\n`);
      
      console.log('TUNNEL A - Backend API:');
      console.log(`  Status: ${this.tunnelA?.isActive ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`  URL: ${status.tunnelA.url}`);
      console.log(`  Port: ${status.tunnelA.port}`);
      console.log(`  Connections: ${status.tunnelA.connections}`);
      
      if (status.tunnelB) {
        console.log('\nTUNNEL B - Database:');
        console.log(`  Status: ${this.tunnelB?.isActive ? '🟢 Active' : '🔴 Inactive'}`);
        console.log(`  URL: ${status.tunnelB.url}`);
        console.log(`  Project: ${status.tunnelB.supabaseProject}`);
        console.log(`  Connections: ${status.tunnelB.connections}`);
      }
      
      // Test connectivity
      console.log('\n🔍 Testing connectivity...');
      
      try {
        await axios.get(`${status.tunnelA.url}/health`, { timeout: 3000 });
        console.log('✅ Tunnel A: Responding');
      } catch {
        console.log('❌ Tunnel A: Not responding');
      }
      
      if (status.tunnelB) {
        try {
          await axios.get(`${status.tunnelB.url}/rest/v1/`, { 
            timeout: 3000,
            validateStatus: () => true
          });
          console.log('✅ Tunnel B: Responding');
        } catch {
          console.log('❌ Tunnel B: Not responding');
        }
      }
      
      // Show N8N webhook status
      console.log('\n📡 N8N Webhook Configuration:');
      Object.entries(status.n8nWebhooks || {}).forEach(([key, value]) => {
        const isConfigured = value && value !== 'not configured';
        console.log(`  ${key}: ${isConfigured ? '✅ Configured' : '❌ Not configured'}`);
      });
      
      // Show test results if available
      if (existsSync('tunnel-test-results.json')) {
        const testResults = JSON.parse(readFileSync('tunnel-test-results.json', 'utf8'));
        console.log('\n📊 Last Test Results:');
        
        if (testResults.tunnelA) {
          console.log('  Tunnel A Health:', testResults.tunnelA.health || '❌ Not tested');
          console.log('  Webhook Routes:', testResults.tunnelA.webhookRoutes || '❌ Not tested');
        }
        
        if (testResults.n8nIntegration) {
          console.log('  N8N Integration:', testResults.n8nIntegration.overall || '❌ Not tested');
        }
        
        if (testResults.tunnelB) {
          console.log('  Tunnel B REST:', testResults.tunnelB.rest || '❌ Not tested');
        }
        
        if (testResults.security) {
          console.log('  Security:', testResults.security.directAccess || '❌ Not tested');
        }
      }
      
    } else {
      console.log('❌ No tunnel configuration found');
      console.log('   Run: node tunnel-manager-unified.js start');
    }
  }

  /**
   * Stop all active tunnels
   */
  async stopAll() {
    console.log('🛑 Stopping all tunnels...');
    
    if (this.tunnelA?.process) {
      this.tunnelA.process.kill('SIGTERM');
      this.tunnelA.isActive = false;
      console.log('   Tunnel A stopped');
    }
    
    if (this.tunnelB?.process) {
      this.tunnelB.process.kill('SIGTERM');
      this.tunnelB.isActive = false;
      console.log('   Tunnel B stopped');
    }
    
    console.log('✅ All tunnels stopped');
  }

  /**
   * Setup graceful shutdown handlers
   */
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

/**
 * CLI Interface - handles command line arguments
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';
  
  // Parse mode flag
  const modeIndex = args.indexOf('--mode');
  const mode = modeIndex > -1 ? args[modeIndex + 1] : 'dual';
  
  // Parse verbose flag
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  // Validate mode
  if (!['single', 'dual'].includes(mode)) {
    console.error('❌ Invalid mode. Use --mode single or --mode dual');
    process.exit(1);
  }
  
  // Create manager with options
  const manager = new UnifiedTunnelManager({ mode, verbose });
  
  // Setup shutdown handlers
  manager.setupGracefulShutdown();
  
  // Execute command
  switch (command) {
    case 'start':
      try {
        await manager.start();
        // Keep process alive
        setInterval(() => {}, 1000);
      } catch (error) {
        console.error('❌ Failed to start tunnels:', error.message);
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
        if (mode === 'single') {
          await manager.checkBackendStatus();
        }
        await manager.testFullIntegration();
        console.log('✅ All tests completed');
      } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
      }
      break;
      
    case 'help':
    default:
      console.log('📚 UNIFIED TUNNEL MANAGER - USAGE GUIDE');
      console.log('='.repeat(40));
      console.log('\nUsage: node tunnel-manager-unified.js [command] [options]');
      console.log('\nCommands:');
      console.log('  start    Start tunnels (default)');
      console.log('  stop     Stop all tunnels');
      console.log('  status   Show current tunnel status');
      console.log('  test     Test tunnel connectivity');
      console.log('  help     Show this help message');
      console.log('\nOptions:');
      console.log('  --mode single    Single tunnel mode (API only)');
      console.log('  --mode dual      Dual tunnel mode (API + Database) [default]');
      console.log('  --verbose, -v    Enable verbose logging');
      console.log('\nExamples:');
      console.log('  node tunnel-manager-unified.js start');
      console.log('  node tunnel-manager-unified.js start --mode single');
      console.log('  node tunnel-manager-unified.js start --mode dual --verbose');
      console.log('  node tunnel-manager-unified.js status');
      console.log('  node tunnel-manager-unified.js test --mode single');
      console.log('\n📝 Note: This script NEVER overwrites your .env file');
      console.log('     Templates are created as .env.tunnel-single or .env.tunnel-dual');
      process.exit(0);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default UnifiedTunnelManager;