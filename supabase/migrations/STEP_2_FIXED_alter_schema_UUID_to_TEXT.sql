-- ============================================
-- STEP 2: SCHEMA ALTERATION (UUID → TEXT) - FIXED VERSION
-- ============================================
-- Purpose: Convert user_id columns from UUID to TEXT
--   to support Facebook User IDs (numeric strings)
--
-- Safety Level: DESTRUCTIVE - This changes column types
-- Prerequisites: Execute STEP_1 first and review results
-- Backup: Recommended to snapshot database first
--
-- Chain of Thought (UPDATED):
-- 1. Drop ALL RLS policies first (they depend on user_id column)
-- 2. Drop FK constraints that reference auth.users (UUID)
-- 3. Alter user_id columns to TEXT type
-- 4. Existing data will be cast to TEXT automatically
-- 5. Facebook IDs can now be stored as TEXT
-- 6. Note: STEP_3 will recreate the RLS policies
-- ============================================

BEGIN;

-- ============================================
-- SECTION 0: Drop Materialized Views (NEW!)
-- ============================================
-- Must drop materialized views BEFORE altering column types
-- They will be recreated after column type changes

DO $$
BEGIN
  RAISE NOTICE '🗑️  Dropping materialized views that depend on user_id...';

  -- Drop active_consents_summary materialized view
  IF EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname = 'active_consents_summary'
  ) THEN
    DROP MATERIALIZED VIEW public.active_consents_summary;
    RAISE NOTICE '  ✓ Dropped materialized view: active_consents_summary';
  ELSE
    RAISE NOTICE '  ⊘ Materialized view does not exist: active_consents_summary';
  END IF;

  RAISE NOTICE '✓ Materialized views dropped';
END $$;

-- ============================================
-- SECTION 1: Drop ALL RLS Policies (CRITICAL!)
-- ============================================
-- Must drop policies BEFORE altering column types
-- This includes CROSS-TABLE policies that reference user_id columns
-- STEP_3 will recreate them with correct types

-- Drop ALL policies on user_consents
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '🗑️  Dropping RLS policies on user_consents...';
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_consents'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_consents', r.policyname);
    RAISE NOTICE '  ✓ Dropped policy: %', r.policyname;
  END LOOP;
  RAISE NOTICE '✓ All user_consents policies dropped';
END $$;

-- Drop ALL policies on instagram_business_accounts
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '🗑️  Dropping RLS policies on instagram_business_accounts...';
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'instagram_business_accounts'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.instagram_business_accounts', r.policyname);
    RAISE NOTICE '  ✓ Dropped policy: %', r.policyname;
  END LOOP;
  RAISE NOTICE '✓ All instagram_business_accounts policies dropped';
END $$;

-- Drop ALL policies on user_profiles
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '🗑️  Dropping RLS policies on user_profiles...';
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', r.policyname);
    RAISE NOTICE '  ✓ Dropped policy: %', r.policyname;
  END LOOP;
  RAISE NOTICE '✓ All user_profiles policies dropped';
END $$;

-- ============================================
-- SECTION 1B: Drop ALL RLS Policies on ALL Tables (COMPREHENSIVE)
-- ============================================
-- Drop ALL policies on ALL tables to avoid ANY cross-table dependencies
-- This is the nuclear option but guarantees no hidden dependencies remain
-- STEP_3 will recreate policies with correct types

DO $$
DECLARE
  r_table RECORD;
  r_policy RECORD;
  v_total_dropped INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 COMPREHENSIVE APPROACH: Finding ALL tables with RLS policies...';
  RAISE NOTICE '';

  -- Iterate through ALL tables with policies (excluding the main 3 already handled)
  FOR r_table IN (
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename NOT IN ('user_consents', 'instagram_business_accounts', 'user_profiles')
    ORDER BY tablename
  ) LOOP
    RAISE NOTICE '🗑️  Dropping ALL policies on table: %', r_table.tablename;

    -- Drop all policies on this table
    FOR r_policy IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r_table.tablename
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r_policy.policyname, r_table.tablename);
      RAISE NOTICE '  ✓ Dropped policy: %', r_policy.policyname;
      v_total_dropped := v_total_dropped + 1;
    END LOOP;

    RAISE NOTICE '✓ All policies dropped on table: %', r_table.tablename;
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '✅ TOTAL CROSS-TABLE POLICIES DROPPED: %', v_total_dropped;
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- Display important notice
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NOTE: RLS policies have been dropped temporarily';
  RAISE NOTICE '⚠️  They will be recreated in STEP_3 with correct types';
  RAISE NOTICE '';
END $$;

-- ============================================
-- SECTION 2: Drop Foreign Key Constraints
-- ============================================

