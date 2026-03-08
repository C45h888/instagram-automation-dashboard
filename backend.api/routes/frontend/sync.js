// backend.api/routes/frontend/sync.js
// Data sync routes: sync UGC tagged posts, sync business posts
const express = require('express');
const router = express.Router();
const { syncTaggedPosts, syncBusinessPosts } = require('../../services/instagram-sync');
const { retrievePageToken, logAudit: logAuditService } = require('../../services/instagram-tokens');
const { getSupabaseAdmin } = require('../../config/supabase');

const logAudit = logAuditService;

// ==========================================
// ROUTES
// ==========================================

/**
 * POST /api/instagram/sync/ugc
 * Triggers background sync of tagged posts from Instagram to database
 */
router.post('/sync/ugc', async (req, res) => {
  try {
    const { businessAccountId } = req.body;

    if (!businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'businessAccountId is required'
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: bizAccount, error: bizError } = await supabase
      .from('instagram_business_accounts')
      .select('user_id, instagram_business_id')
      .eq('id', businessAccountId)
      .single();

    if (bizError || !bizAccount) {
      return res.status(404).json({
        success: false,
        error: 'Business account not found'
      });
    }

    let pageToken;
    try {
      pageToken = await retrievePageToken(bizAccount.user_id, businessAccountId);
    } catch (tokenErr) {
      return res.status(401).json({
        success: false,
        error: tokenErr.message,
        code: tokenErr.code || 'TOKEN_ERROR'
      });
    }

    const result = await syncTaggedPosts(
      businessAccountId,
      bizAccount.instagram_business_id,
      pageToken
    );

    res.json(result);

    await logAudit('ugc_sync_completed', null, {
      business_account_id: businessAccountId,
      synced_count: result.synced_count
    });

  } catch (error) {
    console.error('[Sync] UGC sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Sync failed'
    });
  }
});

/**
 * POST /api/instagram/sync/posts
 * Triggers background sync of business media from Instagram to database
 */
router.post('/sync/posts', async (req, res) => {
  try {
    const { businessAccountId } = req.body;

    if (!businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'businessAccountId is required'
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: bizAccount, error: bizError } = await supabase
      .from('instagram_business_accounts')
      .select('user_id, instagram_business_id')
      .eq('id', businessAccountId)
      .single();

    if (bizError || !bizAccount) {
      return res.status(404).json({
        success: false,
        error: 'Business account not found'
      });
    }

    let pageToken;
    try {
      pageToken = await retrievePageToken(bizAccount.user_id, businessAccountId);
    } catch (tokenErr) {
      return res.status(401).json({
        success: false,
        error: tokenErr.message,
        code: tokenErr.code || 'TOKEN_ERROR'
      });
    }

    const result = await syncBusinessPosts(
      businessAccountId,
      bizAccount.instagram_business_id,
      pageToken
    );

    res.json(result);

    await logAudit('business_posts_sync_completed', null, {
      business_account_id: businessAccountId,
      synced_count: result.synced_count
    });

  } catch (error) {
    console.error('[Sync] Posts sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Sync failed'
    });
  }
});

module.exports = router;
