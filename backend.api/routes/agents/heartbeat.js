// backend.api/routes/agents/heartbeat.js
// Receives heartbeat pings from the Python agent. Upserts agent_heartbeats row.
// Route: POST /agent/heartbeat
// Auth: X-API-Key (inherited from agent-proxy.js via validateAgentApiKey)

const express = require('express');
const router = express.Router();
const { getSupabaseAdmin, logAudit } = require('../../config/supabase');

// POST /agent/heartbeat
// Body: { agent_id: UUID, timestamp: ISO string }
router.post('/agent/heartbeat', async (req, res) => {
  const { agent_id, timestamp } = req.body;
  if (!agent_id) return res.status(400).json({ error: 'Missing agent_id' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const { error } = await supabase
      .from('agent_heartbeats')
      .upsert(
        { agent_id, last_beat_at: timestamp || new Date().toISOString(), status: 'alive' },
        { onConflict: 'agent_id' }
      );

    if (error) throw error;

    logAudit({
      event_type: 'agent_heartbeat_received',
      action: 'heartbeat',
      resource_type: 'agent',
      details: { agent_id, status: 'alive', last_beat_at: timestamp || new Date().toISOString() },
      success: true,
    }).catch(() => {});

    res.json({ success: true, agent_id, received_at: new Date().toISOString() });
  } catch (err) {
    console.error('[Heartbeat] upsert failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /sync/health
// Returns latest run_completed row per domain + unresolved alert count.
router.get('/sync/health', async (_req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

  const domains = ['engagement', 'ugc', 'media', 'insights', 'token_health', 'comments'];
  const results = {};

  for (const domain of domains) {
    const { data } = await supabase
      .from('sync_run_log')
      .select('status, completed_at, duration_ms, success_count, error_count, items_fetched, error_message')
      .eq('domain', domain)
      .eq('status', 'run_completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    results[domain] = data || { status: 'never_run' };
  }

  const { count: alertCount } = await supabase
    .from('system_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('resolved', false);

  res.json({ domains: results, unresolved_alerts: alertCount || 0 });
});

module.exports = router;
