// backend.api/routes/agents/ugc.js
// UGC Discovery endpoints: /search-hashtag, /tags, /repost-ugc, /sync-ugc

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getSupabaseAdmin, logApiRequest, logAudit } = require('../../config/supabase');
const {
  resolveAccountCredentials,
  ensureMediaRecord,
  syncHashtagsFromCaptions,
  GRAPH_API_BASE,
} = require('../../helpers/agent-helpers');

// ============================================
// ENDPOINT 1: POST /search-hashtag (UGC Discovery)
// ============================================

/**
 * Searches for recent media posts by hashtag
 * Used by: UGC discovery scheduler (scheduler/ugc_discovery.py)
 */
router.post('/search-hashtag', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, hashtag, limit } = req.body;

  try {
    if (!business_account_id || !hashtag) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, hashtag'
      });
    }

    const searchLimit = Math.min(limit || 25, 50);
    const cleanHashtag = hashtag.replace(/^#/, '');

    const { igUserId, pageToken } = await resolveAccountCredentials(business_account_id);

    // Step 1: Search for hashtag ID
    const hashtagSearchRes = await axios.get(`${GRAPH_API_BASE}/ig_hashtag_search`, {
      params: {
        user_id: igUserId,
        q: cleanHashtag,
        access_token: pageToken
      }
    });

    const hashtagId = hashtagSearchRes.data?.data?.[0]?.id;
    if (!hashtagId) {
      return res.status(404).json({ error: `Hashtag not found: #${cleanHashtag}` });
    }

    // Step 2: Get recent media for hashtag
    const mediaRes = await axios.get(`${GRAPH_API_BASE}/${hashtagId}/recent_media`, {
      params: {
        user_id: igUserId,
        fields: 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username,like_count,comments_count,owner{id}',
        limit: searchLimit,
        access_token: pageToken
      }
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/search-hashtag',
      method: 'POST',
      business_account_id,
      user_id: igUserId,
      success: true,
      latency
    });

    // Flatten owner{id} → owner_id for agent compatibility
    const media = (mediaRes.data.data || []).map(item => ({
      ...item,
      owner_id: item.owner?.id || null,
    }));

    // Supabase write-through: raw UGC for agent scoring pipeline
    if (media.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const ugcRecords = media
            .filter(m => m.id)
            .map(m => ({
              business_account_id,
              instagram_media_id: m.id,
              source: 'hashtag',
              source_hashtag: cleanHashtag,
              username: m.username || null,
              caption: (m.caption || '').slice(0, 2000),
              media_type: m.media_type || null,
              media_url: m.media_url || m.thumbnail_url || null,
              permalink: m.permalink || null,
              like_count: m.like_count || 0,
              comments_count: m.comments_count || 0,
              post_timestamp: m.timestamp || null,
              quality_score: null,
              quality_tier: null,
            }));
          const { error: upsertErr } = await supabase
            .from('ugc_discovered')
            .upsert(ugcRecords, { onConflict: 'instagram_media_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('⚠️ UGC hashtag write-through failed:', upsertErr.message);
        }
      } catch (wtErr) {
        console.warn('⚠️ UGC hashtag write-through error:', wtErr.message);
      }
    }

    res.json({ recent_media: media, data: media });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/search-hashtag',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Hashtag search failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 2: GET /tags (UGC Discovery)
// ============================================

/**
 * Gets posts where the business account is tagged
 * Used by: UGC discovery scheduler (scheduler/ugc_discovery.py)
 */
router.get('/tags', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, limit } = req.query;

  try {
    if (!business_account_id) {
      return res.status(400).json({
        error: 'Missing required query parameter: business_account_id'
      });
    }

    const fetchLimit = Math.min(limit || 25, 50);

    const { igUserId, pageToken } = await resolveAccountCredentials(business_account_id);

    const tagsRes = await axios.get(`${GRAPH_API_BASE}/${igUserId}/tags`, {
      params: {
        fields: 'id,media_type,media_url,thumbnail_url,caption,permalink,timestamp,username,like_count,comments_count',
        limit: fetchLimit,
        access_token: pageToken
      }
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/tags',
      method: 'GET',
      business_account_id,
      user_id: igUserId,
      success: true,
      latency
    });

    const taggedPosts = tagsRes.data.data || [];

    // Supabase write-through: raw tagged UGC for agent scoring pipeline
    if (taggedPosts.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const ugcRecords = taggedPosts
            .filter(p => p.id)
            .map(p => ({
              business_account_id,
              instagram_media_id: p.id,
              source: 'tagged',
              source_hashtag: null,
              username: p.username || null,
              caption: (p.caption || '').slice(0, 2000),
              media_type: p.media_type || null,
              media_url: p.media_url || p.thumbnail_url || null,
              permalink: p.permalink || null,
              like_count: p.like_count || 0,
              comments_count: p.comments_count || 0,
              post_timestamp: p.timestamp || null,
              quality_score: null,
              quality_tier: null,
            }));
          const { error: upsertErr } = await supabase
            .from('ugc_discovered')
            .upsert(ugcRecords, { onConflict: 'instagram_media_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('⚠️ UGC tags write-through failed:', upsertErr.message);
        }
      } catch (wtErr) {
        console.warn('⚠️ UGC tags write-through error:', wtErr.message);
      }
    }

    res.json({ tagged_posts: taggedPosts, data: taggedPosts });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/tags',
      method: 'GET',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Tagged posts fetch failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
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