-- Drop FK constraint on user_consents.user_id
DO $$
BEGIN
  RAISE NOTICE '🔧 Dropping foreign key constraints...';
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_consents_user_id_fkey'
      AND table_name = 'user_consents'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.user_consents
      DROP CONSTRAINT user_consents_user_id_fkey;
    RAISE NOTICE '  ✓ Dropped FK: user_consents_user_id_fkey';
  ELSE
    RAISE NOTICE '  ⊘ FK does not exist: user_consents_user_id_fkey';
  END IF;
END $$;

-- Drop FK constraint on instagram_business_accounts.user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'instagram_business_accounts_user_id_fkey'
      AND table_name = 'instagram_business_accounts'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.instagram_business_accounts
      DROP CONSTRAINT instagram_business_accounts_user_id_fkey;
    RAISE NOTICE '  ✓ Dropped FK: instagram_business_accounts_user_id_fkey';
  ELSE
    RAISE NOTICE '  ⊘ FK does not exist: instagram_business_accounts_user_id_fkey';
  END IF;
END $$;

-- Drop FK constraint on user_profiles.user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_profiles_user_id_fkey'
      AND table_name = 'user_profiles'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.user_profiles
      DROP CONSTRAINT user_profiles_user_id_fkey;
    RAISE NOTICE '  ✓ Dropped FK: user_profiles_user_id_fkey';
  ELSE
    RAISE NOTICE '  ⊘ FK does not exist: user_profiles_user_id_fkey';
  END IF;
END $$;

-- Add spacing for readability
DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ============================================
-- SECTION 3: Alter Column Types (UUID → TEXT)
-- ============================================

-- Alter user_consents.user_id to TEXT
DO $$
BEGIN
  RAISE NOTICE '🔄 Converting column types from UUID to TEXT...';
  ALTER TABLE public.user_consents
    ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  RAISE NOTICE '  ✓ user_consents.user_id → TEXT';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '  ❌ Failed to alter user_consents.user_id: %', SQLERRM;
    RAISE;
END $$;

-- Alter instagram_business_accounts.user_id to TEXT
DO $$
BEGIN
  ALTER TABLE public.instagram_business_accounts
    ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  RAISE NOTICE '  ✓ instagram_business_accounts.user_id → TEXT';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '  ❌ Failed to alter instagram_business_accounts.user_id: %', SQLERRM;
    RAISE;
END $$;

-- Alter user_profiles.user_id to TEXT
DO $$
BEGIN
  ALTER TABLE public.user_profiles
    ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  RAISE NOTICE '  ✓ user_profiles.user_id → TEXT';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '  ❌ Failed to alter user_profiles.user_id: %', SQLERRM;
    RAISE;
END $$;

-- Add spacing for readability
DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ============================================
-- SECTION 4: Add Comments for Documentation
-- ============================================

COMMENT ON COLUMN public.user_consents.user_id IS 'User identifier - TEXT type to support Facebook User IDs (numeric strings)';
COMMENT ON COLUMN public.instagram_business_accounts.user_id IS 'User identifier - TEXT type to support Facebook User IDs (numeric strings)';
COMMENT ON COLUMN public.user_profiles.user_id IS 'User identifier - TEXT type to support Facebook User IDs (numeric strings)';

-- ============================================
-- SECTION 5: Recreate Materialized Views
-- ============================================
-- Now that user_id is TEXT, recreate the materialized views

DO $$
BEGIN
  RAISE NOTICE '🔄 Recreating materialized views with updated column types...';
END $$;

-- Recreate active_consents_summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.active_consents_summary AS
SELECT
  consent_type,
  COUNT(*) as total_consents,
  SUM(CASE WHEN consent_given THEN 1 ELSE 0 END) as consents_given,
  SUM(CASE WHEN NOT consent_given THEN 1 ELSE 0 END) as consents_denied,
  COUNT(DISTINCT user_id) as unique_users,  -- Now uses TEXT type
  privacy_policy_version,
  terms_version
FROM public.user_consents
WHERE revoked = FALSE
GROUP BY consent_type, privacy_policy_version, terms_version
ORDER BY total_consents DESC;

-- Create unique index for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS active_consents_summary_unique_idx
  ON public.active_consents_summary (consent_type, COALESCE(privacy_policy_version, ''), COALESCE(terms_version, ''));

COMMENT ON MATERIALIZED VIEW public.active_consents_summary IS 'Aggregated consent statistics for monitoring dashboards (refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY active_consents_summary)';

DO $$
BEGIN
  RAISE NOTICE '  ✓ Recreated materialized view: active_consents_summary';
  RAISE NOTICE '✓ Materialized views recreated';
