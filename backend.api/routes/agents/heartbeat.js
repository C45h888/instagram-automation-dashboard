// backend.api/routes/agents/heartbeat.js
// Receives heartbeat pings from the Python agent. Upserts agent_heartbeats row.
// Route: POST /agent/heartbeat
// Auth: X-API-Key (inherited from agent-proxy.js via validateAgentApiKey)

const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../../config/supabase');

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

    res.json({ success: true, agent_id, received_at: new Date().toISOString() });
  } catch (err) {
    console.error('[Heartbeat] upsert failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
