// backend.api/routes/agents/ugc.js
// UGC Discovery endpoints: /search-hashtag, /tags, /repost-ugc, /sync-ugc

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getSupabaseAdmin, logApiRequest, logAudit } = require('../../config/supabase');
const {
  resolveAccountCredentials,
  GRAPH_API_BASE,
} = require('../../helpers/agent-helpers');
const {
  fetchAndStoreHashtagMedia,
  fetchAndStoreTaggedMedia,
} = require('../../helpers/data-fetchers');

// ============================================
// ENDPOINT 1: POST /search-hashtag (UGC Discovery)
// ============================================

/**
 * Searches for recent media posts by hashtag.
 * Used by: UGC discovery scheduler (scheduler/ugc_discovery.py)
 * Delegates to fetchAndStoreHashtagMedia() for Graph API + Supabase logic.
 */
router.post('/search-hashtag', async (req, res) => {
  const { business_account_id, hashtag, limit } = req.body;

  // HTTP validation
  if (!business_account_id || !hashtag) {
    return res.status(400).json({
      error: 'Missing required fields: business_account_id, hashtag'
    });
  }

  const result = await fetchAndStoreHashtagMedia(business_account_id, hashtag, limit);

  if (!result.success) {
    // Distinguish "not found" from server error
    const isNotFound = result.error && result.error.includes('Hashtag not found');
    return res.status(isNotFound ? 404 : 500).json({
      error: result.error,
      code: undefined
    });
  }

  res.json({ recent_media: result.media, data: result.media });
});

// ============================================
// ENDPOINT 2: GET /tags (UGC Discovery)
// ============================================

/**
 * Gets posts where the business account is tagged.
 * Used by: UGC discovery scheduler (scheduler/ugc_discovery.py)
 * Delegates to fetchAndStoreTaggedMedia() for Graph API + Supabase logic.
 */
router.get('/tags', async (req, res) => {
  const { business_account_id, limit } = req.query;

  if (!business_account_id) {
    return res.status(400).json({
      error: 'Missing required query parameter: business_account_id'
    });
  }

  const result = await fetchAndStoreTaggedMedia(business_account_id, limit);

  if (!result.success) {
    return res.status(500).json({
      error: result.error,
      code: undefined
    });
  }

  res.json({ tagged_posts: result.taggedPosts, data: result.taggedPosts });
});

// ============================================
// ENDPOINT 12: POST /repost-ugc (UGC Discovery)
// ============================================

/**
 * Reposts UGC content to the business Instagram account after verifying permission.
 * Used by: UGC discovery scheduler after creator grants permission.
 */
router.post('/repost-ugc', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, permission_id } = req.body;

  try {
    if (!business_account_id || !permission_id) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, permission_id'
      });
    }

    const supabase = getSupabaseAdmin();

    // Step 1: Fetch permission record — must exist and be 'granted'
    const { data: permission, error: permError } = await supabase
      .from('ugc_permissions')
      .select('id, ugc_discovered_id, username, status, business_account_id')
      .eq('id', permission_id)
      .eq('business_account_id', business_account_id)
      .single();

    if (permError || !permission) {
      return res.status(404).json({
        error: 'Permission record not found',
        code: 'PERMISSION_NOT_FOUND'
      });
    }

    if (permission.status !== 'granted') {
      return res.status(403).json({
        error: 'Cannot repost: permission not granted by content creator',
        code: 'PERMISSION_DENIED',
        details: { current_status: permission.status }
      });
    }

    // Step 2: Fetch UGC media data from ugc_discovered
    const { data: ugcDiscovered, error: ugcError } = await supabase
      .from('ugc_discovered')
      .select('id, media_url, media_type, caption, username')
      .eq('id', permission.ugc_discovered_id)
      .single();

    if (ugcError || !ugcDiscovered) {
      return res.status(404).json({
        error: 'UGC content record not found',
        code: 'CONTENT_NOT_FOUND'
      });
    }

    const mediaUrl = ugcDiscovered.media_url;
    if (!mediaUrl) {
      return res.status(400).json({ error: 'UGC content has no media URL', code: 'NO_MEDIA_URL' });
    }

    // Step 3: Resolve credentials and publish (2-step: container → publish)
    const { igUserId, pageToken, userId } = await resolveAccountCredentials(business_account_id);

    const caption = ugcDiscovered.caption
      ? `📸 @${ugcDiscovered.username}: ${ugcDiscovered.caption}\n\n#repost`
      : `📸 @${ugcDiscovered.username}\n\n#repost`;

    const createRes = await axios.post(`${GRAPH_API_BASE}/${igUserId}/media`, null, {
      params: { image_url: mediaUrl, caption, access_token: pageToken },
      timeout: 15000
    });

    const creationId = createRes.data.id;
    if (!creationId) throw new Error('Failed to create media container');

    const publishRes = await axios.post(`${GRAPH_API_BASE}/${igUserId}/media_publish`, null, {
      params: { creation_id: creationId, access_token: pageToken },
      timeout: 15000
    });

    const mediaId = publishRes.data.id;
    const latency = Date.now() - startTime;

    // Link published media to permission record (status stays 'granted'; repost tracked via instagram_media)
    await supabase
      .from('ugc_permissions')
      .update({
        instagram_media_id: mediaId
      })
      .eq('id', permission_id);

    await logApiRequest({
      endpoint: '/repost-ugc',
      method: 'POST',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    await logAudit({
      event_type: 'ugc_reposted',
      action: 'repost',
      resource_type: 'ugc_permissions',
      resource_id: mediaId,
      details: { permission_id, ugc_discovered_id: permission.ugc_discovered_id, author: ugcDiscovered.username },
      success: true
    });

    res.json({ success: true, id: mediaId, original_author: ugcDiscovered.username });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/repost-ugc',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ UGC repost failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 13: POST /sync-ugc (UGC / Analytics)
// ============================================

/**
 * Triggers a fresh sync of tagged/UGC posts from Instagram Graph API into Supabase.
 * Used by: UGC discovery scheduler after processing tags.
 */
router.post('/sync-ugc', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id } = req.body;

  try {
    if (!business_account_id) {
      return res.status(400).json({ error: 'Missing required field: business_account_id' });
    }

    const { igUserId, pageToken, userId } = await resolveAccountCredentials(business_account_id);

    const tagsRes = await axios.get(`${GRAPH_API_BASE}/${igUserId}/tags`, {
      params: {
        fields: 'id,media_type,media_url,thumbnail_url,caption,permalink,timestamp,username,like_count,comments_count',
        limit: 50,
        access_token: pageToken
      },
      timeout: 15000
    });

    const taggedPosts = tagsRes.data.data || [];
    const supabase = getSupabaseAdmin();
    let syncedCount = 0;

    if (taggedPosts.length > 0) {
      const records = taggedPosts.map(post => ({
        business_account_id,
        instagram_media_id: post.id,
        username: post.username || null,
        media_type: post.media_type,
        media_url: post.media_url || post.thumbnail_url || null,
        caption: post.caption || null,
        permalink: post.permalink,
        post_timestamp: post.timestamp,
        like_count: post.like_count || 0,
        comments_count: post.comments_count || 0,
        source: 'tagged',
        quality_tier: null,
        quality_score: null
      }));

      const { error: upsertError } = await supabase
        .from('ugc_discovered')
        .upsert(records, { onConflict: 'instagram_media_id', ignoreDuplicates: false });

      if (!upsertError) syncedCount = records.length;
    }

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/sync-ugc',
      method: 'POST',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    res.json({ success: true, synced_count: syncedCount });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/sync-ugc',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ UGC sync failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

module.exports = router;
