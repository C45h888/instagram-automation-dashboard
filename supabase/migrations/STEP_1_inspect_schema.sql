-- ============================================
-- STEP 1: SCHEMA INSPECTION
-- ============================================
-- Purpose: Inspect current schema to understand:
--   1. Column types for user_id
--   2. Existing foreign key constraints
--   3. Current RLS policies
--
-- Safety: READ-ONLY - No changes will be made
-- Execute in: Supabase SQL Editor
-- ============================================

-- ============================================
-- SECTION 1: Inspect user_consents Table
-- ============================================

SELECT
  'user_consents' as table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_consents'
  AND column_name = 'user_id';

-- Check foreign key constraints on user_consents.user_id
SELECT
  'user_consents FK constraints' as description,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'user_consents'
  AND kcu.column_name = 'user_id';

-- ============================================
-- SECTION 2: Inspect instagram_business_accounts Table
-- ============================================

SELECT
  'instagram_business_accounts' as table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'instagram_business_accounts'
  AND column_name = 'user_id';

-- Check foreign key constraints on instagram_business_accounts.user_id
SELECT
  'instagram_business_accounts FK constraints' as description,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'instagram_business_accounts'
  AND kcu.column_name = 'user_id';

-- ============================================
-- SECTION 3: Inspect user_profiles Table
-- ============================================

SELECT
  'user_profiles' as table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name = 'user_id';

-- Check foreign key constraints on user_profiles.user_id
SELECT
  'user_profiles FK constraints' as description,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'user_profiles'
  AND kcu.column_name = 'user_id';

-- ============================================
-- SECTION 4: Inspect RLS Policies
-- ============================================

-- Check RLS policies on user_consents
SELECT
  'user_consents RLS policies' as description,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_consents';

-- Check RLS policies on instagram_business_accounts
SELECT
  'instagram_business_accounts RLS policies' as description,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'instagram_business_accounts';

-- Check RLS policies on user_profiles
SELECT
  'user_profiles RLS policies' as description,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_profiles';

-- ============================================
-- INSPECTION COMPLETE
-- ============================================
-- Review the output above to confirm:
-- 1. user_id columns are currently UUID type
-- 2. Foreign key constraints exist that need to be dropped
-- 3. RLS policies contain circular references
--
-- If everything looks correct, proceed to STEP_2
-- ============================================
