#!/usr/bin/env node
// scripts/check-environment.js - Environment Configuration Checker

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(60));
console.log('🔍 ENVIRONMENT CONFIGURATION CHECK');
console.log('='.repeat(60));

// Check NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'not set';
console.log(`\n📋 NODE_ENV: ${nodeEnv}`);

// Check which .env files exist
const envFiles = [
  { name: '.env', desc: 'Current active environment' },
  { name: '.env.development', desc: 'Development configuration' },
  { name: '.env.production', desc: 'Production configuration' },
  { name: '.env.example', desc: 'Example configuration' }
];

console.log('\n📁 Environment Files:');
envFiles.forEach(file => {
  const exists = fs.existsSync(path.join(process.cwd(), file.name));
  const symbol = exists ? '✅' : '❌';
  console.log(`   ${symbol} ${file.name} - ${file.desc}`);
});

// Load and check current .env
if (fs.existsSync('.env')) {
  require('dotenv').config();
  
  console.log('\n🔑 Critical Variables:');
  
  const criticalVars = [
    { key: 'SUPABASE_URL', desc: 'Database URL' },
    { key: 'SUPABASE_SERVICE_KEY', desc: 'Service role key' },
    { key: 'SUPABASE_ANON_KEY', desc: 'Anonymous key' },
    { key: 'ENCRYPTION_KEY', desc: 'Token encryption' },
    { key: 'CLOUDFLARE_TUNNEL_TOKEN', desc: 'API tunnel token' },
    { key: 'PORT', desc: 'Backend port' },
    { key: 'STATIC_IP', desc: 'Backend static IP' }
  ];
  
  criticalVars.forEach(({ key, desc }) => {
    const value = process.env[key];
    const status = value ? '✅ Set' : '❌ Missing';
    console.log(`   ${status} - ${key}: ${desc}`);
    if (value && key.includes('URL')) {
      console.log(`         URL: ${value}`);
    }
  });
  
  // Check for deprecated variables
  console.log('\n⚠️  Deprecated Variables (should be removed):');
  const deprecated = [
    'SUPABASE_TUNNEL_URL',
    'CLOUDFLARE_SUPABASE_TUNNEL_TOKEN',
    'USE_DB_TUNNEL'
  ];
  
  let hasDeprecated = false;
  deprecated.forEach(key => {
    if (process.env[key]) {
      console.log(`   ❗ ${key} is still set (remove this)`);
      hasDeprecated = true;
    }
  });
  
  if (!hasDeprecated) {
    console.log('   ✅ No deprecated variables found');
  }
  
  // Connection strategy based on NODE_ENV
  console.log('\n🔄 Connection Strategy:');
  if (nodeEnv === 'production') {
    console.log('   Mode: PRODUCTION');
    console.log('   Database: Direct connection to Supabase');
    console.log('   Security: Static IP whitelisting');
    console.log('   Tunnel: API tunnel only (no database tunnel)');
  } else if (nodeEnv === 'development') {
    console.log('   Mode: DEVELOPMENT');
    console.log('   Database: Direct connection with fallback');
    console.log('   Security: Relaxed for local development');
    console.log('   Tunnel: Optional (for external testing)');
  } else {
    console.log('   ⚠️  NODE_ENV not set - defaulting to development');
  }
  
} else {
  console.log('\n❌ No .env file found!');
  console.log('   Run one of these commands:');
  console.log('   - npm run env:setup:dev   (for development)');
  console.log('   - npm run env:setup:prod  (for production)');
}

console.log('\n' + '='.repeat(60));
console.log('✅ Environment check complete');
console.log('='.repeat(60) + '\n');