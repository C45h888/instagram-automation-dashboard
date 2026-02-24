// backend.api/helpers/data-fetchers.js
// Pure data functions extracted from route handlers.
// Each function fetches from Instagram Graph API and upserts to Supabase.
// No req/res dependencies — callable from both routes and cron jobs.

const axios = require('axios');
const { getSupabaseAdmin, logApiRequest } = require('../config/supabase');
const {
  resolveAccountCredentials,
  ensureMediaRecord,
  syncHashtagsFromCaptions,
  categorizeIgError,
  GRAPH_API_BASE,
} = require('./agent-helpers');
const { mapRawPostToUgcContent } = require('./ugc-field-map');
const { getAccountInsights } = require('../services/instagram-tokens');

// ============================================
// COMMENTS
// ============================================

/**
 * Fetches comments for a media post and upserts to instagram_comments.
 * Extracted from: routes/agents/engagement.js GET /post-comments
 *
 * @param {string} businessAccountId - UUID from instagram_business_accounts
 * @param {string} mediaId - Instagram media ID (numeric string)
 * @param {number} [limit=50] - Max comments to fetch (capped at 100)
 * @returns {Promise<{success: boolean, comments: Array, count: number, paging: Object, error?: string}>}
 */
async function fetchAndStoreComments(businessAccountId, mediaId, limit = 50) {
  const startTime = Date.now();
  const fetchLimit = Math.min(parseInt(limit) || 50, 100);

  try {
    const { pageToken, userId } = await resolveAccountCredentials(businessAccountId);

    const commentsRes = await axios.get(`${GRAPH_API_BASE}/${mediaId}/comments`, {
      params: {
        fields: 'id,text,timestamp,username,like_count,replies_count',
        limit: fetchLimit,
        access_token: pageToken
      },
      timeout: 10000
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/post-comments',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: userId,
      success: true,
      latency
    }).catch(() => {});

    const comments = commentsRes.data.data || [];

    // Supabase write-through: upsert comments + ensure instagram_media record exists
    if (comments.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const mediaUUID = await ensureMediaRecord(supabase, mediaId, businessAccountId);
          if (mediaUUID) {
            const commentRecords = comments
              .filter(c => c.id)
              .map(c => ({
                instagram_comment_id: c.id,
                text: c.text || '',
                author_username: c.username || '',
                author_instagram_id: null,
                media_id: mediaUUID,
                business_account_id: businessAccountId,
                created_at: c.timestamp,
                like_count: c.like_count || 0,
                // processed_by_automation omitted — DB DEFAULT false on insert, preserved on update
              }));
            const { error: upsertErr } = await supabase
              .from('instagram_comments')
              .upsert(commentRecords, { onConflict: 'instagram_comment_id', ignoreDuplicates: false });
            if (upsertErr) console.warn('[DataFetcher] Comment upsert failed:', upsertErr.message);
          }
        }
      } catch (wtErr) {
        console.warn('[DataFetcher] Comment write-through error:', wtErr.message);
      }
    }

    return {
      success: true,
      comments,
      count: comments.length,
      paging: commentsRes.data.paging || {}
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/post-comments',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    }).catch(() => {});

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, comments: [], count: 0, paging: {}, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

// ============================================
// CONVERSATIONS
// ============================================

/**
 * Fetches DM conversations with 24h window status and upserts to instagram_dm_conversations.
 * Extracted from: routes/agents/engagement.js GET /conversations
 *
 * @param {string} businessAccountId - UUID
 * @param {number} [limit=20] - Max conversations (capped at 50)
 * @returns {Promise<{success: boolean, conversations: Array, count: number, paging: Object, error?: string}>}
 */
async function fetchAndStoreConversations(businessAccountId, limit = 20) {
  const startTime = Date.now();
  const fetchLimit = Math.min(parseInt(limit) || 20, 50);

  try {
    const { igUserId, pageToken, userId } = await resolveAccountCredentials(businessAccountId);

    const convRes = await axios.get(`${GRAPH_API_BASE}/${igUserId}/conversations`, {
      params: {
        fields: 'id,participants,updated_time,message_count,messages{created_time,from}',
        platform: 'instagram',
        limit: fetchLimit,
        access_token: pageToken
      },
      timeout: 10000
    });

    // Transform with 24-hour window calculation
    const now = new Date();
    const conversations = (convRes.data.data || []).map(conv => {
      const lastMessage = conv.messages?.data?.[0];
      const lastMessageTime = lastMessage ? new Date(lastMessage.created_time) : null;
      const hoursSinceLastMessage = lastMessageTime
        ? (now - lastMessageTime) / (1000 * 60 * 60)
        : null;
      const isWithin24Hours = hoursSinceLastMessage !== null && hoursSinceLastMessage < 24;
      const hoursRemaining = hoursSinceLastMessage !== null
        ? Math.max(0, 24 - hoursSinceLastMessage)
        : null;

      return {
        id: conv.id,
        participants: conv.participants?.data || [],
        last_message_at: conv.updated_time,
        message_count: conv.message_count || 0,
        last_message: lastMessage || null,
        messaging_window: {
          is_open: isWithin24Hours,
          hours_remaining: hoursRemaining !== null ? parseFloat(hoursRemaining.toFixed(1)) : null,
          requires_template: hoursSinceLastMessage !== null && hoursSinceLastMessage >= 24,
          last_customer_message_at: lastMessageTime ? lastMessageTime.toISOString() : null
        },
        within_window: isWithin24Hours,
        can_send_messages: isWithin24Hours
      };
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/conversations',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: userId,
      success: true,
      latency
    }).catch(() => {});

    // Supabase write-through: upsert DM conversations with 24h window status
    if (conversations.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const convRecords = conversations
            .filter(conv => conv.participants?.length > 0 && conv.participants[0].id)
            .map(conv => {
              const mw = conv.messaging_window || {};
              const isOpen = mw.is_open || false;
              const hr = mw.hours_remaining;
              const windowExpiresAt = isOpen && hr != null
                ? new Date(Date.now() + hr * 3600000).toISOString()
                : null;
              return {
                instagram_thread_id: conv.id,
                customer_instagram_id: conv.participants[0].id,
                business_account_id: businessAccountId,
                within_window: isOpen,
                window_expires_at: windowExpiresAt,
                last_message_at: conv.last_message_at,
                message_count: conv.message_count || 0,
                conversation_status: 'active',
              };
            });
          if (convRecords.length > 0) {
            const { error: upsertErr } = await supabase
              .from('instagram_dm_conversations')
              .upsert(convRecords, { onConflict: 'instagram_thread_id', ignoreDuplicates: false });
            if (upsertErr) console.warn('[DataFetcher] Conversation upsert failed:', upsertErr.message);
          }
        }
      } catch (wtErr) {
        console.warn('[DataFetcher] Conversation write-through error:', wtErr.message);
      }
    }

    return {
      success: true,
      conversations,
      count: conversations.length,
      paging: convRes.data.paging || {}
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/conversations',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    }).catch(() => {});

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, conversations: [], count: 0, paging: {}, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

// ============================================
// CONVERSATION MESSAGES
// ============================================

/**
 * Fetches messages for a single DM conversation and upserts to instagram_dm_messages.
 * Extracted from: routes/agents/engagement.js GET /conversation-messages
 *
 * @param {string} businessAccountId - UUID
 * @param {string} conversationId - Instagram thread ID
 * @param {number} [limit=20] - Max messages (capped at 100)
 * @returns {Promise<{success: boolean, messages: Array, count: number, paging: Object, error?: string}>}
 */
async function fetchAndStoreMessages(businessAccountId, conversationId, limit = 20) {
  const startTime = Date.now();
  const fetchLimit = Math.min(parseInt(limit) || 20, 100);

  try {
    const { igUserId, pageToken, userId } = await resolveAccountCredentials(businessAccountId);

    const msgRes = await axios.get(`${GRAPH_API_BASE}/${conversationId}/messages`, {
      params: {
        fields: 'id,message,from,created_time,attachments',
        limit: fetchLimit,
        access_token: pageToken
      },
      timeout: 10000
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/conversation-messages',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: userId,
      success: true,
      latency
    }).catch(() => {});

    const messages = msgRes.data.data || [];

    // Supabase write-through: upsert messages with is_from_business flag
    if (messages.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          // Resolve IG thread ID → Supabase UUID for conversation FK
          let conversationUUID = null;
          const { data: conv } = await supabase
            .from('instagram_dm_conversations')
            .select('id')
            .eq('instagram_thread_id', conversationId)
            .maybeSingle();
          conversationUUID = conv?.id || null;

          const msgRecords = messages
            .filter(m => m.id)
            .map(m => ({
              instagram_message_id: m.id,
              message_text: m.message || '',
              conversation_id: conversationUUID,
              business_account_id: businessAccountId,
              is_from_business: m.from?.id === igUserId,
              recipient_instagram_id: m.from?.id || '',
              sent_at: m.created_time,
              send_status: 'delivered',
            }));
          const { error: upsertErr } = await supabase
            .from('instagram_dm_messages')
            .upsert(msgRecords, { onConflict: 'instagram_message_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('[DataFetcher] Message upsert failed:', upsertErr.message);
        }
      } catch (wtErr) {
        console.warn('[DataFetcher] Message write-through error:', wtErr.message);
      }
    }

    return {
      success: true,
      messages,
      count: messages.length,
      paging: msgRes.data.paging || {}
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/conversation-messages',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    }).catch(() => {});

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, messages: [], count: 0, paging: {}, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

// ============================================
// HASHTAG MEDIA (UGC)
// ============================================

/**
 * Searches hashtag media and upserts to ugc_content.
 * Extracted from: routes/agents/ugc.js POST /search-hashtag
 *
 * @param {string} businessAccountId - UUID
 * @param {string} hashtag - Hashtag string (with or without #)
 * @param {number} [limit=25] - Max media (capped at 50)
 * @returns {Promise<{success: boolean, media: Array, count: number, hashtagId?: string, error?: string}>}
 */
async function fetchAndStoreHashtagMedia(businessAccountId, hashtag, limit = 25) {
  const startTime = Date.now();
  const searchLimit = Math.min(parseInt(limit) || 25, 50);
  const cleanHashtag = String(hashtag).replace(/^#/, '');

  try {
    const { igUserId, pageToken } = await resolveAccountCredentials(businessAccountId);

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
      return { success: false, media: [], count: 0, error: `Hashtag not found: #${cleanHashtag}` };
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
      business_account_id: businessAccountId,
      user_id: igUserId,
      success: true,
      latency
    }).catch(() => {});

    // Flatten owner{id} → owner_id for agent compatibility
    const media = (mediaRes.data.data || []).map(item => ({
      ...item,
      owner_id: item.owner?.id || null,
    }));

    // Supabase write-through: raw UGC into unified ugc_content (agent enriches quality fields later)
    if (media.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const ugcRecords = media
            .filter(m => m.id)
            .map(m => mapRawPostToUgcContent(m, businessAccountId, 'hashtag', cleanHashtag));
          const { error: upsertErr } = await supabase
            .from('ugc_content')
            .upsert(ugcRecords, { onConflict: 'business_account_id,visitor_post_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('[DataFetcher] UGC hashtag upsert failed:', upsertErr.message);
        }
      } catch (wtErr) {
        console.warn('[DataFetcher] UGC hashtag write-through error:', wtErr.message);
      }
    }

    return { success: true, media, count: media.length, hashtagId };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/search-hashtag',
      method: 'POST',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    }).catch(() => {});

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, media: [], count: 0, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

// ============================================
// TAGGED MEDIA (UGC)
// ============================================

/**
 * Fetches tagged posts and upserts to ugc_content.
 * Extracted from: routes/agents/ugc.js GET /tags
 *
 * @param {string} businessAccountId - UUID
 * @param {number} [limit=25] - Max tagged posts (capped at 50)
 * @returns {Promise<{success: boolean, taggedPosts: Array, count: number, error?: string}>}
 */
async function fetchAndStoreTaggedMedia(businessAccountId, limit = 25) {
  const startTime = Date.now();
  const fetchLimit = Math.min(parseInt(limit) || 25, 50);

  try {
    const { igUserId, pageToken } = await resolveAccountCredentials(businessAccountId);

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
      business_account_id: businessAccountId,
      user_id: igUserId,
      success: true,
      latency
    }).catch(() => {});

    const taggedPosts = tagsRes.data.data || [];

    // Supabase write-through: raw tagged UGC into unified ugc_content (agent enriches quality fields later)
    if (taggedPosts.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const ugcRecords = taggedPosts
            .filter(p => p.id)
            .map(p => mapRawPostToUgcContent(p, businessAccountId, 'tagged', null));
          const { error: upsertErr } = await supabase
            .from('ugc_content')
            .upsert(ugcRecords, { onConflict: 'business_account_id,visitor_post_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('[DataFetcher] UGC tags upsert failed:', upsertErr.message);
        }
      } catch (wtErr) {
        console.warn('[DataFetcher] UGC tags write-through error:', wtErr.message);
      }
    }

    return { success: true, taggedPosts, count: taggedPosts.length };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/tags',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    }).catch(() => {});

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, taggedPosts: [], count: 0, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

// ============================================
// MEDIA INSIGHTS
// ============================================

/**
 * Fetches media insights (reach, impressions) and upserts to instagram_media.
 * Also syncs hashtags from captions into ugc_monitored_hashtags.
 * Extracted from: helpers/agent-helpers.js handleInsightsRequest() media branch.
 *
 * @param {string} businessAccountId - UUID
 * @param {string|number} [since] - ISO date string or unix timestamp
 * @param {string|number} [until] - ISO date string or unix timestamp
 * @returns {Promise<{success: boolean, mediaInsights: Array, count: number, error?: string}>}
 */
async function fetchAndStoreMediaInsights(businessAccountId, since, until) {
  const startTime = Date.now();

  try {
    const { igUserId, pageToken } = await resolveAccountCredentials(businessAccountId);

    const mediaUrl = `${GRAPH_API_BASE}/${igUserId}/media`;
    const mediaParams = {
      fields: 'id,media_type,timestamp,caption',
      limit: 50,
      access_token: pageToken
    };
    if (since) mediaParams.since = typeof since === 'number' ? since : Math.floor(new Date(since).getTime() / 1000);
    if (until) mediaParams.until = typeof until === 'number' ? until : Math.floor(new Date(until).getTime() / 1000);

    const mediaRes = await axios.get(mediaUrl, { params: mediaParams });
    const mediaList = mediaRes.data.data || [];

    const INSIGHTS_BATCH_SIZE = 5;
    const INSIGHTS_BATCH_DELAY_MS = 500;

    const fetchInsightsForMedia = async (media) => {
      try {
        const insightsRes = await axios.get(`${GRAPH_API_BASE}/${media.id}/insights`, {
          params: {
            metric: 'reach,impressions,saved',
            access_token: pageToken
          }
        });
        return {
          media_id: media.id,
          media_type: media.media_type,
          timestamp: media.timestamp,
          insights: insightsRes.data.data || []
        };
      } catch (err) {
        console.warn(`[DataFetcher] Failed to fetch insights for media ${media.id}:`, err.message);
        return {
          media_id: media.id,
          media_type: media.media_type,
          timestamp: media.timestamp,
          insights: [],
          error: err.message
        };
      }
    };

    const mediaInsights = [];
    for (let i = 0; i < mediaList.length; i += INSIGHTS_BATCH_SIZE) {
      const batch = mediaList.slice(i, i + INSIGHTS_BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(fetchInsightsForMedia));
      mediaInsights.push(...batchResults);
      // Pause between batches to avoid rate-limit bursts (skip delay after last batch)
      if (i + INSIGHTS_BATCH_SIZE < mediaList.length) {
        await new Promise(resolve => setTimeout(resolve, INSIGHTS_BATCH_DELAY_MS));
      }
    }

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/media-insights',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: igUserId,
      success: true,
      latency
    }).catch(() => {});

    // Supabase write-through: upsert instagram_media metrics + sync hashtags
    if (mediaInsights.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const mediaRecords = mediaInsights.map(m => ({
            instagram_media_id: m.media_id,
            business_account_id: businessAccountId,
            media_type: m.media_type || null,
            reach: m.insights.find(i => i.name === 'reach')?.values?.[0]?.value || 0,
            impressions: m.insights.find(i => i.name === 'impressions')?.values?.[0]?.value || 0,
            saves: m.insights.find(i => i.name === 'saved')?.values?.[0]?.value || 0,
            published_at: m.timestamp || null,
          }));
          const { error: mediaErr } = await supabase
            .from('instagram_media')
            .upsert(mediaRecords, { onConflict: 'instagram_media_id', ignoreDuplicates: false });
          if (mediaErr) console.warn('[DataFetcher] instagram_media insights upsert failed:', mediaErr.message);

          const captions = mediaList.map(m => m.caption).filter(Boolean);
          await syncHashtagsFromCaptions(supabase, businessAccountId, captions);
        }
      } catch (wtErr) {
        console.warn('[DataFetcher] Media insights write-through error:', wtErr.message);
      }
    }

    return { success: true, mediaInsights, count: mediaInsights.length };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/media-insights',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    }).catch(() => {});

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, mediaInsights: [], count: 0, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

// ============================================
// ACCOUNT INSIGHTS
// ============================================

/**
 * Fetches account-level insights.
 * Thin wrapper around getAccountInsights() from instagram-tokens.js.
 *
 * @param {string} businessAccountId - UUID
 * @param {Object} [options] - {since, until, period}
 * @returns {Promise<{success: boolean, data: Object, error?: string}>}
 */
async function fetchAndStoreAccountInsights(businessAccountId, options = {}) {
  const startTime = Date.now();

  try {
    const { igUserId, pageToken } = await resolveAccountCredentials(businessAccountId);

    const accountInsights = await getAccountInsights(igUserId, pageToken, options);

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/account-insights',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: igUserId,
      success: true,
      latency
    }).catch(() => {});

    return { success: true, data: accountInsights };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/account-insights',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    }).catch(() => {});

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, data: {}, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

module.exports = {
  fetchAndStoreComments,
  fetchAndStoreConversations,
  fetchAndStoreMessages,
  fetchAndStoreHashtagMedia,
  fetchAndStoreTaggedMedia,
  fetchAndStoreMediaInsights,
  fetchAndStoreAccountInsights,
};
