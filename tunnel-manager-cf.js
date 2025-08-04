// tunnel-manager-cf.js - ES MODULE VERSION FOR CLOUDFLARE
import { spawn } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables
config();

class CloudflareTunnelManager {
  constructor() {
    this.tunnelToken = process.env.CLOUDFLARE_TUNNEL_TOKEN;
    this.tunnelName = 'instagram-automation-backend';
    this.localPort = process.env.LOCAL_PORT || 3001;
    this.tunnelProcess = null;
    this.tunnelUrl = 'https://instagram-backend.888intelligenceautomation.in';
    this.isActive = false;
  }

  async startTunnel() {
    console.log('🌐 Starting Cloudflare Tunnel Manager (ES Module)...');
    console.log('==========================================');
    console.log(`   Tunnel Name: ${this.tunnelName}`);
    console.log(`   Local Port: ${this.localPort}`);
    console.log(`   Expected URL: ${this.tunnelUrl}`);
    console.log('==========================================\n');

    if (!this.tunnelToken) {
      console.error('❌ CLOUDFLARE_TUNNEL_TOKEN environment variable required');
      console.log('📋 Steps to get your token:');
      console.log('   1. Go to: https://one.dash.cloudflare.com/');
      console.log('   2. Access → Tunnels → instagram-automation-backend');
      console.log('   3. Copy the tunnel token');
      console.log('   4. Add to .env file: CLOUDFLARE_TUNNEL_TOKEN="your_token"');
      process.exit(1);
    }

    try {
      // Check if backend is running first
      await this.checkBackendStatus();
      
      // Start the tunnel
      await this.initializeTunnel();
      
      // Verify tunnel connectivity
      await this.verifyTunnelConnection();
      
      // Update project configuration
      await this.updateProjectConfiguration();
      
      console.log('✅ CLOUDFLARE TUNNEL SUCCESSFULLY ACTIVATED');
      this.displaySuccessInstructions();
      
    } catch (error) {
      console.error('❌ Tunnel setup failed:', error.message);
      await this.troubleshootIssues();
      process.exit(1);
    }
  }

