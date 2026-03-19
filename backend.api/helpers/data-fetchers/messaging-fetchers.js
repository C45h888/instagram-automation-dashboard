// backend.api/helpers/data-fetchers/messaging-fetchers.js
// Domain: messaging — comments, DM conversations, DM messages.
// Fetches from Instagram Graph API and upserts to Supabase.
// No req/res dependencies — callable from routes and proactive-sync cron.
//
// All api_usage rows written with domain='messaging' for targeted debugging:
//   SELECT * FROM api_usage WHERE domain = 'messaging' AND success = false ORDER BY created_at DESC
//
// Thin fetch/write split:
//   fetchComments()  — IG API call only, returns raw records
//   fetchMessages()  — IG API call only, returns raw records
//   fetchAndStoreComments()  — shim: fetchComments + storeCommentBatches (route compat)
//   fetchAndStoreMessages()  — shim: fetchMessages + storeMessageBatches + query-back (route compat)
//   fetchAndStoreConversations() — unchanged (called once per account, no inner loop)

const {
  axios,
  getSupabaseAdmin,
  resolveAccountCredentials,
  categorizeIgError,
  GRAPH_API_BASE,
  logWithDomain,
  transformMessage,
  storeCommentBatches,
  storeMessageBatches,
  parseUsageHeader,
} = require('./base');

// ============================================
// COMMENTS — THIN FETCH
// ============================================

/**
 * Fetches comments for a media post from the Instagram Graph API.
 * NO DB write — callers use storeCommentBatches for batch persistence.
 *
 * API note: Meta caps comments at 50 per query. Fields verified against Meta docs —
 * replies_count is NOT a valid field (only a replies edge); removed.
 *
 * @param {string} businessAccountId - UUID
 * @param {string} mediaId - Instagram media ID (numeric string)
 * @param {number} [limit=50] - Max comments (capped at 50 per Meta docs)
 * @returns {Promise<{success: boolean, records: Array, count: number, paging: Object, error?: string}>}
 */
