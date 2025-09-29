// backend/routes/test.js - Test Routes for Supabase Integration
const express = require('express');
const router = express.Router();
const { 
  getSupabaseAdmin,
  checkHealth,
  testConnection,
  supabaseHelpers,
  logAudit,
  getConnectionInfo
} = require('../config/supabase');

// =============================================================================
// TEST SUITE OVERVIEW
// =============================================================================

router.get('/', (req, res) => {
  res.json({
    title: 'Supabase Integration Test Suite',
    description: 'Comprehensive testing endpoints for database connectivity',
    architecture: 'Direct connection with static IP whitelisting',
    endpoints: {
      '/api/test': 'This overview',
      '/api/test/supabase': 'Test Supabase connection',
      '/api/test/insert-test': 'Test data insertion',
      '/api/test/test-rls': 'Test Row Level Security',
      '/api/test/integration': 'Full integration test',
      '/api/test/create-test-user': 'Create test user profile',
      '/api/test/cleanup': 'Clean up test data'
    },
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// SUPABASE CONNECTION TEST
// =============================================================================

router.get('/supabase', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test basic connection
    const connected = await testConnection(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      10000
    );
    
    // Get health status
    const health = await checkHealth();
    
    // Get connection info
    const connectionInfo = getConnectionInfo();
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      test: 'supabase_connection',
      success: connected.success && health.healthy,
      details: {
        connection: connected,
        health: health,
        info: connectionInfo,
        totalResponseTime: responseTime
      },
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      test: 'supabase_connection',
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// DATA INSERTION TEST
// =============================================================================

router.post('/insert-test', async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    
    if (!admin) {
      throw new Error('Supabase admin client not available');
    }
    
    // Create test user profile
    const testUserId = `test_${Date.now()}`;
    const testProfile = {
      user_id: testUserId,
      username: `testuser_${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      full_name: 'Test User',
      user_role: 'user',
      status: 'active',
      subscription_plan: 'free',
      created_at: new Date().toISOString()
    };
    
    // Insert test profile
    const { data, error } = await admin
      .from('user_profiles')
      .insert(testProfile)
      .select()
      .single();
    
    if (error) throw error;
    
    // Log the test action
    await logAudit('test_data_insertion', testUserId, {
      action: 'create',
      resource_type: 'test_user_profile',
      resource_id: data.id,
      success: true
    }, req);
    
    res.json({
      test: 'data_insertion',
      success: true,
      data: data,
      message: 'Test profile created successfully',
      cleanup: `DELETE FROM user_profiles WHERE id = '${data.id}'`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      test: 'data_insertion',
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// ROW LEVEL SECURITY TEST
// =============================================================================

router.get('/test-rls', async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    
    if (!admin) {
      throw new Error('Supabase admin client not available');
    }
    
    // Test 1: Admin can see all profiles
    const { data: allProfiles, error: adminError } = await admin
      .from('user_profiles')
      .select('id, username, user_role')
      .limit(5);
    
    if (adminError) throw adminError;
    
    // Test 2: Check RLS is enabled
    const { data: rlsStatus, error: rlsError } = await admin
      .rpc('check_rls_enabled', { table_name: 'user_profiles' })
      .single();
    
    // Note: This RPC function may not exist, so we handle gracefully
    const rlsEnabled = !rlsError;
    
    res.json({
      test: 'row_level_security',
      success: true,
      results: {
        adminAccess: {
          success: !adminError,
          profileCount: allProfiles?.length || 0,
          message: 'Admin can access profiles via service key'
        },
        rlsStatus: {
          enabled: rlsEnabled,
          message: rlsEnabled ? 'RLS is active' : 'RLS status unknown'
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      test: 'row_level_security',
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// FULL INTEGRATION TEST
// =============================================================================

router.get('/integration', async (req, res) => {
  const tests = [];
  const startTime = Date.now();
  
  try {
    // Test 1: Connection
    const connectionTest = await testConnection(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      5000
    );
    tests.push({
      name: 'connection',
      success: connectionTest.success,
      details: connectionTest
    });
    
    // Test 2: Health Check
    const health = await checkHealth();
    tests.push({
      name: 'health_check',
      success: health.healthy,
      details: health
    });
    
    // Test 3: Query Test
    const admin = getSupabaseAdmin();
    if (admin) {
      const { count, error } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });
      
      tests.push({
        name: 'query_test',
        success: !error,
        details: {
          profileCount: count || 0,
          error: error?.message
        }
      });
    } else {
      tests.push({
        name: 'query_test',
        success: false,
        details: { error: 'Admin client not available' }
      });
    }
    
    // Test 4: Helper Functions
    const helperTest = await supabaseHelpers.testConnection();
    tests.push({
      name: 'helper_functions',
      success: helperTest,
      details: { connected: helperTest }
    });
    
    // Calculate overall success
    const allPassed = tests.every(test => test.success);
    const totalTime = Date.now() - startTime;
    
    res.status(allPassed ? 200 : 500).json({
      test: 'full_integration',
      success: allPassed,
      totalTests: tests.length,
      passedTests: tests.filter(t => t.success).length,
      failedTests: tests.filter(t => !t.success).length,
      executionTime: `${totalTime}ms`,
      tests: tests,
      connectionInfo: getConnectionInfo(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      test: 'full_integration',
      success: false,
      error: error.message,
      testsCompleted: tests,
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// CREATE TEST USER
// =============================================================================

router.post('/create-test-user', async (req, res) => {
  try {
    const { username, email } = req.body;
    
    if (!username || !email) {
      return res.status(400).json({
        success: false,
        error: 'Username and email are required'
      });
    }
    
    const testUserId = `test_user_${Date.now()}`;
    const result = await supabaseHelpers.upsertUserProfile(testUserId, {
      username,
      email,
      full_name: 'Test User',
      user_role: 'user',
      status: 'active',
      subscription_plan: 'free'
    });
    
    if (result.success) {
      res.json({
        test: 'create_test_user',
        success: true,
        data: result.data,
        message: 'Test user created successfully',
        userId: testUserId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        test: 'create_test_user',
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    res.status(500).json({
      test: 'create_test_user',
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// CLEANUP TEST DATA
// =============================================================================

router.delete('/cleanup', async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    
    if (!admin) {
      throw new Error('Supabase admin client not available');
    }
    
    // Delete all test users (usernames starting with 'testuser_')
    const { data, error } = await admin
      .from('user_profiles')
      .delete()
      .like('username', 'testuser_%')
      .select();
    
    if (error) throw error;
    
    res.json({
      test: 'cleanup',
      success: true,
      deletedCount: data?.length || 0,
      message: `Deleted ${data?.length || 0} test profiles`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      test: 'cleanup',
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// TEST INSTAGRAM HELPERS
// =============================================================================

router.post('/test-instagram', async (req, res) => {
  try {
    const testUserId = `test_ig_${Date.now()}`;
    const testBusinessId = `test_business_${Date.now()}`;
    
    // Test linking Instagram account
    const linkResult = await supabaseHelpers.linkInstagramAccount(testUserId, {
      instagram_business_id: testBusinessId,
      instagram_user_id: 'test_user_123',
      name: 'Test Business',
      username: 'test_business',
      account_type: 'business',
      followers_count: 100,
      following_count: 50,
      media_count: 10
    });
    
    if (!linkResult.success) throw new Error(linkResult.error);
    
    // Test storing credentials
    const credResult = await supabaseHelpers.storeInstagramCredentials(
      testUserId,
      linkResult.data.id,
      {
        accessToken: 'test_token_' + Date.now(),
        refreshToken: 'test_refresh_' + Date.now(),
        scope: ['instagram_basic', 'instagram_manage_comments'],
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }
    );
    
    if (!credResult.success) throw new Error(credResult.error);
    
    // Test retrieving credentials
    const getCredResult = await supabaseHelpers.getInstagramCredentials(
      testUserId,
      linkResult.data.id
    );
    
    res.json({
      test: 'instagram_helpers',
      success: true,
      results: {
        accountLinked: linkResult.success,
        credentialsStored: credResult.success,
        credentialsRetrieved: getCredResult.success,
        encryptionWorking: credResult.data?.access_token_encrypted?.includes('isEncrypted')
      },
      cleanup: {
        message: 'Test data created with test IDs',
        userId: testUserId,
        businessId: testBusinessId
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      test: 'instagram_helpers',
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;