END $$;

-- ============================================
-- SECTION 6: Verification
-- ============================================

DO $$
DECLARE
  v_user_consents_type TEXT;
  v_instagram_accounts_type TEXT;
  v_user_profiles_type TEXT;
  v_all_policies_dropped BOOLEAN;
  v_remaining_policies INTEGER;
BEGIN
  -- Check column types
  SELECT data_type INTO v_user_consents_type
  FROM information_schema.columns
  WHERE table_name = 'user_consents'
    AND column_name = 'user_id'
    AND table_schema = 'public';

  SELECT data_type INTO v_instagram_accounts_type
  FROM information_schema.columns
  WHERE table_name = 'instagram_business_accounts'
    AND column_name = 'user_id'
    AND table_schema = 'public';

  SELECT data_type INTO v_user_profiles_type
  FROM information_schema.columns
  WHERE table_name = 'user_profiles'
    AND column_name = 'user_id'
    AND table_schema = 'public';

  -- Check if all policies were dropped
  SELECT COUNT(*) INTO v_remaining_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('user_consents', 'instagram_business_accounts', 'user_profiles');

  v_all_policies_dropped := (v_remaining_policies = 0);

  RAISE NOTICE '╔════════════════════════════════════════════════════╗';
  RAISE NOTICE '║        SCHEMA ALTERATION VERIFICATION              ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════╣';
  RAISE NOTICE '║                                                    ║';
  RAISE NOTICE '║  Column Type Conversion:                           ║';
  RAISE NOTICE '║    user_consents.user_id: %                      ║', RPAD(v_user_consents_type, 20);
  RAISE NOTICE '║    instagram_business_accounts.user_id: %        ║', RPAD(v_instagram_accounts_type, 14);
  RAISE NOTICE '║    user_profiles.user_id: %                      ║', RPAD(v_user_profiles_type, 20);
  RAISE NOTICE '║                                                    ║';

  IF v_user_consents_type = 'text' AND
     v_instagram_accounts_type = 'text' AND
     v_user_profiles_type = 'text' THEN
    RAISE NOTICE '║  ✅ SUCCESS: All user_id columns are now TEXT      ║';
  ELSE
    RAISE NOTICE '║  ❌ FAILED: Some columns are not TEXT              ║';
  END IF;

  RAISE NOTICE '║                                                    ║';
  RAISE NOTICE '║  RLS Policies Status:                              ║';
  RAISE NOTICE '║    Remaining policies: %                          ║', LPAD(v_remaining_policies::TEXT, 22);

  IF v_all_policies_dropped THEN
    RAISE NOTICE '║  ✅ SUCCESS: All RLS policies dropped              ║';
    RAISE NOTICE '║  ⚠️  IMPORTANT: Run STEP_3 to recreate policies    ║';
  ELSE
    RAISE NOTICE '║  ⚠️  WARNING: Some policies remain (% total)      ║', v_remaining_policies;
  END IF;

  RAISE NOTICE '║                                                    ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════╣';

  IF v_user_consents_type = 'text' AND
     v_instagram_accounts_type = 'text' AND
     v_user_profiles_type = 'text' AND
     v_all_policies_dropped THEN
    RAISE NOTICE '║                                                    ║';
    RAISE NOTICE '║  🎉 STEP 2 COMPLETED SUCCESSFULLY!                 ║';
    RAISE NOTICE '║                                                    ║';
    RAISE NOTICE '║  Next Action: Run STEP_3 to recreate RLS policies ║';
    RAISE NOTICE '║                                                    ║';
  ELSE
    RAISE NOTICE '║                                                    ║';
    RAISE NOTICE '║  ⚠️  ISSUES DETECTED - Review output above         ║';
    RAISE NOTICE '║                                                    ║';
  END IF;

  RAISE NOTICE '╚════════════════════════════════════════════════════╝';
END $$;

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- ✅ Column types successfully changed from UUID to TEXT
-- ✅ Materialized views recreated with new types
-- ⚠️  CRITICAL: Your tables now have NO RLS policies!
-- ⚠️  This is intentional and temporary
--
-- Next Steps:
-- 1. Verify the output above shows ✅ SUCCESS
-- 2. IMMEDIATELY proceed to STEP_3 to recreate RLS policies
-- 3. Do NOT leave database in this state for long
--
-- What was changed:
-- 1. Dropped materialized view: active_consents_summary
-- 2. Dropped all RLS policies (temporary)
-- 3. Dropped foreign key constraints on user_id
-- 4. Altered user_id columns: UUID → TEXT
-- 5. Recreated materialized view with TEXT type
-- 6. Next: STEP_3 will recreate RLS policies
-- ============================================
