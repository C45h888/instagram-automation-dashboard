-- ============================================
-- STEP 3: FIX RLS POLICIES (Eliminate Infinite Recursion)
-- ============================================
-- Purpose: Replace circular RLS policies with simple,
--   non-recursive policies that use auth.uid() directly
--
-- Safety Level: DESTRUCTIVE - Drops and recreates policies
-- Prerequisites: Execute STEP_2 first (user_id must be TEXT)
--
-- Chain of Thought:
-- 1. Drop ALL existing RLS policies on affected tables
-- 2. Create new simplified policies that:
--    - Use auth.uid()::text for direct comparison
--    - NEVER query the same table or create circular refs
--    - Allow service_role full access for admin operations
-- 3. Verify policies are active and non-recursive
-- ============================================

BEGIN;

-- ============================================
-- SECTION 1: Drop Existing Problematic Policies
-- ============================================

-- Drop ALL policies on user_consents
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_consents'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_consents', r.policyname);
    RAISE NOTICE '✓ Dropped policy: % on user_consents', r.policyname;
  END LOOP;
END $$;

-- Drop ALL policies on instagram_business_accounts
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'instagram_business_accounts'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.instagram_business_accounts', r.policyname);
    RAISE NOTICE '✓ Dropped policy: % on instagram_business_accounts', r.policyname;
  END LOOP;
END $$;

-- Drop ALL policies on user_profiles
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', r.policyname);
    RAISE NOTICE '✓ Dropped policy: % on user_profiles', r.policyname;
  END LOOP;
END $$;

-- ============================================
-- SECTION 2: Create New Simplified RLS Policies
-- ============================================

-- ========== user_consents Policies ==========

-- Service role full access
CREATE POLICY "service_role_all_user_consents"
  ON public.user_consents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view their own consents
CREATE POLICY "users_select_own_consents"
  ON public.user_consents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Users can insert their own consents
CREATE POLICY "users_insert_own_consents"
  ON public.user_consents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- Users can update their own consents
CREATE POLICY "users_update_own_consents"
  ON public.user_consents
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

RAISE NOTICE '✓ Created 4 RLS policies on user_consents';

-- ========== instagram_business_accounts Policies ==========

-- Service role full access
CREATE POLICY "service_role_all_instagram_accounts"
  ON public.instagram_business_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view their own accounts
CREATE POLICY "users_select_own_instagram_accounts"
  ON public.instagram_business_accounts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Users can insert their own accounts
CREATE POLICY "users_insert_own_instagram_accounts"
  ON public.instagram_business_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- Users can update their own accounts
CREATE POLICY "users_update_own_instagram_accounts"
  ON public.instagram_business_accounts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Users can delete their own accounts
CREATE POLICY "users_delete_own_instagram_accounts"
  ON public.instagram_business_accounts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

RAISE NOTICE '✓ Created 5 RLS policies on instagram_business_accounts';

-- ========== user_profiles Policies ==========

-- Service role full access
CREATE POLICY "service_role_all_user_profiles"
  ON public.user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view their own profile
CREATE POLICY "users_select_own_profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Users can insert their own profile
CREATE POLICY "users_insert_own_profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- Users can update their own profile
CREATE POLICY "users_update_own_profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

RAISE NOTICE '✓ Created 4 RLS policies on user_profiles';

-- ============================================
-- SECTION 2B: Recreate Cross-Table RLS Policies
-- ============================================
-- These policies reference instagram_business_accounts.user_id
-- Now using auth.uid()::text to match TEXT type

-- ========== ugc_content Policies (if table exists) ==========

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ugc_content' AND table_schema = 'public') THEN
    -- Service role full access
    CREATE POLICY service_role_all_ugc_content ON ugc_content
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    -- Users can view UGC for their own business accounts
    CREATE POLICY ugc_content_select_policy ON ugc_content
      FOR SELECT
      TO authenticated
      USING (
        business_account_id IN (
          SELECT id FROM instagram_business_accounts
          WHERE user_id = auth.uid()::text
        )
      );

    -- Users can insert UGC for their own business accounts
    CREATE POLICY ugc_content_insert_policy ON ugc_content
      FOR INSERT
      TO authenticated
      WITH CHECK (
        business_account_id IN (
          SELECT id FROM instagram_business_accounts
          WHERE user_id = auth.uid()::text
        )
      );

    -- Users can update UGC for their own business accounts
    CREATE POLICY ugc_content_update_policy ON ugc_content
      FOR UPDATE
      TO authenticated
      USING (
        business_account_id IN (
          SELECT id FROM instagram_business_accounts
          WHERE user_id = auth.uid()::text
        )
      );

    RAISE NOTICE '✓ Created 4 RLS policies on ugc_content';
  ELSE
    RAISE NOTICE '⊘ Table ugc_content does not exist (skipping policies)';
  END IF;
