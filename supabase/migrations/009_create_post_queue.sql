-- =====================================================
-- Migration 009: Post Queue (Outgoing IG Write Fallback)
-- =====================================================
-- Purpose: Durable intent log for outgoing Instagram API writes.
--          Enables retry of failed/rate-limited actions without data loss.
-- Endpoints covered: reply_comment, reply_dm, send_dm, publish_post, repost_ugc
-- Cron consumer: backend.api/services/post-fallback.js (*/5 * * * *)
-- Author: Phase 5 Implementation (Feb 2026)

BEGIN;

-- =====================================================
-- TABLE: post_queue
-- =====================================================

CREATE TABLE IF NOT EXISTS post_queue (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_account_id UUID NOT NULL REFERENCES instagram_business_accounts(id) ON DELETE CASCADE,
  action_type         TEXT NOT NULL CHECK (action_type IN (
                        'reply_comment',
                        'reply_dm',
                        'send_dm',
                        'publish_post',
                        'repost_ugc'
                      )),
  -- JSONB payload varies by action_type (see comment below)
  payload             JSONB NOT NULL,
  -- Deterministic SHA-256 of action seed (backend-generated, hex string)
  -- Prevents duplicate in-flight rows for the same logical action
  idempotency_key     TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dlq')),
  retry_count         INT NOT NULL DEFAULT 0,
  -- NULL means eligible immediately; set on failure to schedule next attempt
  next_retry_at       TIMESTAMPTZ,
  -- Last error message (populated on failure, cleared on manual retry reset)
  error               TEXT,
  -- Mirrors categorizeIgError() output: auth_failure|permanent|rate_limit|transient|unknown
  error_category      TEXT,
  -- Instagram Graph API ID returned on success (media_id, message_id, etc.)
  instagram_id        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PAYLOAD SHAPES (reference only — enforced by application)
-- =====================================================
-- reply_comment : { comment_id, reply_text, post_id? }
-- reply_dm      : { conversation_id, recipient_id?, message_text }
-- send_dm       : { recipient_id, recipient_username?, message_text }
-- publish_post  : { image_url, caption, media_type, scheduled_post_id?, creation_id? }
-- repost_ugc    : { permission_id, creation_id? }
--
-- creation_id is null on initial insert for 2-step endpoints;
-- populated atomically after Step 1 succeeds so cron retries skip to Step 2.

-- =====================================================
-- INDEXES
-- =====================================================

-- Primary cron scan: fetch retryable rows efficiently
CREATE INDEX IF NOT EXISTS idx_post_queue_scan
  ON post_queue (status, next_retry_at)
  WHERE status IN ('pending', 'failed');

-- Secondary: admin dashboard / per-account monitoring
CREATE INDEX IF NOT EXISTS idx_post_queue_account_status
  ON post_queue (business_account_id, status);

-- Idempotency: at most one active row per logical action
-- Rows in terminal states (sent/dlq) are excluded — allows legitimate re-queuing
-- after the previous action completed (e.g. agent retries a scheduled post)
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_queue_idempotency
  ON post_queue (idempotency_key)
  WHERE status NOT IN ('sent', 'dlq');

-- =====================================================
-- TRIGGER: auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_post_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_queue_updated_at ON post_queue;

CREATE TRIGGER post_queue_updated_at
  BEFORE UPDATE ON post_queue
  FOR EACH ROW EXECUTE FUNCTION update_post_queue_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
-- Backend uses SUPABASE_SERVICE_KEY (service_role), which bypasses RLS.
-- RLS enabled as a safety net — no anon or authenticated role access.

ALTER TABLE post_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_post_queue ON post_queue;

CREATE POLICY service_role_all_post_queue ON post_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE post_queue IS
'Durable intent log for outgoing Instagram Graph API write actions. '
'Each row represents one pending, in-flight, completed, or failed IG action. '
'Consumed by backend.api/services/post-fallback.js (cron: */5 * * * *).';

COMMENT ON COLUMN post_queue.idempotency_key IS
'SHA-256 hex of a deterministic seed string (e.g. "reply_comment:<comment_id>"). '
'Unique index (WHERE status NOT IN sent/dlq) prevents duplicate in-flight rows.';

COMMENT ON COLUMN post_queue.payload IS
'JSONB action parameters. Shape depends on action_type. '
'For 2-step actions (publish_post, repost_ugc), creation_id is written after Step 1 '
'succeeds so cron retries can skip directly to media_publish.';

COMMENT ON COLUMN post_queue.status IS
'pending: awaiting first attempt (or manual reset). '
'processing: picked up by cron, prevents concurrent pickup. '
'sent: IG API call succeeded, instagram_id populated. '
'failed: retryable error, next_retry_at set for backoff. '
'dlq: permanent failure or MAX_RETRIES exceeded, audit event logged.';

COMMENT ON COLUMN post_queue.error_category IS
'Mirrors categorizeIgError() output: '
'auth_failure (190/102/104) | permanent (400 non-rate-limit) | '
'rate_limit (4/17/32/613/429) | transient (5xx/timeout) | unknown.';

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run after applying migration to confirm structure:

-- SELECT table_name FROM information_schema.tables WHERE table_name = 'post_queue';

-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'post_queue'
-- ORDER BY ordinal_position;

-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'post_queue';

-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'post_queue'::regclass;

-- =====================================================
-- ROLLBACK (if needed)
-- =====================================================
-- DROP TRIGGER IF EXISTS post_queue_updated_at ON post_queue;
-- DROP FUNCTION IF EXISTS update_post_queue_updated_at();
-- DROP TABLE IF EXISTS post_queue;
