-- =====================================================
-- Migration 008: UGC Repost Tracking Columns
-- =====================================================
-- Purpose: Add audit trail columns for tracking reposted UGC content
-- Critical for Meta App Review: Demonstrates human oversight and permission enforcement
-- Author: Phase 4.3 Implementation
-- Date: 2025-12-14

-- Add reposted_at timestamp column
-- Tracks when content was reposted to business account
ALTER TABLE ugc_content
ADD COLUMN IF NOT EXISTS reposted_at TIMESTAMP WITH TIME ZONE NULL;

-- Add reposted_media_id column
-- Stores Instagram media ID of the reposted content (for reference/audit)
ALTER TABLE ugc_content
ADD COLUMN IF NOT EXISTS reposted_media_id TEXT NULL;

-- Add index for audit queries (find all reposted content)
CREATE INDEX IF NOT EXISTS idx_ugc_content_reposted_at
ON ugc_content(reposted_at)
WHERE reposted_at IS NOT NULL;

-- Add index for looking up reposts by Instagram media ID
CREATE INDEX IF NOT EXISTS idx_ugc_content_reposted_media_id
ON ugc_content(reposted_media_id)
WHERE reposted_media_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN ugc_content.reposted_at IS
'Timestamp when this UGC content was reposted to the business Instagram account. NULL if not reposted.';

COMMENT ON COLUMN ugc_content.reposted_media_id IS
'Instagram media ID of the reposted content. Used for audit trail and reference. NULL if not reposted.';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify columns were added
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'ugc_content'
-- AND column_name IN ('reposted_at', 'reposted_media_id');

-- =====================================================
-- ROLLBACK (if needed)
-- =====================================================

-- To rollback this migration:
-- ALTER TABLE ugc_content DROP COLUMN IF EXISTS reposted_at;
-- ALTER TABLE ugc_content DROP COLUMN IF EXISTS reposted_media_id;
-- DROP INDEX IF EXISTS idx_ugc_content_reposted_at;
-- DROP INDEX IF EXISTS idx_ugc_content_reposted_media_id;
