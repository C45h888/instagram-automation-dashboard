// backend.api/routes/agents/oversight.js
// Oversight Agent SSE endpoint: /oversight/chat
//
// Transparent proxy for the Python/LangChain Oversight Brain.
// Streams agent responses to the frontend via Server-Sent Events.
//
// Full path: POST /api/instagram/oversight/chat
// Body: { question: string, business_account_id: string, stream?: boolean, chat_history?: array, ...extra }
// Query: ?stream=true (alternative to body.stream)
//
// No IG credentials needed — proxies to the agent, not the Graph API.

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { logApiRequest } = require('../../config/supabase');

// ============================================
// ENDPOINT 8: POST /oversight/chat
// ============================================

router.post('/oversight/chat', async (req, res) => {
  const startTime = Date.now();
  const { question, business_account_id, stream = false, ...rest } = req.body;
  const isStreaming = stream === true || req.query.stream === 'true';
  const userIdHeader = req.headers['x-user-id'] || 'dashboard-user';

  // --- Validation (all before any SSE headers are set) ---
  if (!process.env.AGENT_URL) {
    return res.status(500).json({ error: 'AGENT_URL not configured', code: 'CONFIG_ERROR' });
  }

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Missing required field: question', code: 'MISSING_QUESTION' });
  }

  if (question.length > 2000) {
    return res.status(400).json({ error: 'question exceeds 2000 characters', code: 'QUESTION_TOO_LONG' });
  }

  if (!business_account_id) {
    return res.status(400).json({ error: 'Missing required field: business_account_id', code: 'MISSING_BUSINESS_ACCOUNT_ID' });
  }

  const agentUrl = `${process.env.AGENT_URL}/oversight/chat${isStreaming ? '?stream=true' : ''}`;
  const agentPayload = { question: question.trim(), business_account_id, stream: isStreaming, ...rest };
  const agentHeaders = {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.AGENT_API_KEY,
    'X-User-ID': userIdHeader
  };

  // --- NON-STREAMING: standard JSON proxy ---
  if (!isStreaming) {
    try {
      const agentRes = await axios.post(agentUrl, agentPayload, {
        headers: agentHeaders,
        timeout: 60000
      });

      const latency = Date.now() - startTime;

      await logApiRequest({
        endpoint: '/oversight/chat',
        method: 'POST',
        business_account_id,
        user_id: userIdHeader,
        success: true,
        latency
      });

      return res.json(agentRes.data);
    } catch (err) {
      const latency = Date.now() - startTime;
      const errorMsg = err.response?.data?.error || err.message;

      await logApiRequest({
        endpoint: '/oversight/chat',
        method: 'POST',
        business_account_id,
        success: false,
        error: errorMsg,
        latency
      });

      console.error('[Oversight] Non-streaming error:', errorMsg);
      return res.status(err.response?.status || 500).json({ error: errorMsg });
    }
  }

  // === STREAMING SSE PATH ===

  // Cleanup state (prevents double-cleanup when both req.close and stream.end fire)
  let cleanedUp = false;
  let agentStream = null;
  let pingInterval = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
    if (agentStream) { try { agentStream.destroy(); } catch (_) {} agentStream = null; }
  };

  // SSE headers — must override security middleware's Cache-Control: no-store
  // SSE requires no-cache so proxies (Nginx/Cloudflare) don't buffer the stream
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Flush headers immediately to establish the SSE connection
  res.flushHeaders();

  // Keep-alive ping every 15s (SSE comment lines are ignored by EventSource)
  pingInterval = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 15000);

  // Client disconnect handler
  req.on('close', () => cleanup('client disconnected'));

  try {
    const agentRes = await axios.post(agentUrl, agentPayload, {
      headers: { ...agentHeaders, Accept: 'text/event-stream' },
      responseType: 'stream',
      timeout: 0   // no timeout on long-running streams
    });

    agentStream = agentRes.data;

    // Pipe agent SSE chunks to client verbatim
    agentStream.on('data', (chunk) => {
      if (!res.writableEnded) res.write(chunk);
    });

    agentStream.on('end', async () => {
      if (!res.writableEnded) res.end();

      const latency = Date.now() - startTime;
      await logApiRequest({
        endpoint: '/oversight/chat',
        method: 'POST',
        business_account_id,
        user_id: userIdHeader,
        success: true,
        latency,
        details: { stream: true }
      });

      cleanup('stream ended');
    });

    agentStream.on('error', async (streamErr) => {
      console.error('[Oversight SSE] Agent stream error:', streamErr.message);

      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: streamErr.message })}\n\n`);
        res.end();
      }

      const latency = Date.now() - startTime;
      await logApiRequest({
        endpoint: '/oversight/chat',
        method: 'POST',
        business_account_id,
        success: false,
        error: streamErr.message,
        latency,
        details: { stream: true }
      });

      cleanup('stream error');
    });

  } catch (err) {
    // Agent connection failure — headers already flushed, use SSE error event
    const latency = Date.now() - startTime;
    const errorMsg = err.response?.data?.error || err.message;

    console.error('[Oversight SSE] Connection to agent failed:', errorMsg);

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: errorMsg })}\n\n`);
      res.end();
    }

    await logApiRequest({
      endpoint: '/oversight/chat',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMsg,
      latency,
      details: { stream: true }
    });

    cleanup('agent connection failed');
  }
});

module.exports = router;
