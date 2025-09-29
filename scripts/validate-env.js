#!/usr/bin/env node
// scripts/validate-env.js - Validate Environment Configuration

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

console.log('\n' + '='.repeat(60));
console.log('🔐 ENVIRONMENT VALIDATION FOR NEW ARCHITECTURE');
console.log('='.repeat(60));

const errors = [];
const warnings = [];
const success = [];

// Define required variables based on environment
const NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`\n🌍 Environment: ${NODE_ENV}`);

// Required for all environments
const requiredAlways = [
  { key: 'SUPABASE_URL', pattern: /^https:\/\/.+\.supabase\.co$/, desc: 'Direct Supabase URL' },
  { key: 'SUPABASE_SERVICE_KEY', pattern: /^eyJ/, desc: 'Supabase service role key' },
  { key: 'SUPABASE_ANON_KEY', pattern: /^eyJ/, desc: 'Supabase anonymous key' },
  { key: 'PORT', pattern: /^\d+$/, desc: 'Backend server port' }
];

// Required for production
const requiredProduction = [
  { key: 'ENCRYPTION_KEY', pattern: /^[a-f0-9]{64}$/, desc: '32-byte hex encryption key' },
  { key: 'CLOUDFLARE_TUNNEL_TOKEN', pattern: /^eyJ/, desc: 'Cloudflare tunnel token' },
  { key: 'STATIC_IP', pattern: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, desc: 'Backend static IP for Supabase whitelist' }
];

// Deprecated variables that should NOT exist
const deprecated = [
  'SUPABASE_TUNNEL_URL',
  'CLOUDFLARE_SUPABASE_TUNNEL_TOKEN',
  'USE_DB_TUNNEL',
  'SUPABASE_CLIENT_URL',
  'db-secure.888intelligenceautomation.in'
];

// Optional but recommended
const optional = [
  'N8N_BASE_URL',
  'META_APP_ID',
  'META_APP_SECRET',
  'INSTAGRAM_CLIENT_ID',
  'INSTAGRAM_CLIENT_SECRET'
];

console.log('\n📋 Validating Required Variables:');

// Check always required
requiredAlways.forEach(({ key, pattern, desc }) => {
  const value = process.env[key];
  if (!value) {
    errors.push(`❌ ${key} is missing - ${desc}`);
    console.log(`   ❌ ${key}: Missing`);
  } else if (!pattern.test(value)) {
    errors.push(`❌ ${key} has invalid format - ${desc}`);
    console.log(`   ❌ ${key}: Invalid format`);
  } else {
    success.push(`✅ ${key} configured correctly`);
    console.log(`   ✅ ${key}: Valid`);
  }
});

// Check production requirements
if (NODE_ENV === 'production') {
  console.log('\n🔒 Validating Production Requirements:');
  requiredProduction.forEach(({ key, pattern, desc }) => {
    const value = process.env[key];
    if (!value) {
      errors.push(`❌ ${key} is required in production - ${desc}`);
      console.log(`   ❌ ${key}: Missing (REQUIRED IN PRODUCTION)`);
    } else if (!pattern.test(value)) {
      errors.push(`❌ ${key} has invalid format - ${desc}`);
      console.log(`   ❌ ${key}: Invalid format`);
    } else {
      success.push(`✅ ${key} configured correctly`);
      console.log(`   ✅ ${key}: Valid`);
    }
  });
} else {
  console.log('\n⚠️  Production variables (optional in development):');
  requiredProduction.forEach(({ key, desc }) => {
    const value = process.env[key];
    if (!value) {
      warnings.push(`⚠️  ${key} not set (recommended) - ${desc}`);
      console.log(`   ⚠️  ${key}: Not set`);
    } else {
      console.log(`   ✅ ${key}: Set`);
    }
  });
}

// Check for deprecated variables
console.log('\n🗑️  Checking for Deprecated Variables:');
let hasDeprecated = false;
deprecated.forEach(key => {
  const value = process.env[key];
  if (value) {
    errors.push(`❌ Deprecated variable ${key} should be removed`);
    console.log(`   ❌ ${key}: SHOULD BE REMOVED`);
    hasDeprecated = true;
  }
});

if (!hasDeprecated) {
  console.log('   ✅ No deprecated variables found');
}

// Check optional variables
console.log('\n📦 Optional Variables:');
optional.forEach(key => {
  const value = process.env[key];
  if (value) {
    console.log(`   ✅ ${key}: Set`);
  } else {
    console.log(`   ⚠️  ${key}: Not set (optional)`);
  }
});

// Validate specific configurations
console.log('\n🔍 Configuration Validation:');

// Check SUPABASE_URL format
if (process.env.SUPABASE_URL) {
  if (process.env.SUPABASE_URL.includes('db-secure')) {
    errors.push('❌ SUPABASE_URL contains tunnel reference - should be direct Supabase URL');
    console.log('   ❌ SUPABASE_URL contains deprecated tunnel reference');
  } else if (process.env.SUPABASE_URL.includes('uromexjprcrjfmhkmgxa.supabase.co')) {
    console.log('   ✅ SUPABASE_URL correctly points to direct Supabase');
  }
}

// Check PORT
const port = parseInt(process.env.PORT || '3001');
if (port < 1024 || port > 65535) {
  warnings.push(`⚠️  PORT ${port} may cause issues`);
  console.log(`   ⚠️  PORT ${port} is outside recommended range`);
} else {
  console.log(`   ✅ PORT ${port} is valid`);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('\n✅ All environment variables are correctly configured!');
  console.log('   Your application is ready for the new architecture.');
} else {
  if (errors.length > 0) {
    console.log('\n❌ ERRORS (must be fixed):');
    errors.forEach(err => console.log(`   ${err}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (recommended to fix):');
    warnings.forEach(warn => console.log(`   ${warn}`));
  }
  
  console.log('\n📝 Next Steps:');
  if (errors.length > 0) {
    console.log('   1. Fix the errors listed above');
    console.log('   2. Update your .env file with correct values');
    console.log('   3. Remove any deprecated variables');
    console.log('   4. Run this validation again');
  } else {
    console.log('   1. Consider fixing the warnings');
    console.log('   2. Test your connection with: npm run test:connection');
  }
}

console.log('\n' + '='.repeat(60));

// Exit with error code if validation failed
process.exit(errors.length > 0 ? 1 : 0);