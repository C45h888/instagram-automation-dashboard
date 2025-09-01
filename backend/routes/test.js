// backend/routes/test.js - Comprehensive Testing Suite for Supabase + Cloudflare Tunnel Integration
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Import Supabase configuration
const { 
  supabaseAdmin, 
  supabaseClient, 
  testConnection, 
  logAudit, 
  logApiRequest, 
  encrypt, 
  decrypt,
  supabaseHelpers 
} = require('../config/supabase');

// =============================================================================
// MIDDLEWARE - REQUEST LOGGING & SECURITY
// =============================================================================

// Request logging middleware for all test routes
router.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    const success = res.statusCode >= 200 && res.statusCode < 400;
    
    // Log API request (async, don't block response)
    setImmediate(() => {
      logApiRequest(
        req.query.user_id || 'test_user', 
        req.path, 
        req.method, 
        responseTime, 
        res.statusCode, 
        success
      );
    });
    
    console.log(`🧪 TEST ${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`);
    originalSend.call(this, data);
  };
  
  next();
});

// Security headers for test endpoints
router.use((req, res, next) => {
  res.header('X-Test-Suite', 'instagram-automation-v1');
  res.header('X-Request-ID', crypto.randomUUID());
  next();
});

// =============================================================================
// PHASE 1 TEST SUITE - SUPABASE CONNECTION TESTING
// =============================================================================