  async checkBackendStatus() {
    console.log('🔍 Checking backend server status...');
    
    try {
      const response = await axios.get(`http://localhost:${this.localPort}/health`, {
        timeout: 5000
      });
      
      console.log('✅ Backend server is running');
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Port: ${this.localPort}`);
      
    } catch (error) {
      console.error('❌ Backend server not accessible');
      console.log('📋 To fix this:');
      console.log('   1. Open new terminal in StackBlitz');
      console.log('   2. Run: npm run backend');
      console.log('   3. Verify: curl http://localhost:3001/health');
      throw new Error('Backend server must be running before starting tunnel');
    }
  }

  async initializeTunnel() {
    console.log('🚀 Initializing Cloudflare tunnel...');
    
    return new Promise((resolve, reject) => {
      const args = [
        'tunnel',
        'run', 
        '--token',
        this.tunnelToken
      ];

      console.log('📡 Starting cloudflared process...');
      
      this.tunnelProcess = spawn('cloudflared', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let startupComplete = false;
      let outputBuffer = '';

      this.tunnelProcess.stdout.on('data', (data) => {
        const text = data.toString();
        outputBuffer += text;
        
        // Log important messages
        if (text.includes('ERR') || text.includes('ERROR')) {
          console.error(`🔴 Error: ${text.trim()}`);
        } else if (text.includes('INF')) {
          console.log(`📡 Info: ${text.trim()}`);
        }
        
        // Check for successful connection indicators
        if (text.includes('registered') || 
            text.includes('connection established') ||
            text.includes('started') ||
            text.includes(this.tunnelName)) {
          
          if (!startupComplete) {
            startupComplete = true;
            this.isActive = true;
            console.log('✅ Tunnel registration successful');
            resolve();
          }
        }
      });

      this.tunnelProcess.stderr.on('data', (data) => {
        const text = data.toString();
        console.error(`❌ Tunnel Error: ${text.trim()}`);
        
        if (text.includes('failed to authenticate')) {
          reject(new Error('Invalid tunnel token - check your CLOUDFLARE_TUNNEL_TOKEN'));
        }
      });

      this.tunnelProcess.on('close', (code) => {
        console.log(`⚠️ Tunnel process closed with code ${code}`);
        this.isActive = false;
        
        if (code !== 0 && !startupComplete) {
          reject(new Error(`Tunnel process failed with exit code ${code}`));
        }
      });

      this.tunnelProcess.on('error', (error) => {
        console.error(`❌ Failed to start tunnel process: ${error.message}`);
        reject(error);
      });

      // Timeout after 45 seconds
      setTimeout(() => {
        if (!startupComplete) {
          reject(new Error('Tunnel startup timeout - check your configuration'));
        }
      }, 45000);
    });
  }

  async verifyTunnelConnection() {
    console.log('🔍 Verifying tunnel connection...');
    
    const maxRetries = 10;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const response = await axios.get(`${this.tunnelUrl}/health`, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Instagram-Automation-Verifier/1.0'
          }
        });
        
        console.log('✅ Tunnel connection verified');
        console.log(`   Response Status: ${response.status}`);
        console.log(`   Backend Health: ${response.data.status}`);
        console.log(`   Tunnel URL: ${this.tunnelUrl}`);
        
        return true;
        
      } catch (error) {
        retries++;
        console.log(`⏳ Verification attempt ${retries}/${maxRetries} failed, retrying...`);
        
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    throw new Error('Tunnel verification failed after multiple attempts');
  }

  async updateProjectConfiguration() {
    console.log('📝 Updating project configuration...');
    
    // Update environment variables
    const envContent = `# Cloudflare Tunnel Configuration - AUTO GENERATED
CLOUDFLARE_TUNNEL_TOKEN=${this.tunnelToken}
CLOUDFLARE_TUNNEL_NAME=${this.tunnelName}
LOCAL_PORT=${this.localPort}

# Frontend Environment Variables
VITE_WEBHOOK_URL=${this.tunnelUrl}
VITE_API_BASE_URL=${this.tunnelUrl}
VITE_WEBHOOK_VERIFY_TOKEN=instagram_automation_cf_token_2024
VITE_META_APP_ID=your_meta_app_id_here
VITE_META_APP_SECRET=your_meta_app_secret_here

# Backend Environment Variables
WEBHOOK_VERIFY_TOKEN=instagram_automation_cf_token_2024
META_APP_SECRET=your_meta_app_secret_here
PORT=${this.localPort}
NODE_ENV=production
`;

    writeFileSync('.env', envContent);
    
    // Create tunnel info file
    const tunnelInfo = {
      tunnelName: this.tunnelName,
      tunnelUrl: this.tunnelUrl,
      webhookEndpoint: `${this.tunnelUrl}/webhook/instagram`,
      healthCheck: `${this.tunnelUrl}/health`,
      backendPort: this.localPort,
      status: 'active',
      created: new Date().toISOString(),
      provider: 'cloudflare',
      domain: '888intelligenceautomation.in'
    };
    
    writeFileSync('tunnel-info.json', JSON.stringify(tunnelInfo, null, 2));
    
    console.log('✅ Configuration files updated');
    console.log('   📄 .env file created/updated');
    console.log('   📄 tunnel-info.json created');
  }

  displaySuccessInstructions() {
    console.log('\n' + '='.repeat(70));
    console.log('🎉 INSTAGRAM AUTOMATION TUNNEL ACTIVE (ES MODULE)');
    console.log('='.repeat(70));
    console.log(`🌐 Public URL: ${this.tunnelUrl}`);
    console.log(`📡 Webhook Endpoint: ${this.tunnelUrl}/webhook/instagram`);
    console.log(`💚 Health Check: ${this.tunnelUrl}/health`);
    console.log(`🔗 Domain: 888intelligenceautomation.in`);
    console.log('\n📋 NEXT STEPS FOR META API:');
    console.log('   1. Go to Meta for Developers: https://developers.facebook.com/');
    console.log('   2. Navigate to your app → Products → Webhooks');
    console.log(`   3. Set Callback URL: ${this.tunnelUrl}/webhook/instagram`);
    console.log('   4. Set Verify Token: instagram_automation_cf_token_2024');
    console.log('   5. Subscribe to: comments, mentions, story_insights');
    console.log('\n🧪 TESTING COMMANDS:');
    console.log(`   curl ${this.tunnelUrl}/health`);
    console.log(`   npm run test:meta`);
    console.log('='.repeat(70) + '\n');
  }

  async troubleshootIssues() {
    console.log('\n🔧 TROUBLESHOOTING GUIDE');
    console.log('========================');
    
    // Check common issues
    if (!this.tunnelToken) {
      console.log('❌ Missing tunnel token');
      console.log('   Fix: Add CLOUDFLARE_TUNNEL_TOKEN to .env file');
    }
    
    try {
      await axios.get(`http://localhost:${this.localPort}/health`, { timeout: 2000 });
      console.log('✅ Backend server is accessible');
    } catch (error) {
      console.log('❌ Backend server not running');
      console.log('   Fix: npm run backend');
    }
    
    console.log('\n📋 Quick fixes:');
    console.log('   1. Restart backend: npm run backend');
    console.log('   2. Check tunnel token in .env file');
    console.log('   3. Verify port 3001 is available');
    console.log('   4. Check Cloudflare dashboard for tunnel status');
  }

  async status() {
    console.log('📊 TUNNEL STATUS REPORT');
    console.log('=======================');
    
    if (existsSync('tunnel-info.json')) {
      const info = JSON.parse(readFileSync('tunnel-info.json', 'utf8'));
      console.log(`Status: ${this.isActive ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`URL: ${info.tunnelUrl}`);
      console.log(`Created: ${info.created}`);
      
      // Test connectivity
      try {
        await axios.get(`${info.tunnelUrl}/health`, { timeout: 5000 });
        console.log('Connectivity: ✅ Working');
      } catch (error) {
        console.log('Connectivity: ❌ Failed');
      }
    } else {
      console.log('Status: ❌ Not configured');
    }
  }

  async stop() {
    if (this.tunnelProcess) {
      console.log('🛑 Stopping Cloudflare Tunnel...');
      this.tunnelProcess.kill('SIGTERM');
      this.tunnelProcess = null;
      this.isActive = false;
      console.log('✅ Tunnel stopped');
    }
  }
}

// CLI Interface
const command = process.argv[2] || 'start';
const manager = new CloudflareTunnelManager();

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down tunnel manager...');
  await manager.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await manager.stop();
  process.exit(0);
});

// Execute command
switch (command) {
  case 'start':
    manager.startTunnel().catch(error => {
      console.error('❌ Failed to start tunnel:', error.message);
      process.exit(1);
    });
    break;
    
  case 'status':
    await manager.status();
    break;
    
  case 'stop':
    await manager.stop();
    break;
    
  default:
    console.log('Usage: node tunnel-manager-cf.js [start|stop|status]');
    break;
}

export default CloudflareTunnelManager;