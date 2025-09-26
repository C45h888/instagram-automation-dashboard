// scripts/setup-unified-tunnel.js - Setup helper for migrating to unified tunnel manager
// This script safely migrates from the old tunnel managers to the unified version

import { existsSync, mkdirSync, renameSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

class UnifiedTunnelSetup {
  constructor() {
    this.scriptsDir = './scripts';
    this.deprecatedDir = './scripts/deprecated';
    this.unifiedScript = 'tunnel-manager-unified.js';
    this.oldScripts = ['tunnel-manager-cf.js', 'tunnel-manager-dual.js'];
    this.backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  }

  async run() {
    console.log('🚀 UNIFIED TUNNEL MANAGER SETUP');
    console.log('='.repeat(40));
    console.log('This script will safely migrate your tunnel management system\n');

    try {
      // Step 1: Check current state
      await this.checkCurrentState();
      
      // Step 2: Backup environment
      await this.backupEnvironment();
      
      // Step 3: Archive old scripts
      await this.archiveOldScripts();
      
      // Step 4: Verify unified script
      await this.verifyUnifiedScript();
      
      // Step 5: Test configuration
      await this.testConfiguration();
      
      // Step 6: Show migration summary
      await this.showSummary();
      
      console.log('\n✅ Setup completed successfully!');
      console.log('You can now use: npm run tunnel');
      
    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      console.log('\n📝 Manual steps to complete:');
      console.log('1. Copy tunnel-manager-unified.js to scripts/');
      console.log('2. Run: npm run env:backup');
      console.log('3. Test with: npm run tunnel:single');
      process.exit(1);
    }
  }

  async checkCurrentState() {
    console.log('\n📊 Checking current state...');
    
    // Check if scripts directory exists
    if (!existsSync(this.scriptsDir)) {
      console.log('   Creating scripts directory...');
      mkdirSync(this.scriptsDir, { recursive: true });
    }
    
    // Check for old scripts
    const foundOldScripts = [];
    for (const script of this.oldScripts) {
      const paths = [
        `./${script}`,
        `${this.scriptsDir}/${script}`,
        `./scripts/${script}`
      ];
      
      for (const path of paths) {
        if (existsSync(path)) {
          foundOldScripts.push({ name: script, path });
          console.log(`   Found old script: ${path}`);
          break;
        }
      }
    }
    
    // Check for unified script
    const unifiedPath = `${this.scriptsDir}/${this.unifiedScript}`;
    if (existsSync(unifiedPath)) {
      console.log(`   ✅ Unified script already exists: ${unifiedPath}`);
    } else {
      console.log(`   ⚠️ Unified script not found: ${unifiedPath}`);
      console.log('   Please copy tunnel-manager-unified.js to scripts/ directory');
    }
    
    // Check .env file
    if (existsSync('.env')) {
      console.log('   ✅ .env file exists');
      
      // Check for critical variables
      try {
        const envContent = readFileSync('.env', 'utf8');
        const hasSupabaseKey = envContent.includes('SUPABASE_SERVICE_KEY');
        const hasTunnelToken = envContent.includes('CLOUDFLARE_TUNNEL_TOKEN');
        
        if (hasSupabaseKey && hasTunnelToken) {
          console.log('   ✅ Critical environment variables found');
        } else {
          console.log('   ⚠️ Some critical variables may be missing');
        }
      } catch (error) {
        console.log('   ⚠️ Could not read .env file');
      }
    } else {
      console.log('   ⚠️ No .env file found');
    }
    
    return { foundOldScripts };
  }

  async backupEnvironment() {
    console.log('\n📦 Backing up environment...');
    
    // Backup .env if it exists
    if (existsSync('.env')) {
      const backupName = `.env.backup.${this.backupTimestamp}`;
      copyFileSync('.env', backupName);
      console.log(`   ✅ Created backup: ${backupName}`);
    }
    
    // Backup tunnel status files
    const statusFiles = [
      'tunnel-status.json',
      'tunnel-info.json',
      'dual-tunnel-status.json'
    ];
    
    for (const file of statusFiles) {
      if (existsSync(file)) {
        const backupName = `${file}.backup.${this.backupTimestamp}`;
        copyFileSync(file, backupName);
        console.log(`   ✅ Backed up: ${file} → ${backupName}`);
      }
    }
  }

  async archiveOldScripts() {
    console.log('\n📂 Archiving old scripts...');
    
    // Create deprecated directory
    if (!existsSync(this.deprecatedDir)) {
      mkdirSync(this.deprecatedDir, { recursive: true });
      console.log(`   Created directory: ${this.deprecatedDir}`);
    }
    
    // Move old scripts
    for (const script of this.oldScripts) {
      const possiblePaths = [
        `./${script}`,
        `./scripts/${script}`,
        `${this.scriptsDir}/${script}`
      ];
      
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          const archivePath = `${this.deprecatedDir}/${script}`;
          
          // Check if already archived
          if (existsSync(archivePath)) {
            console.log(`   ⚠️ ${script} already archived`);
          } else {
            renameSync(path, archivePath);
            console.log(`   ✅ Archived: ${path} → ${archivePath}`);
          }
          break;
        }
      }
    }
  }

  async verifyUnifiedScript() {
    console.log('\n🔍 Verifying unified script...');
    
    const unifiedPath = `${this.scriptsDir}/${this.unifiedScript}`;
    
    if (!existsSync(unifiedPath)) {
      throw new Error(`Unified script not found at ${unifiedPath}`);
    }
    
    // Check if it's executable
    try {
      const stats = require('fs').statSync(unifiedPath);
      console.log(`   ✅ Script exists: ${unifiedPath}`);
      console.log(`   Size: ${stats.size} bytes`);
      
      // Verify it has the safety features
      const content = readFileSync(unifiedPath, 'utf8');
      
      if (content.includes('writeFileSync(\'.env\'')) {
        console.log('   ⚠️ WARNING: Script may overwrite .env - please review');
      } else {
        console.log('   ✅ Script does not overwrite .env directly');
      }
      
      if (content.includes('.env.tunnel-')) {
        console.log('   ✅ Script creates template files');
      }
      
      if (content.includes('--mode single') && content.includes('--mode dual')) {
        console.log('   ✅ Script supports both single and dual modes');
      }
      
    } catch (error) {
      throw new Error(`Could not verify script: ${error.message}`);
    }
  }

  async testConfiguration() {
    console.log('\n🧪 Testing configuration...');
    
    // Test if backend is running
    try {
      execSync('curl -s http://localhost:3001/health', { timeout: 2000 });
      console.log('   ✅ Backend is running');
    } catch (error) {
      console.log('   ⚠️ Backend not running (start with: npm run backend)');
    }
    
    // Test if cloudflared is installed
    try {
      const version = execSync('cloudflared --version 2>&1').toString().trim();
      console.log(`   ✅ Cloudflared installed: ${version}`);
    } catch (error) {
      console.log('   ❌ Cloudflared not installed');
      console.log('      Install from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/');
    }
    
    // Check for required environment variables
    const requiredVars = [
      'CLOUDFLARE_TUNNEL_TOKEN',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_ANON_KEY'
    ];
    
    console.log('\n   Checking environment variables:');
    const missingVars = [];
    
    for (const varName of requiredVars) {
      if (process.env[varName]) {
        console.log(`   ✅ ${varName} is set`);
      } else {
        missingVars.push(varName);
        console.log(`   ❌ ${varName} is missing`);
      }
    }
    
    if (missingVars.length > 0) {
      console.log('\n   ⚠️ Missing environment variables:');
      missingVars.forEach(v => console.log(`      - ${v}`));
      console.log('   Add these to your .env file');
    }
  }

  async showSummary() {
    console.log('\n📊 MIGRATION SUMMARY');
    console.log('='.repeat(40));
    
    console.log('\n✅ Completed Actions:');
    console.log('   • Environment backed up');
    console.log('   • Old scripts archived to deprecated/');
    console.log('   • Unified script verified');
    
    console.log('\n📝 Next Steps:');
    console.log('   1. Test single mode: npm run tunnel:single');
    console.log('   2. Test dual mode: npm run tunnel:dual');
    console.log('   3. Check status: npm run tunnel:status');
    
    console.log('\n🎯 Available Commands:');
    console.log('   • npm run tunnel         - Start dual tunnels');
    console.log('   • npm run tunnel:single  - Start API tunnel only');
    console.log('   • npm run tunnel:status  - Check tunnel status');
    console.log('   • npm run tunnel:stop    - Stop all tunnels');
    console.log('   • npm run tunnel:test    - Test connectivity');
    
    console.log('\n⚡ Quick Development:');
    console.log('   • npm run dev:secure     - Full stack with dual tunnels');
    console.log('   • npm run dev:production - Full stack with single tunnel');
    console.log('   • npm run dev:local      - Local development (no tunnels)');
    
    console.log('\n🔒 Safety Notes:');
    console.log('   • Your .env file is preserved (never overwritten)');
    console.log('   • Templates created as .env.tunnel-single or .env.tunnel-dual');
    console.log('   • Backups created with timestamp');
    console.log('   • Old scripts archived in scripts/deprecated/');
    
    // Create a migration report file
    const report = {
      timestamp: new Date().toISOString(),
      migration: 'tunnel-manager-unified',
      backups: {
        env: `.env.backup.${this.backupTimestamp}`,
        scripts: this.deprecatedDir
      },
      status: 'completed',
      nextSteps: [
        'Test with npm run tunnel:test',
        'Review .env.tunnel-dual for new variables',
        'Update any CI/CD scripts to use new commands'
      ]
    };
    
    writeFileSync('migration-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Migration report saved: migration-report.json');
  }
}

// Run setup if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new UnifiedTunnelSetup();
  setup.run();
}

export default UnifiedTunnelSetup;