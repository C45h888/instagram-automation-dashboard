// backend.api/routes/agents/engagement.js
// Engagement Monitor endpoints: /post-comments, /conversations, /conversation-messages,
//                               /reply-comment, /reply-dm

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getSupabaseAdmin, logApiRequest, logAudit } = require('../../config/supabase');
const {
  resolveAccountCredentials,
  ensureMediaRecord,
  GRAPH_API_BASE,
} = require('../../helpers/agent-helpers');

// ============================================
// ENDPOINT 6: POST /reply-comment (Engagement Monitor)
// ============================================

/**
 * Replies to an Instagram comment.
 * Used by: Engagement monitor (scheduler/engagement_monitor.py via automation_tools.py)
 */
router.post('/reply-comment', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, comment_id, reply_text, post_id } = req.body;

  try {
    if (!business_account_id || !comment_id || !reply_text) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, comment_id, reply_text'
      });
    }

    if (!/^\d+$/.test(String(comment_id))) {
      return res.status(400).json({ error: 'Invalid comment_id format' });
    }

    if (reply_text.length > 2200) {
      return res.status(400).json({ error: 'reply_text exceeds 2200 character limit' });
    }

    const { pageToken, userId } = await resolveAccountCredentials(business_account_id);

    const replyRes = await axios.post(`${GRAPH_API_BASE}/${comment_id}/replies`, null, {
      params: {
        message: reply_text.trim(),
        access_token: pageToken
      },
      timeout: 10000
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/reply-comment',
      method: 'POST',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    await logAudit({
      event_type: 'comment_reply_sent',
      action: 'reply',
      resource_type: 'instagram_comment',
      resource_id: replyRes.data.id,
      details: { comment_id, post_id, reply_text },
      success: true
    });

    res.json({ success: true, id: replyRes.data.id });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/reply-comment',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Comment reply failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 7: POST /reply-dm (Engagement Monitor)
// ============================================

/**
 * Sends a reply into an existing DM conversation.
 * Used by: Engagement monitor (scheduler/engagement_monitor.py via automation_tools.py)
 */
router.post('/reply-dm', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, conversation_id, recipient_id, message_text } = req.body;

  try {
    if (!business_account_id || !conversation_id || !message_text) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, conversation_id, message_text'
      });
    }

    if (!/^[\w-]+$/.test(String(conversation_id))) {
      return res.status(400).json({ error: 'Invalid conversation_id format' });
    }

    if (message_text.length > 1000) {
      return res.status(400).json({ error: 'message_text exceeds 1000 character limit' });
    }

    const { pageToken, userId } = await resolveAccountCredentials(business_account_id);

    const dmRes = await axios.post(`${GRAPH_API_BASE}/${conversation_id}/messages`, null, {
      params: {
        message: message_text.trim(),
        access_token: pageToken
      },
      timeout: 10000
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/reply-dm',
      method: 'POST',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    await logAudit({
      event_type: 'dm_reply_sent',
      action: 'reply',
      resource_type: 'instagram_dm',
      resource_id: dmRes.data.id,
      details: { conversation_id, recipient_id },
      success: true
    });

    // Supabase write-through: log outgoing DM reply for conversation history
    try {
      const supabase = getSupabaseAdmin();
      if (supabase && dmRes.data.id) {
        const { error: msgErr } = await supabase
          .from('instagram_dm_messages')
          .upsert({
            message_id: dmRes.data.id,
            message_text: message_text.trim(),
            conversation_id,
            business_account_id,
            is_from_business: true,
            recipient_instagram_id: recipient_id || null,
            sent_at: new Date().toISOString(),
            send_status: 'sent',
          }, { onConflict: 'message_id', ignoreDuplicates: false });
        if (msgErr) console.warn('⚠️ DM reply write-through failed:', msgErr.message);
      }
    } catch (wtErr) {
      console.warn('⚠️ DM reply write-through error:', wtErr.message);
    }

    res.json({ success: true, id: dmRes.data.id });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/reply-dm',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ DM reply failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 9: GET /post-comments (Engagement Monitor)
// ============================================

/**
 * Fetches live comments for a specific Instagram media post.
 * Used by: Engagement monitor to read fresh comments before deciding to reply.
 */
router.get('/post-comments', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, media_id, limit } = req.query;

  try {
    if (!business_account_id || !media_id) {
      return res.status(400).json({
        error: 'Missing required query params: business_account_id, media_id'
      });
    }

    if (!/^\d+$/.test(String(media_id))) {
      return res.status(400).json({ error: 'Invalid media_id format' });
    }

    const fetchLimit = Math.min(parseInt(limit) || 50, 100);

    const { pageToken, userId } = await resolveAccountCredentials(business_account_id);

    const commentsRes = await axios.get(`${GRAPH_API_BASE}/${media_id}/comments`, {
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
      business_account_id,
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
          const mediaUUID = await ensureMediaRecord(supabase, media_id, business_account_id);
          if (mediaUUID) {
            const commentRecords = comments
              .filter(c => c.id)
              .map(c => ({
                instagram_comment_id: c.id,
                text: c.text || '',
                author_username: c.username || '',
                author_instagram_id: null,
                media_id: mediaUUID,
                business_account_id,
                created_at: c.timestamp,
                like_count: c.like_count || 0,
                processed_by_automation: false,
              }));
            const { error: upsertErr } = await supabase
              .from('instagram_comments')
              .upsert(commentRecords, { onConflict: 'instagram_comment_id', ignoreDuplicates: false });
            if (upsertErr) console.warn('⚠️ Comment write-through failed:', upsertErr.message);
          }
        }
      } catch (wtErr) {
        console.warn('⚠️ Comment write-through error:', wtErr.message);
      }
    }

    res.json({
      success: true,
      data: comments,
      paging: commentsRes.data.paging || {},
      meta: { count: comments.length }
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/post-comments',
      method: 'GET',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Post comments fetch failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 10: GET /conversations (Engagement Monitor)
// ============================================

/**
 * Lists active DM conversations with 24-hour messaging window status.
 * Used by: Engagement monitor to find conversations eligible for replies.
 */
router.get('/conversations', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, limit } = req.query;

  try {
    if (!business_account_id) {
      return res.status(400).json({
        error: 'Missing required query param: business_account_id'
      });
    }

    const fetchLimit = Math.min(parseInt(limit) || 20, 50);

    const { igUserId, pageToken, userId } = await resolveAccountCredentials(business_account_id);

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
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

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
              const hoursRemaining = mw.hours_remaining;
              const windowExpiresAt = isOpen && hoursRemaining != null
                ? new Date(Date.now() + hoursRemaining * 3600000).toISOString()
                : null;
              return {
                customer_instagram_id: conv.participants[0].id,
                business_account_id,
                conversation_id: conv.id,
                within_window: isOpen,
                window_expires_at: windowExpiresAt,
                last_message_at: conv.last_message_at,
                message_count: conv.message_count || 0,
                conversation_status: 'open',
              };
            });
          if (convRecords.length > 0) {
            const { error: upsertErr } = await supabase
              .from('instagram_dm_conversations')
              .upsert(convRecords, { onConflict: 'customer_instagram_id,business_account_id', ignoreDuplicates: false });
            if (upsertErr) console.warn('⚠️ Conversation write-through failed:', upsertErr.message);
          }
        }
      } catch (wtErr) {
        console.warn('⚠️ Conversation write-through error:', wtErr.message);
      }
    }

    res.json({
      success: true,
      data: conversations,
      paging: convRes.data.paging || {},
      meta: { count: conversations.length }
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/conversations',
      method: 'GET',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Conversations fetch failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 11: GET /conversation-messages (Engagement Monitor)
// ============================================

/**
 * Fetches messages for a specific DM conversation.
 * Used by: Engagement monitor to read thread history before crafting a reply.
 */
router.get('/conversation-messages', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, conversation_id, limit } = req.query;

  try {
    if (!business_account_id || !conversation_id) {
      return res.status(400).json({
        error: 'Missing required query params: business_account_id, conversation_id'
      });
    }

    if (!/^[\w-]+$/.test(String(conversation_id))) {
      return res.status(400).json({ error: 'Invalid conversation_id format' });
    }

    const fetchLimit = Math.min(parseInt(limit) || 20, 100);

    const { igUserId, pageToken, userId } = await resolveAccountCredentials(business_account_id);

    const msgRes = await axios.get(`${GRAPH_API_BASE}/${conversation_id}/messages`, {
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
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    const messages = msgRes.data.data || [];

    // Supabase write-through: upsert messages with is_from_business flag
    if (messages.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const msgRecords = messages
            .filter(m => m.id)
            .map(m => ({
              message_id: m.id,
              message_text: m.message || '',
              conversation_id,
              business_account_id,
              is_from_business: m.from?.id === igUserId,
              sent_at: m.created_time,
              send_status: 'received',
            }));
          const { error: upsertErr } = await supabase
            .from('instagram_dm_messages')
            .upsert(msgRecords, { onConflict: 'message_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('⚠️ Message write-through failed:', upsertErr.message);
        }
      } catch (wtErr) {
        console.warn('⚠️ Message write-through error:', wtErr.message);
      }
    }

    res.json({
      success: true,
      data: messages,
      paging: msgRes.data.paging || {},
      meta: { count: messages.length }
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/conversation-messages',
      method: 'GET',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Conversation messages fetch failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT: POST /send-dm (UGC Permission DM)
// ============================================

/**
 * Sends a new DM to a user (initiates conversation, not a reply).
 * Used by: UGC pipeline (ugc_tools.send_permission_dm) to request creator repost permission.
 *
 * Agent payload: { business_account_id, recipient_id, recipient_username, message_text }
 *   recipient_id      — numeric IGSID of the creator to message
 *   recipient_username — for audit context only, not sent to Graph API
 */
router.post('/send-dm', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, recipient_id, recipient_username, message_text } = req.body;

  try {
    if (!business_account_id || !recipient_id || !message_text) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, recipient_id, message_text'
      });
    }

    if (!/^\d+$/.test(String(recipient_id))) {
      return res.status(400).json({ error: 'Invalid recipient_id: must be a numeric IGSID' });
    }

    if (message_text.length > 1000) {
      return res.status(400).json({ error: 'message_text exceeds 1000 character limit' });
    }

    const { igUserId, pageToken, userId } = await resolveAccountCredentials(business_account_id);

    const dmRes = await axios.post(`${GRAPH_API_BASE}/${igUserId}/messages`, {
      recipient: { id: String(recipient_id) },
      message: { text: message_text.trim() }
    }, {
      params: { access_token: pageToken },
      timeout: 10000
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/send-dm',
      method: 'POST',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    await logAudit({
      event_type: 'dm_sent',
      action: 'send',
      resource_type: 'instagram_dm',
      resource_id: dmRes.data.message_id || dmRes.data.id,
      details: { recipient_id, recipient_username },
      success: true
    });

    // Supabase write-through: log outgoing DM (no conversation_id yet for new threads)
    try {
      const supabase = getSupabaseAdmin();
      if (supabase && (dmRes.data.message_id || dmRes.data.id)) {
        const { error: msgErr } = await supabase
          .from('instagram_dm_messages')
          .upsert({
            message_id: dmRes.data.message_id || dmRes.data.id,
            message_text: message_text.trim(),
            conversation_id: null,
            business_account_id,
            is_from_business: true,
            recipient_instagram_id: String(recipient_id),
            sent_at: new Date().toISOString(),
            send_status: 'sent',
          }, { onConflict: 'message_id', ignoreDuplicates: false });
        if (msgErr) console.warn('⚠️ Send-DM write-through failed:', msgErr.message);
      }
    } catch (wtErr) {
      console.warn('⚠️ Send-DM write-through error:', wtErr.message);
    }

    res.json({ success: true, message_id: dmRes.data.message_id || dmRes.data.id });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/send-dm',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Send DM failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

module.exports = router;
