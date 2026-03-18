// backend.api/helpers/data-fetchers/messaging-fetchers.js
// Domain: messaging — comments, DM conversations, DM messages.
// Fetches from Instagram Graph API and upserts to Supabase.
// No req/res dependencies — callable from routes and proactive-sync cron.
//
// All api_usage rows written with domain='messaging' for targeted debugging:
//   SELECT * FROM api_usage WHERE domain = 'messaging' AND success = false ORDER BY created_at DESC

const {
  axios,
  getSupabaseAdmin,
  resolveAccountCredentials,
  categorizeIgError,
  ensureMediaRecord,
  GRAPH_API_BASE,
  logWithDomain,
} = require('./base');

// ============================================
// COMMENTS
// ============================================

/**
 * Fetches comments for a media post and upserts to instagram_comments.
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

    await logWithDomain('messaging', {
      endpoint: '/post-comments',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: userId,
      success: true,
      latency
    });

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
                reply_count: c.replies_count || 0,
                // processed_by_automation omitted — DB DEFAULT false on insert, preserved on update
              }));
            const { error: upsertErr } = await supabase
              .from('instagram_comments')
              // ignoreDuplicates: true — never overwrite existing rows (preserves agent enrichment:
              // sentiment, category, processed_by_automation set by the automation pipeline)
              .upsert(commentRecords, { onConflict: 'instagram_comment_id', ignoreDuplicates: true });
            if (upsertErr) console.warn('[messaging] Comment upsert failed:', upsertErr.message);
          }
        }
      } catch (wtErr) {
        console.warn('[messaging] Comment write-through error:', wtErr.message);
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

    await logWithDomain('messaging', {
      endpoint: '/post-comments',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    });

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
        fields: 'id,participants{id,username},updated_time,message_count,messages{created_time,from{id}}',
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
            if (upsertErr) console.warn('[messaging] Conversation upsert failed:', upsertErr.message);
          }
        }
      } catch (wtErr) {
        console.warn('[messaging] Conversation write-through error:', wtErr.message);
      }
    }

    // Return Graph API native shape — what the Python agent needs.
    // Frontend reads its own shaped view from DB via GET /dm-conversations (frontend/inbox.js).
    return {
      success: true,
      conversations,
      count: conversations.length,
      paging: convRes.data.paging || {}
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logWithDomain('messaging', {
      endpoint: '/conversations',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    });

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
    const { igUserId, pageToken, userId, pageId } = await resolveAccountCredentials(businessAccountId);

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

    const messages = msgRes.data.data || [];
    let dbMessages = null;

    // Supabase write-through: upsert messages with is_from_business flag
    if (messages.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          // Resolve IG thread ID → Supabase UUID + customer_instagram_id for recipient fallback
          let conversationUUID = null;
          let customerIgId = null;
          const { data: conv } = await supabase
            .from('instagram_dm_conversations')
            .select('id, customer_instagram_id')
            .eq('instagram_thread_id', conversationId)
            .maybeSingle();
          conversationUUID = conv?.id || null;
          customerIgId = conv?.customer_instagram_id || null;

          // Maps any Meta message object → DB row shape.
          // Used for both upsert AND the no-UUID fallback — eliminates shape mismatch.
          const transformMessage = (m) => {
            // pageId: defensive fallback — Meta docs list IGSID for business as either igUserId or pageId
            const fromBusiness = m.from?.id === igUserId || (pageId && m.from?.id === pageId);

            // Graph API attachment sub-fields (NOT webhook payload.url format)
            const att = m.attachments?.data?.[0] || null;
            const imgData = att?.image_data || null;
            const isSticker = imgData?.render_as_sticker === true;

            // Media URL: priority order covers all attachment variants
            const mediaUrl = imgData?.url
              || imgData?.animated_gif_url       // animated GIF
              || att?.file_url                   // PDF / file
              || m.story?.link                   // story reply CDN URL (top-level field)
              || null;

            // message_type: mapped to DB CHECK constraint values.
            // DB allows: text, media, story_reply, story_mention, post_share,
            //            voice_note, reel_share, icebreaker
            //
            // Previous values 'sticker', 'attachment', 'share', 'unsupported' are NOT
            // in the DB enum — they caused silent CHECK constraint failures that killed
            // entire message batches (all messages in a conversation lost on one bad type).
            //
            // Meta docs confirm NO separate endpoints for non-text content — all message
            // types come through the same /{conversation-id}/messages endpoint.
            // Attachments[] type field is the discriminator, not a separate API call.
            let messageType = 'text';
            if (isSticker)                    messageType = 'media';      // sticker = image attachment
            else if (att)                     messageType = 'media';      // image, GIF, audio, video, file
            else if (m.story)                 messageType = 'story_reply';
            else if (m.shares?.data?.length)  messageType = 'post_share'; // was 'share' — DB enum is 'post_share'
            else if (m.is_unsupported)        messageType = 'text';       // unrenderable — null body, safe fallback

            // media_type: coarse MIME category for frontend rendering decisions
            const mediaType = imgData ? 'image' : att?.file_url ? 'file' : null;

            return {
              instagram_message_id: m.id,
              message_text: m.message || null,  // null not '' — empty string is semantically wrong
              message_type: messageType,
              media_url: mediaUrl,
              media_type: mediaType,
              conversation_id: conversationUUID,
              business_account_id: businessAccountId,
              is_from_business: fromBusiness,
              // Meta omits `to` when no data — derive from known IDs as fallback
              recipient_instagram_id: m.to?.data?.[0]?.id
                || (fromBusiness ? customerIgId : igUserId)
                || '',
              sender_username: m.from?.username || null,
              sent_at: m.created_time,
              send_status: fromBusiness ? 'sent' : 'delivered',
            };
          };

          if (!conversationUUID) {
            // Conversation not yet in DB (race condition or prior upsert failure).
            // Return correctly shaped data WITHOUT persisting — prevents permanent orphan rows
            // (ignoreDuplicates: true can never repair conversation_id: null rows).
            console.warn(`[messaging] ${conversationId} not in DB — returning without write`);
            dbMessages = messages.filter(m => m.id).map(transformMessage);
          } else {
            const msgRecords = messages.filter(m => m.id).map(transformMessage);

            const { error: upsertErr } = await supabase
              .from('instagram_dm_messages')
              // ignoreDuplicates: true — never overwrite existing status (preserves 'read' on re-fetch)
              .upsert(msgRecords, { onConflict: 'instagram_message_id', ignoreDuplicates: true });

            if (upsertErr) {
              console.warn('[messaging] Message upsert failed:', upsertErr.message);
            } else {
              // Orphan repair: messages stored with conversation_id: null by /send-dm or /reply-dm
              // before the conversation row existed. IS NULL guard prevents touching already-linked rows.
              const messageIds = msgRecords.map(r => r.instagram_message_id);
              await supabase
                .from('instagram_dm_messages')
                .update({ conversation_id: conversationUUID, business_account_id: businessAccountId })
                .in('instagram_message_id', messageIds)
                .is('conversation_id', null);

              // DB query-back — returns fully populated DB rows (correct shape for frontend)
              const { data: rows } = await supabase
                .from('instagram_dm_messages')
                .select('*')
                .eq('conversation_id', conversationUUID)
                .order('sent_at', { ascending: true })
                .limit(fetchLimit);
              if (rows) dbMessages = rows;
            }
          }
        }
      } catch (wtErr) {
        console.warn('[messaging] Message write-through error:', wtErr.message);
      }
    }

    return {
      success: true,
      messages: dbMessages || messages,
      count: (dbMessages || messages).length,
      paging: msgRes.data.paging || {}
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logWithDomain('messaging', {
      endpoint: '/conversation-messages',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    });

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, messages: [], count: 0, paging: {}, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

module.exports = {
  fetchAndStoreComments,
  fetchAndStoreConversations,
  fetchAndStoreMessages,
};