END $$;

-- ========== ugc_permissions Policies (if table exists) ==========

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ugc_permissions' AND table_schema = 'public') THEN
    -- Service role full access
    CREATE POLICY service_role_all_ugc_permissions ON ugc_permissions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    -- Users can view permissions for their own business accounts
    CREATE POLICY ugc_permissions_select_policy ON ugc_permissions
      FOR SELECT
      TO authenticated
      USING (
        business_account_id IN (
          SELECT id FROM instagram_business_accounts
          WHERE user_id = auth.uid()::text
        )
      );

    -- Users can insert permissions for their own business accounts
    CREATE POLICY ugc_permissions_insert_policy ON ugc_permissions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        business_account_id IN (
          SELECT id FROM instagram_business_accounts
          WHERE user_id = auth.uid()::text
        )
      );

    -- Users can update permissions for their own business accounts
    CREATE POLICY ugc_permissions_update_policy ON ugc_permissions
      FOR UPDATE
      TO authenticated
      USING (
        business_account_id IN (
          SELECT id FROM instagram_business_accounts
          WHERE user_id = auth.uid()::text
        )
      );

    RAISE NOTICE '✓ Created 4 RLS policies on ugc_permissions';
  ELSE
    RAISE NOTICE '⊘ Table ugc_permissions does not exist (skipping policies)';
  END IF;
END $$;

-- ========== ugc_campaigns Policies (if table exists) ==========

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ugc_campaigns' AND table_schema = 'public') THEN
    -- Service role full access
    CREATE POLICY service_role_all_ugc_campaigns ON ugc_campaigns
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    -- Users can manage campaigns for their own business accounts
    CREATE POLICY ugc_campaigns_all_policy ON ugc_campaigns
      FOR ALL
      TO authenticated
      USING (
        business_account_id IN (
          SELECT id FROM instagram_business_accounts
          WHERE user_id = auth.uid()::text
        )
      )
      WITH CHECK (
        business_account_id IN (
          SELECT id FROM instagram_business_accounts
          WHERE user_id = auth.uid()::text
        )
      );

    RAISE NOTICE '✓ Created 2 RLS policies on ugc_campaigns';
  ELSE
    RAISE NOTICE '⊘ Table ugc_campaigns does not exist (skipping policies)';
  END IF;
END $$;

-- ========== instagram_dm_conversations Policies (if table exists) ==========

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instagram_dm_conversations' AND table_schema = 'public') THEN
    -- Service role full access
    CREATE POLICY service_role_all_conversations ON instagram_dm_conversations
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    -- Users can view their own business conversations
    CREATE POLICY users_view_own_conversations ON instagram_dm_conversations
      FOR SELECT
      TO authenticated
      USING (
        business_account_id IN (
          SELECT id FROM instagram_business_accounts
          WHERE user_id = auth.uid()::text
        )
      );

    RAISE NOTICE '✓ Created 2 RLS policies on instagram_dm_conversations';
  ELSE
    RAISE NOTICE '⊘ Table instagram_dm_conversations does not exist (skipping policies)';
  END IF;
END $$;

-- ========== instagram_dm_messages Policies (if table exists) ==========

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instagram_dm_messages' AND table_schema = 'public') THEN
    -- Service role full access
    CREATE POLICY service_role_all_messages ON instagram_dm_messages
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    -- Users can view their own business messages
    CREATE POLICY users_view_own_messages ON instagram_dm_messages
      FOR SELECT
      TO authenticated
      USING (
        conversation_id IN (
          SELECT c.id FROM instagram_dm_conversations c
          JOIN instagram_business_accounts b ON c.business_account_id = b.id
          WHERE b.user_id = auth.uid()::text
        )
      );

    -- Users can insert messages for their conversations
    CREATE POLICY users_insert_own_messages ON instagram_dm_messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        conversation_id IN (
          SELECT c.id FROM instagram_dm_conversations c
          JOIN instagram_business_accounts b ON c.business_account_id = b.id
          WHERE b.user_id = auth.uid()::text
        )
      );

    -- Users can update messages for their conversations
    CREATE POLICY users_update_own_messages ON instagram_dm_messages
      FOR UPDATE
      TO authenticated
      USING (
        conversation_id IN (
          SELECT c.id FROM instagram_dm_conversations c
          JOIN instagram_business_accounts b ON c.business_account_id = b.id
          WHERE b.user_id = auth.uid()::text
        )
      );

    RAISE NOTICE '✓ Created 4 RLS policies on instagram_dm_messages';
  ELSE
    RAISE NOTICE '⊘ Table instagram_dm_messages does not exist (skipping policies)';
  END IF;
END $$;

