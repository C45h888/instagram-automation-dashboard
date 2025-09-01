const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// Generate test data with proper error handling
router.post('/generate', async (req, res) => {
  try {
    console.log('Generating test data...');
    
    const testUserId = `test-user-${Date.now()}`;
    const results = {
      profile: null,
      account: null,
      workflows: [],
      analytics: 0
    };
    
    // Create test user profile
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: testUserId,
        username: `testuser_${Date.now()}`,
        full_name: 'Test User',
        email: `test${Date.now()}@example.com`,
        user_role: 'user',
        status: 'active',
        subscription_plan: 'pro',
        instagram_connected: true,
        instagram_username: 'test_instagram'
      })
      .select()
      .single();
    
    if (!userError) {
      results.profile = userProfile;
      
      // Create Instagram account
      const { data: account } = await supabaseAdmin
        .from('instagram_business_accounts')
        .insert({
          user_id: testUserId,
          instagram_business_id: `ig_${Date.now()}`,
          name: 'Test Business',
          username: 'test_business',
          account_type: 'business',
          followers_count: 10000,
          is_connected: true,
          connection_status: 'active'
        })
        .select()
        .single();
      
      if (account) {
        results.account = account;
        
        // Create workflows
        const workflowTypes = ['engagement_monitor', 'analytics_pipeline', 'sales_attribution'];
        for (const type of workflowTypes) {
          const { data: workflow } = await supabaseAdmin
            .from('automation_workflows')
            .insert({
              user_id: testUserId,
              business_account_id: account.id,
              name: `Test ${type}`,
              automation_type: type,
              status: 'active',
              is_active: true,
              configuration: { test: true },
              n8n_workflow_id: `n8n_${type}_${Date.now()}`
            })
            .select()
            .single();
          
          if (workflow) {
            results.workflows.push(workflow);
            
            // Create executions
            for (let i = 0; i < 3; i++) {
              await supabaseAdmin
                .from('workflow_executions')
                .insert({
                  workflow_id: workflow.id,
                  user_id: testUserId,
                  status: ['success', 'error', 'running'][i % 3],
                  started_at: new Date(Date.now() - i * 3600000).toISOString(),
                  execution_time_ms: Math.floor(Math.random() * 5000)
                });
            }
          }
        }
        
        // Create analytics
        for (let i = 0; i < 30; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          
          await supabaseAdmin
            .from('daily_analytics')
            .insert({
              business_account_id: account.id,
              user_id: testUserId,
              date: date.toISOString().split('T')[0],
              followers_count: 10000 + (30 - i) * 50,
              following_count: 500,
              media_count: 100 + i,
              engagement_rate: Math.random() * 10,
              impressions_count: Math.floor(Math.random() * 50000),
              reach_count: Math.floor(Math.random() * 30000)
            });
          
          results.analytics++;
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Test data generated successfully',
      data: {
        userId: testUserId,
        profile: results.profile?.id,
        account: results.account?.id,
        workflows: results.workflows.length,
        analytics: results.analytics
      }
    });
    
  } catch (error) {
    console.error('Generate test data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clean up test data with cascade deletion
router.delete('/cleanup', async (req, res) => {
  try {
    // Find all test users
    const { data: testUsers } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .like('username', 'testuser_%');
    
    let deletedCount = 0;
    
    if (testUsers && testUsers.length > 0) {
      for (const user of testUsers) {
        // Delete in correct order
        await supabaseAdmin
          .from('workflow_executions')
          .delete()
          .eq('user_id', user.user_id);
        
        await supabaseAdmin
          .from('daily_analytics')
          .delete()
          .eq('user_id', user.user_id);
        
        await supabaseAdmin
          .from('automation_workflows')
          .delete()
          .eq('user_id', user.user_id);
        
        await supabaseAdmin
          .from('instagram_business_accounts')
          .delete()
          .eq('user_id', user.user_id);
        
        await supabaseAdmin
          .from('user_profiles')
          .delete()
          .eq('user_id', user.user_id);
        
        deletedCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} test users`
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;