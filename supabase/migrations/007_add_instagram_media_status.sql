-- Add status column to instagram_media table
-- This enables draft/scheduled/published workflow

ALTER TABLE instagram_media
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
CHECK (status IN ('draft', 'scheduled', 'published'));

-- Add index for filtering by status
CREATE INDEX IF NOT EXISTS idx_instagram_media_status ON instagram_media(status);

-- Add scheduled_for column for future scheduling
ALTER TABLE instagram_media
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE NULL;

-- Update existing records to 'published' status
UPDATE instagram_media SET status = 'published' WHERE published_at IS NOT NULL AND status IS NULL;

COMMENT ON COLUMN instagram_media.status IS 'Post status: draft (not published), scheduled (queued), published (live on Instagram)';
COMMENT ON COLUMN instagram_media.scheduled_for IS 'When to auto-publish (NULL if not scheduled)';