async function fetchComments(businessAccountId, mediaId, limit = 50, credentials = null) {
  const startTime = Date.now();
  const fetchLimit = Math.min(parseInt(limit) || 50, 50); // Meta docs: max 50 per query

  try {
    const { pageToken, userId } = credentials || await resolveAccountCredentials(businessAccountId);

    const commentsRes = await axios.get(`${GRAPH_API_BASE}/${mediaId}/comments`, {
      params: {
        fields: 'id,text,timestamp,username,like_count', // replies_count removed — not a valid field
        limit: fetchLimit,
        access_token: pageToken
      },
      timeout: 10000
    });

    const latency = Date.now() - startTime;

    await logWithDomain('messaging', {
      endpoint: '/post-comments',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: userId,
      success: true,
      latency
    });

    const records = commentsRes.data.data || [];
    const paging = commentsRes.data.paging || {};

    if (paging.next) {
      logWithDomain('messaging', {
        endpoint: '/post-comments/paging', method: 'SYSTEM', success: true,
        business_account_id: businessAccountId,
        details: { action: 'paging_next_detected', items_this_page: records.length, next_cursor_present: true },
      }).catch(() => {});
    }

    return {
      success: true, records, count: records.length, paging,
      _usagePct: parseUsageHeader(commentsRes.headers?.['x-business-use-case-usage']),
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;
    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);

    await logWithDomain('messaging', {
      endpoint: '/post-comments',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency,
      status_code: error.response?.status || null,
      details: { action: 'proxy_failure', error_category, retryable, retry_after_seconds: retry_after_seconds || null, latency_ms: latency },
    });

    return {
      success: false, records: [], count: 0, paging: {}, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

// ============================================
// COMMENTS — SHIM (route backward-compat)
// ============================================

/**
 * Fetches and persists comments for a single media post.
 * Shim wrapping fetchComments + storeCommentBatches.
 * Routes call this unchanged; domain loops call fetchComments directly for batch parallelism.
 *
 * @param {string} businessAccountId
 * @param {string} mediaId
 * @param {number} [limit=50]
 * @returns {Promise<{success: boolean, comments: Array, count: number, paging: Object, error?: string}>}
 */
async function fetchAndStoreComments(businessAccountId, mediaId, limit = 50) {
  const result = await fetchComments(businessAccountId, mediaId, limit);
  if (result.success && result.records.length > 0) {
    await storeCommentBatches(businessAccountId, [{ mediaId, comments: result.records }]);
  }
  // backward-compat: callers expect .comments, not .records
  return { ...result, comments: result.records };
}

// ============================================
// CONVERSATIONS
// ============================================

/**
 * Fetches DM conversations with 24h window status and upserts to instagram_dm_conversations.
 * Called once per account per tick — no inner loop, no parallelisation needed.
 *
 * @param {string} businessAccountId - UUID
 * @param {number} [limit=20] - Max conversations (capped at 50)
 * @returns {Promise<{success: boolean, conversations: Array, count: number, paging: Object, error?: string}>}
 */
async function fetchAndStoreConversations(businessAccountId, limit = 20) {
  const startTime = Date.now();
  const fetchLimit = Math.min(parseInt(limit) || 20, 50);

  try {
    const { igUserId, pageToken, userId, pageId } = await resolveAccountCredentials(businessAccountId);

    // Meta docs: GET /{page-id}/conversations?platform=INSTAGRAM
    // pageId = Facebook Page ID (e.g. "632688196603930"), NOT igUserId (IG User ID)
    const conversationNode = pageId || igUserId;
    const convRes = await axios.get(`${GRAPH_API_BASE}/${conversationNode}/conversations`, {
      params: {
        fields: 'id,participants{id,username},updated_time,message_count,messages.limit(1){created_time,from{id}}',
        platform: 'INSTAGRAM',
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

    await logWithDomain('messaging', {
      endpoint: '/conversations',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: userId,
      success: true,
      latency
    });

    // Supabase write-through: upsert DM conversations with 24h window status.
    // DB is the shared source of truth — frontend/inbox.js reads its own shaped view from these tables.
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
              // participants includes both business and customer — find the non-business one
              const customerParticipant = conv.participants.find(
                p => p.id !== igUserId && p.id !== pageId
              ) || conv.participants[0];
              // last_user_message_at: only set when the last message was from the customer
              const lastMsg = conv.last_message;
              const lastUserMessageAt = (
                lastMsg &&
                lastMsg.from?.id !== igUserId &&
                lastMsg.from?.id !== pageId
              ) ? lastMsg.created_time : null;

              return {
                instagram_thread_id: conv.id,
                customer_instagram_id: customerParticipant.id,
                customer_username: customerParticipant.username || null,
                // customer_name intentionally omitted — participants.name is Page-only, never returned for Instagram
                business_account_id: businessAccountId,
                within_window: isOpen,
                window_expires_at: windowExpiresAt,
                last_message_at: conv.last_message_at,
                last_user_message_at: lastUserMessageAt,
                message_count: conv.message_count || 0,
                conversation_status: 'active',
              };
            });
          if (convRecords.length > 0) {
            const { error: upsertErr } = await supabase
              .from('instagram_dm_conversations')
              .upsert(convRecords, { onConflict: 'instagram_thread_id', ignoreDuplicates: false });
            if (upsertErr) {
              await logWithDomain('messaging', {
                endpoint: '/conversations/upsert', method: 'SYSTEM', success: false,
                business_account_id: businessAccountId,
                error: upsertErr.message,
                details: { action: 'db_upsert_failed', table: 'instagram_dm_conversations', count_attempted: convRecords.length },
              });
              throw upsertErr;
            }
          }
        }
      } catch (wtErr) {
        console.warn('[messaging] Conversation write-through error:', wtErr.message);
        throw wtErr;
      }
    }

    const paging = convRes.data.paging || {};
    if (paging.next) {
      logWithDomain('messaging', {
        endpoint: '/conversations/paging', method: 'SYSTEM', success: true,
        business_account_id: businessAccountId,
        details: { action: 'paging_next_detected', items_this_page: conversations.length, next_cursor_present: true },
      }).catch(() => {});
    }

    // Return Graph API native shape — what the Python agent needs.
    // Frontend reads its own shaped view from DB via GET /dm-conversations (frontend/inbox.js).
    return {
      success: true,
      conversations,
      count: conversations.length,
      paging,
      _usagePct: parseUsageHeader(convRes.headers?.['x-business-use-case-usage']),
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;
    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);

    await logWithDomain('messaging', {
      endpoint: '/conversations',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency,
      status_code: error.response?.status || null,
      details: { action: 'proxy_failure', error_category, retryable, retry_after_seconds: retry_after_seconds || null, latency_ms: latency },
    });

    return {
      success: false, conversations: [], count: 0, paging: {}, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

// ============================================
// CONVERSATION MESSAGES — THIN FETCH
// ============================================

/**
 * Fetches messages for a single DM conversation from the Instagram Graph API.
 * NO DB write. Returns raw messages plus igUserId/pageId needed by storeMessageBatches.
 *
 * @param {string} businessAccountId - UUID
 * @param {string} conversationId - Instagram thread ID
 * @param {number} [limit=20] - Max messages (capped at 100)
 * @returns {Promise<{success: boolean, rawMessages: Array, igUserId: string, pageId: string|null, count: number, paging: Object, error?: string}>}
 */
async function fetchMessages(businessAccountId, conversationId, limit = 20, credentials = null) {
  const startTime = Date.now();
  const fetchLimit = Math.min(parseInt(limit) || 20, 100);

  try {
    const { igUserId, pageToken, userId, pageId } = credentials || await resolveAccountCredentials(businessAccountId);

    const msgRes = await axios.get(`${GRAPH_API_BASE}/${conversationId}/messages`, {
      params: {
        fields: 'id,message,from{id,username},to{id,username},created_time,' +
                'attachments{id,image_data{url,preview_url,render_as_sticker,animated_gif_url},file_url,name},' +
                'story,shares,is_unsupported',
        limit: fetchLimit,
        access_token: pageToken
      },
      timeout: 10000
    });

    const latency = Date.now() - startTime;

    await logWithDomain('messaging', {
      endpoint: '/conversation-messages',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: userId,
      success: true,
      latency
    });

    const rawMessages = msgRes.data.data || [];

    return {
      success: true,
      rawMessages,
      igUserId,
      pageId,
      count: rawMessages.length,
      paging: msgRes.data.paging || {},
      _usagePct: parseUsageHeader(msgRes.headers?.['x-business-use-case-usage']),
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;
    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);

    await logWithDomain('messaging', {
      endpoint: '/conversation-messages',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency,
      status_code: error.response?.status || null,
      details: { action: 'proxy_failure', error_category, retryable, retry_after_seconds: retry_after_seconds || null, latency_ms: latency },
    });

    return {
      success: false, rawMessages: [], igUserId: null, pageId: null,
      count: 0, paging: {}, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

// ============================================
// CONVERSATION MESSAGES — SHIM (route backward-compat)
// ============================================

/**
 * Fetches and persists messages for a single DM conversation.
 * Shim wrapping fetchMessages + storeMessageBatches + DB query-back.
 * Routes call this unchanged; domain loops call fetchMessages directly for batch parallelism.
 *
 * @param {string} businessAccountId
 * @param {string} conversationId - Instagram thread ID
 * @param {number} [limit=20]
 * @returns {Promise<{success: boolean, messages: Array, count: number, paging: Object, error?: string}>}
 */
async function fetchAndStoreMessages(businessAccountId, conversationId, limit = 20) {
  const result = await fetchMessages(businessAccountId, conversationId, limit);

  if (result.success && result.rawMessages.length > 0) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await storeMessageBatches(
        businessAccountId,
        [{ conversationId, rawMessages: result.rawMessages }],
        result.igUserId,
        result.pageId
      );

      // Route-level query-back — returns DB-shaped rows for frontend (correct shape + status fields)
      const { data: conv } = await supabase
        .from('instagram_dm_conversations')
        .select('id')
        .eq('instagram_thread_id', conversationId)
        .maybeSingle();

      if (conv?.id) {
        const fetchLimit = Math.min(parseInt(limit) || 20, 100);
        const { data: rows } = await supabase
          .from('instagram_dm_messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('sent_at', { ascending: true })
          .limit(fetchLimit);
        if (rows) {
          return { ...result, messages: rows, count: rows.length };
        }
      }
    }
  }

  // Fallback: return raw messages shaped via transformMessage (no DB query-back)
  const fallbackMessages = result.rawMessages
    .filter(m => m.id)
    .map(m => transformMessage(m, null, businessAccountId, result.igUserId, result.pageId, null));
  return { ...result, messages: fallbackMessages, count: fallbackMessages.length };
}

module.exports = {
  fetchComments,
  fetchMessages,
  fetchAndStoreComments,
  fetchAndStoreConversations,
  fetchAndStoreMessages,
};