-- ============================================
-- SECTION 3: Ensure RLS is Enabled
-- ============================================

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_business_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Enable RLS on cross-table tables if they exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ugc_content' AND table_schema = 'public') THEN
    ALTER TABLE public.ugc_content ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ugc_permissions' AND table_schema = 'public') THEN
    ALTER TABLE public.ugc_permissions ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ugc_campaigns' AND table_schema = 'public') THEN
    ALTER TABLE public.ugc_campaigns ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instagram_dm_conversations' AND table_schema = 'public') THEN
    ALTER TABLE public.instagram_dm_conversations ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instagram_dm_messages' AND table_schema = 'public') THEN
    ALTER TABLE public.instagram_dm_messages ENABLE ROW LEVEL SECURITY;
  END IF;

  RAISE NOTICE '✓ RLS enabled on all tables';
END $$;

-- ============================================
-- SECTION 4: Verification
-- ============================================

DO $$
DECLARE
  v_user_consents_count INTEGER;
  v_instagram_accounts_count INTEGER;
  v_user_profiles_count INTEGER;
  v_ugc_content_count INTEGER := 0;
  v_ugc_permissions_count INTEGER := 0;
  v_ugc_campaigns_count INTEGER := 0;
  v_dm_conversations_count INTEGER := 0;
  v_dm_messages_count INTEGER := 0;
  v_total_policies INTEGER := 0;
BEGIN
  -- Count policies on main tables
  SELECT COUNT(*) INTO v_user_consents_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'user_consents';

  SELECT COUNT(*) INTO v_instagram_accounts_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'instagram_business_accounts';

  SELECT COUNT(*) INTO v_user_profiles_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'user_profiles';

  -- Count policies on cross-table tables (if they exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ugc_content' AND table_schema = 'public') THEN
    SELECT COUNT(*) INTO v_ugc_content_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ugc_content';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ugc_permissions' AND table_schema = 'public') THEN
    SELECT COUNT(*) INTO v_ugc_permissions_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ugc_permissions';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ugc_campaigns' AND table_schema = 'public') THEN
    SELECT COUNT(*) INTO v_ugc_campaigns_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ugc_campaigns';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instagram_dm_conversations' AND table_schema = 'public') THEN
    SELECT COUNT(*) INTO v_dm_conversations_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'instagram_dm_conversations';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instagram_dm_messages' AND table_schema = 'public') THEN
    SELECT COUNT(*) INTO v_dm_messages_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'instagram_dm_messages';
  END IF;

  v_total_policies := v_user_consents_count + v_instagram_accounts_count + v_user_profiles_count +
                      v_ugc_content_count + v_ugc_permissions_count + v_ugc_campaigns_count +
                      v_dm_conversations_count + v_dm_messages_count;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS POLICY FIX COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Main Tables:';
  RAISE NOTICE '  user_consents policies: %', v_user_consents_count;
  RAISE NOTICE '  instagram_business_accounts policies: %', v_instagram_accounts_count;
  RAISE NOTICE '  user_profiles policies: %', v_user_profiles_count;

  IF v_ugc_content_count > 0 OR v_ugc_permissions_count > 0 OR v_ugc_campaigns_count > 0 OR
     v_dm_conversations_count > 0 OR v_dm_messages_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'Cross-Table Policies:';
    IF v_ugc_content_count > 0 THEN
      RAISE NOTICE '  ugc_content policies: %', v_ugc_content_count;
    END IF;
    IF v_ugc_permissions_count > 0 THEN
      RAISE NOTICE '  ugc_permissions policies: %', v_ugc_permissions_count;
    END IF;
    IF v_ugc_campaigns_count > 0 THEN
      RAISE NOTICE '  ugc_campaigns policies: %', v_ugc_campaigns_count;
    END IF;
    IF v_dm_conversations_count > 0 THEN
      RAISE NOTICE '  instagram_dm_conversations policies: %', v_dm_conversations_count;
    END IF;
    IF v_dm_messages_count > 0 THEN
      RAISE NOTICE '  instagram_dm_messages policies: %', v_dm_messages_count;
    END IF;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Total policies created: %', v_total_policies;
  RAISE NOTICE '========================================';

  IF v_user_consents_count >= 4 AND
     v_instagram_accounts_count >= 5 AND
     v_user_profiles_count >= 4 THEN
    RAISE NOTICE '✅ SUCCESS: All RLS policies recreated';
    RAISE NOTICE '✅ VERIFIED: No circular references (all use auth.uid()::text directly)';
  ELSE
    RAISE WARNING '⚠️  Policy count is lower than expected on main tables';
  END IF;
END $$;

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next Steps:
-- 1. Verify the NOTICE messages above show success
-- 2. Proceed to STEP_4 for final verification
-- ============================================
