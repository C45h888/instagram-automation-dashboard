// backend.api/routes/agents/queue.js
// Admin endpoints for post_queue monitoring and manual operations.
// Routes: GET /post-queue/status, GET /post-queue/dlq, POST /post-queue/retry

const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../../config/supabase');

// ============================================
// GET /post-queue/status
// ============================================

/**
 * Returns a summary of post_queue rows grouped by status × action_type.
 * Intended for monitoring dashboards and health checks.
 * Mirrors the visibility pattern in proactive-sync.js monitoring.
 */
router.get('/post-queue/status', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const { data, error } = await supabase
      .from('post_queue')
      .select('status, action_type');

    if (error) throw error;

    // Aggregate counts in JS to avoid Supabase RPC dependency
    const summary = {};
    for (const row of (data || [])) {
      const key = `${row.action_type}::${row.status}`;
      summary[key] = (summary[key] || 0) + 1;
    }

    res.json({
      success: true,
      summary,
      total: data?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ /post-queue/status failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET /post-queue/dlq
// ============================================

/**
 * Returns all rows in 'dlq' status for admin inspection.
 * Provides full action context (payload, error, retry_count) for manual triage.
 * Optional ?limit param (max 200, default 50).
 */
router.get('/post-queue/dlq', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  try {
    const { data, error } = await supabase
      .from('post_queue')
      .select('id, business_account_id, action_type, payload, retry_count, error, error_category, created_at, updated_at')
      .eq('status', 'dlq')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({
      success: true,
      dlq: data || [],
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ /post-queue/dlq failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /post-queue/retry
// ============================================

/**
 * Resets a single dlq or failed row back to 'pending' for immediate cron pickup.
 * Clears next_retry_at and error so the row is eligible on the next tick.
 * Body: { queue_id: "<uuid>" }
 */
router.post('/post-queue/retry', async (req, res) => {
  const { queue_id } = req.body;

  if (!queue_id) {
    return res.status(400).json({ error: 'Missing required field: queue_id' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const { data, error } = await supabase
      .from('post_queue')
      .update({ status: 'pending', next_retry_at: null, error: null })
      .in('status', ['dlq', 'failed'])
      .eq('id', queue_id)
      .select('id, action_type, retry_count')
      .single();

    if (error || !data) {
      return res.status(404).json({
        error: 'Queue row not found or not in a retryable state (must be dlq or failed)'
      });
    }

    res.json({
      success: true,
      queue_id: data.id,
      action_type: data.action_type,
      previous_retry_count: data.retry_count,
      message: 'Row reset to pending — will be picked up on next cron tick'
    });

  } catch (err) {
    console.error('❌ /post-queue/retry failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