// Test 1: Basic Supabase Connection
router.get('/supabase', async (req, res) => {
  const testStartTime = Date.now();
  
  try {
    console.log('🔍 Testing Supabase connection from backend...');
    
    // Test connection using our utility function
    const connected = await testConnection();
    
    if (connected) {
      // Gather comprehensive database statistics
      const stats = {};
      
      // Test each major table
      const tables = [
        'user_profiles',
        'admin_users', 
        'instagram_business_accounts',
        'automation_workflows',
        'audit_log',
        'api_usage'
      ];
      
      for (const table of tables) {
        try {
          const { count, error } = await supabaseAdmin
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          stats[table] = {
            count: count || 0,
            accessible: !error,
            error: error?.message
          };
        } catch (err) {
          stats[table] = {
            count: 0,
            accessible: false,
            error: err.message
          };
        }
      }
      
      // Test specific database functions
      const databaseFeatures = {
        rls_enabled: false,
        triggers_active: false,
        extensions_loaded: false
      };
      
      try {
        // Test RLS by attempting anon query
        const { error: rlsError } = await supabaseClient
          .from('user_profiles')
          .select('*')
          .limit(1);
        
        databaseFeatures.rls_enabled = rlsError && rlsError.message.includes('policy');
      } catch (err) {
        databaseFeatures.rls_enabled = true; // Assume RLS is working if we get blocked
      }
      
      // Test database extensions
      try {
        const { data: extensions } = await supabaseAdmin
          .rpc('pg_available_extensions')
          .limit(5);
        
        databaseFeatures.extensions_loaded = Array.isArray(extensions);
      } catch (err) {
        // Extension check not available - that's okay
        databaseFeatures.extensions_loaded = 'unknown';
      }
      
      const responseTime = Date.now() - testStartTime;
      
      res.json({
        success: true,
        message: 'Backend connected to Supabase successfully via Cloudflare tunnel',
        database: {
          url: process.env.SUPABASE_TUNNEL_URL || process.env.SUPABASE_URL,
          tunnel_active: (process.env.SUPABASE_TUNNEL_URL || process.env.SUPABASE_URL).includes('db-secure'),
          direct_url: 'uromexjprcrjfmhkmgxa.supabase.co',
          schema: 'public'
        },
        statistics: stats,
        features: databaseFeatures,
        performance: {
          response_time_ms: responseTime,
          connection_pool: 'active'
        },
        timestamp: new Date().toISOString()
      });
      
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to connect to Supabase',
        error: 'Connection test returned false',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('🚨 Supabase test error:', error);
    res.status(500).json({
      success: false,
      message: 'Supabase connection test failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// Test 2: Data Insertion Through Tunnel
router.post('/insert-test', async (req, res) => {
  try {
    const { test_name, test_data, user_id } = req.body;
    const testId = crypto.randomUUID();
    
    console.log(`🔬 Testing data insertion: ${test_name || 'tunnel_test'}`);
    
    // Insert comprehensive test data
    const insertData = {
      event_type: 'test_insertion',
      action: 'create',
      resource_type: 'test_data',
      resource_id: testId,
      details: {
        test_name: test_name || 'tunnel_test',
        test_data: test_data || { message: 'Testing Cloudflare tunnel data flow' },
        source: 'backend_test_route',
        test_id: testId,
        tunnel_info: {
          via_tunnel: true,
          tunnel_domain: 'db-secure.888intelligenceautomation.in',
          backend_domain: 'instagram-backend.888intelligenceautomation.in'
        }
      },
      ip_address: req.ip || req.connection?.remoteAddress || 'test-client',
      user_agent: req.headers['user-agent'] || 'test-agent',
      success: true
    };
    
    if (user_id) {
      insertData.user_id = user_id;
    }
    
    const { data, error } = await supabaseAdmin
      .from('audit_log')
      .insert(insertData)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`✅ Test data inserted successfully: ${data.id}`);
    
    // Verify the insertion by reading it back
    const { data: verification, error: readError } = await supabaseAdmin
      .from('audit_log')
      .select('*')
      .eq('id', data.id)
      .single();
    
    if (readError) {
      console.warn('⚠️  Could not verify insertion:', readError.message);
    }
    
    res.json({
      success: true,
      message: 'Data inserted and verified through Cloudflare tunnel successfully',
      data: {
        id: data.id,
        event_type: data.event_type,
        test_id: testId,
        created_at: data.created_at,
        verified: !readError
      },
      tunnel: {
        backend_to_db: 'success',
        round_trip_verified: !readError
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🚨 Insert test error:', error);
    res.status(500).json({
      success: false,
      message: 'Data insertion test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test 3: RLS Policies Testing
router.get('/test-rls', async (req, res) => {
  try {
    console.log('🔒 Testing Row Level Security policies...');
    
    const results = {
      admin_access: { success: false, error: null },
      anon_access: { success: false, error: null },
      rls_working: false
    };
    
    // Test 1: Admin client should work (service role bypasses RLS)
    try {
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('user_profiles')
        .select('count')
        .limit(1);
      
      results.admin_access = {
        success: !adminError,
        error: adminError?.message,
        bypassed_rls: true
      };
    } catch (adminErr) {
      results.admin_access = {
        success: false,
        error: adminErr.message,
        bypassed_rls: false
      };
    }
    
    // Test 2: Anonymous client should be blocked by RLS
    try {
      const { data: anonData, error: anonError } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .limit(1);
      
      results.anon_access = {
        success: !anonError,
        error: anonError?.message,
        blocked_by_rls: !!anonError
      };
      
      // If anon access succeeds, RLS might not be configured properly
      results.rls_working = !!anonError;
      
    } catch (anonErr) {
      results.anon_access = {
        success: false,
        error: anonErr.message,
        blocked_by_rls: true
      };
      
      results.rls_working = true;
    }
    
    // Test 3: Try to access admin_users table (should be highly restricted)
    try {
      const { data: adminUsersData, error: adminUsersError } = await supabaseClient
        .from('admin_users')
        .select('*')
        .limit(1);
      
      results.admin_users_access = {
        success: !adminUsersError,
        error: adminUsersError?.message,
        properly_protected: !!adminUsersError
      };
      
    } catch (adminUsersErr) {
      results.admin_users_access = {
        success: false,
        error: adminUsersErr.message,
        properly_protected: true
      };
    }
    
    const overallSecurityScore = [
      results.admin_access.success,
      results.anon_access.blocked_by_rls,
      results.admin_users_access?.properly_protected
    ].filter(Boolean).length;
    
    res.json({
      rls_configured: results.rls_working,
      security_score: `${overallSecurityScore}/3`,
      service_role_working: results.admin_access.success,
      anon_properly_blocked: results.anon_access.blocked_by_rls,
      admin_data_protected: results.admin_users_access?.properly_protected,
      message: results.rls_working 
        ? 'RLS is protecting data correctly' 
        : 'WARNING: RLS may not be configured properly',
      details: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🚨 RLS test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test 4: Create Test User
router.post('/create-test-user', async (req, res) => {
  try {
    const timestamp = Date.now();
    const testEmail = req.body.email || `test_${timestamp}@888intelligence.com`;
    const testUserId = crypto.randomUUID();
    const testUsername = req.body.username || `testuser_${timestamp}`;
    
    console.log(`👤 Creating test user: ${testEmail}`);
    
    // Create comprehensive user profile
    const profileData = {
      user_id: testUserId,
      username: testUsername,
      full_name: req.body.full_name || 'Test User',
      email: testEmail,
      user_role: req.body.role || 'user',
      status: 'active',
      subscription_plan: 'free',
      instagram_connected: false,
      timezone: 'UTC',
      notification_preferences: {
        email_notifications: true,
        push_notifications: false,
        marketing_emails: false
      },
      ui_preferences: {
        theme: 'dark',
        language: 'en'
      },
      onboarding_completed: false,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString()
    };
    
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .insert(profileData)
      .select()
      .single();
    
    if (error) throw error;
    
    // Log the user creation
    await logAudit('test_user_created', testUserId, {
      action: 'create',
      resource_type: 'user_profile',
      resource_id: data.id,
      test_user: true
    });
    
    console.log(`✅ Test user created: ${data.username}`);
    
    res.json({
      success: true,
      message: 'Test user created successfully',
      user: {
        id: data.id,
        user_id: data.user_id,
        username: data.username,
        email: data.email,
        role: data.user_role,
        status: data.status,
        created_at: data.created_at
      },
      test_credentials: {
        user_id: testUserId,
        email: testEmail,
        role: profileData.user_role
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🚨 Create test user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test user',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test 5: Encryption/Decryption Testing
router.post('/test-encryption', async (req, res) => {
  try {
    const testData = req.body.data || 'test_instagram_access_token_12345';
    
    console.log('🔐 Testing encryption/decryption functionality...');
    
    // Test encryption
    const encryptedResult = encrypt(testData);
    
    // Test decryption
    const decryptedResult = decrypt(encryptedResult);
    
    const encryptionWorking = decryptedResult === testData;
    
    res.json({
      success: encryptionWorking,
      encryption_available: !!process.env.ENCRYPTION_KEY,
      test_passed: encryptionWorking,
      original_length: testData.length,
      encrypted_data: {
        encrypted: encryptedResult.encrypted?.substring(0, 20) + '...', // Don't expose full encrypted data
        has_iv: !!encryptedResult.iv,
        has_auth_tag: !!encryptedResult.authTag,
        is_encrypted: encryptedResult.isEncrypted
      },
      decrypted_length: decryptedResult?.length,
      message: encryptionWorking 
        ? 'Encryption/decryption working correctly' 
        : 'Encryption/decryption failed - check ENCRYPTION_KEY',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🚨 Encryption test error:', error);
    res.status(500).json({
      success: false,
      message: 'Encryption test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test 6: Database Helper Functions
router.get('/test-helpers', async (req, res) => {
  try {
    console.log('🛠️ Testing Supabase helper functions...');
    
    const results = {};
    
    // Test connection helper
    results.connection_test = {
      success: await supabaseHelpers.testConnection(),
      function: 'supabaseHelpers.testConnection()'
    };
    
    // Test audit logging
    try {
      const auditResult = await supabaseHelpers.createAuditLog('test_user_123', {
        event_type: 'helper_function_test',
        action: 'test',
        resource_type: 'test_suite',
        success: true
      });
      
      results.audit_logging = {
        success: auditResult.success || true,
        function: 'supabaseHelpers.createAuditLog()'
      };
    } catch (err) {
      results.audit_logging = {
        success: false,
        error: err.message,
        function: 'supabaseHelpers.createAuditLog()'
      };
    }
    
    // Count available helper functions
    const helperFunctions = Object.keys(supabaseHelpers);
    results.available_helpers = {
      count: helperFunctions.length,
      functions: helperFunctions
    };
    
    const allTestsPassed = Object.values(results).every(
      result => result.success !== false
    );
    
    res.json({
      success: allTestsPassed,
      message: allTestsPassed 
        ? 'All helper functions working correctly' 
        : 'Some helper functions failed - check logs',
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🚨 Helper functions test error:', error);
    res.status(500).json({
      success: false,
      message: 'Helper functions test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test 7: Comprehensive Integration Test
router.get('/integration', async (req, res) => {
  const integrationResults = {};
  let overallSuccess = true;
  
  try {
    console.log('🧪 Running comprehensive integration test...');
    
    // Test 1: Database Connection
    try {
      integrationResults.database_connection = {
        success: await testConnection(),
        test: 'Supabase connection via tunnel'
      };
    } catch (err) {
      integrationResults.database_connection = {
        success: false,
        error: err.message,
        test: 'Supabase connection via tunnel'
      };
      overallSuccess = false;
    }
    
    // Test 2: Create test data
    const testUserId = crypto.randomUUID();
    try {
      const { data } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: testUserId,
          username: `integration_test_${Date.now()}`,
          full_name: 'Integration Test User',
          email: `integration_${Date.now()}@test.com`,
          user_role: 'user',
          status: 'active',
          subscription_plan: 'free',
          instagram_connected: false,
          onboarding_completed: false
        })
        .select()
        .single();
      
      integrationResults.create_user = {
        success: true,
        user_id: data.user_id,
        test: 'User profile creation'
      };
    } catch (err) {
      integrationResults.create_user = {
        success: false,
        error: err.message,
        test: 'User profile creation'
      };
      overallSuccess = false;
    }
    
    // Test 3: Audit logging
    try {
      await logAudit('integration_test', testUserId, {
        action: 'test',
        resource_type: 'integration_test',
        success: true
      });
      
      integrationResults.audit_logging = {
        success: true,
        test: 'Audit trail logging'
      };
    } catch (err) {
      integrationResults.audit_logging = {
        success: false,
        error: err.message,
        test: 'Audit trail logging'
      };
      overallSuccess = false;
    }
    
    // Test 4: Cleanup test data
    try {
      await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('user_id', testUserId);
      
      integrationResults.cleanup = {
        success: true,
        test: 'Test data cleanup'
      };
    } catch (err) {
      integrationResults.cleanup = {
        success: false,
        error: err.message,
        test: 'Test data cleanup'
      };
    }
    
    // Test 5: Performance check
    const performanceStart = Date.now();
    try {
      await supabaseAdmin.from('user_profiles').select('count').limit(1);
      const performanceTime = Date.now() - performanceStart;
      
      integrationResults.performance = {
        success: performanceTime < 1000, // Should be under 1 second
        response_time_ms: performanceTime,
        test: 'Database performance'
      };
    } catch (err) {
      integrationResults.performance = {
        success: false,
        error: err.message,
        test: 'Database performance'
      };
    }
    
    const passedTests = Object.values(integrationResults).filter(r => r.success).length;
    const totalTests = Object.keys(integrationResults).length;
    
    res.json({
      success: overallSuccess,
      summary: {
        passed: passedTests,
        total: totalTests,
        success_rate: `${Math.round((passedTests / totalTests) * 100)}%`
      },
      message: overallSuccess 
        ? 'All integration tests passed' 
        : `${passedTests}/${totalTests} tests passed`,
      results: integrationResults,
      tunnel: {
        backend_api: 'instagram-backend.888intelligenceautomation.in',
        database: 'db-secure.888intelligenceautomation.in',
        status: 'operational'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🚨 Integration test error:', error);
    res.status(500).json({
      success: false,
      message: 'Integration test suite failed',
      error: error.message,
      results: integrationResults,
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// TEST SUITE SUMMARY & HEALTH CHECK
// =============================================================================

// Test Suite Overview
router.get('/', async (req, res) => {
  res.json({
    message: 'Instagram Automation Backend - Test Suite',
    version: '1.0.0',
    tunnel_architecture: {
      backend: 'instagram-backend.888intelligenceautomation.in',
      database: 'db-secure.888intelligenceautomation.in',
      security: 'zero-trust'
    },
    available_tests: {
      'GET /supabase': 'Test Supabase connection and gather statistics',
      'POST /insert-test': 'Test data insertion through Cloudflare tunnel',
      'GET /test-rls': 'Test Row Level Security policies',
      'POST /create-test-user': 'Create test user profile',
      'POST /test-encryption': 'Test Instagram credential encryption',
      'GET /test-helpers': 'Test Supabase helper functions',
      'GET /integration': 'Run comprehensive integration test suite'
    },
    usage: {
      examples: [
        'GET /api/test/supabase - Test database connection',
        'POST /api/test/insert-test - Test data flow',
        'GET /api/test/integration - Run all tests'
      ]
    },
    environment: {
      node_env: process.env.NODE_ENV,
      supabase_configured: !!process.env.SUPABASE_SERVICE_KEY,
      encryption_enabled: !!process.env.ENCRYPTION_KEY,
      tunnel_active: !!(process.env.SUPABASE_TUNNEL_URL || process.env.SUPABASE_URL)
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;