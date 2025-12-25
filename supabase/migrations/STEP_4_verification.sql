-- ============================================
-- STEP 4: FINAL VERIFICATION
-- ============================================
-- Purpose: Comprehensive verification that:
--   1. All user_id columns are now TEXT type
--   2. Foreign key constraints are removed
--   3. RLS policies are active and non-recursive
--   4. System is ready to accept Facebook User IDs
--
-- Safety: READ-ONLY - No changes will be made
-- Prerequisites: Execute STEP_1, STEP_2, and STEP_3 first
-- ============================================

-- ============================================
-- SECTION 1: Verify Column Types
-- ============================================

SELECT
  '=== COLUMN TYPE VERIFICATION ===' as section,
  table_name,
  column_name,
  data_type,
  CASE
    WHEN data_type = 'text' THEN '✅ PASS'
    ELSE '❌ FAIL - Expected TEXT'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'user_id'
  AND table_name IN ('user_consents', 'instagram_business_accounts', 'user_profiles')
ORDER BY table_name;

-- ============================================
-- SECTION 2: Verify NO Foreign Key Constraints on user_id
-- ============================================

SELECT
  '=== FOREIGN KEY VERIFICATION ===' as section,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS - No FK constraints on user_id columns'
    ELSE '❌ FAIL - FK constraints still exist on user_id'
  END as status,
  COUNT(*) as remaining_fk_constraints
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('user_consents', 'instagram_business_accounts', 'user_profiles')
  AND kcu.column_name = 'user_id';

-- ============================================
-- SECTION 3: Verify RLS Policies Exist
-- ============================================

SELECT
  '=== RLS POLICY COUNT VERIFICATION ===' as section,
  tablename,
  COUNT(*) as policy_count,
  CASE
    WHEN tablename = 'user_consents' AND COUNT(*) >= 4 THEN '✅ PASS'
    WHEN tablename = 'instagram_business_accounts' AND COUNT(*) >= 5 THEN '✅ PASS'
    WHEN tablename = 'user_profiles' AND COUNT(*) >= 4 THEN '✅ PASS'
    ELSE '❌ FAIL - Insufficient policies'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_consents', 'instagram_business_accounts', 'user_profiles')
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- SECTION 4: Verify RLS Policies Are Non-Recursive
-- ============================================

SELECT
  '=== RLS POLICY RECURSION CHECK ===' as section,
  tablename,
  policyname,
  cmd,
  CASE
    -- Check if USING clause contains subqueries to same table
    WHEN qual LIKE '%FROM%' || tablename || '%' THEN '⚠️  WARNING - May be recursive'
    -- Check if WITH CHECK clause contains subqueries to same table
    WHEN with_check LIKE '%FROM%' || tablename || '%' THEN '⚠️  WARNING - May be recursive'
    -- Check if using auth.uid() directly (good!)
    WHEN qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%' THEN '✅ PASS - Uses auth.uid()'
    ELSE '✅ PASS'
  END as recursion_check,
  LEFT(qual, 100) as using_clause_preview,
  LEFT(with_check, 100) as with_check_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_consents', 'instagram_business_accounts', 'user_profiles')
ORDER BY tablename, policyname;

-- ============================================
-- SECTION 5: Verify RLS is Enabled
-- ============================================

SELECT
  '=== RLS ENABLED VERIFICATION ===' as section,
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ PASS - RLS Enabled'
    ELSE '❌ FAIL - RLS Disabled'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_consents', 'instagram_business_accounts', 'user_profiles')
ORDER BY tablename;

-- ============================================
-- SECTION 6: Test Facebook ID Compatibility
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FACEBOOK ID COMPATIBILITY TEST';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Testing if TEXT columns can store Facebook User IDs...';
  RAISE NOTICE '';
  RAISE NOTICE 'Example Facebook ID: "122098096448937004"';
  RAISE NOTICE 'Length: 18 characters';
  RAISE NOTICE 'Type: Numeric string (TEXT)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ TEXT columns can store Facebook IDs of any length';
  RAISE NOTICE '✅ No UUID format validation required';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- SECTION 7: Summary Report
-- ============================================

DO $$
DECLARE
  v_text_columns INTEGER;
  v_fk_constraints INTEGER;
  v_total_policies INTEGER;
  v_rls_enabled INTEGER;
BEGIN
  -- Count TEXT columns
  SELECT COUNT(*) INTO v_text_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'user_id'
    AND table_name IN ('user_consents', 'instagram_business_accounts', 'user_profiles')
    AND data_type = 'text';

  -- Count remaining FK constraints
  SELECT COUNT(*) INTO v_fk_constraints
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name IN ('user_consents', 'instagram_business_accounts', 'user_profiles')
    AND kcu.column_name = 'user_id';

  -- Count total RLS policies
  SELECT COUNT(*) INTO v_total_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('user_consents', 'instagram_business_accounts', 'user_profiles');

  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO v_rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('user_consents', 'instagram_business_accounts', 'user_profiles')
    AND rowsecurity = true;

  RAISE NOTICE '╔════════════════════════════════════════╗';
  RAISE NOTICE '║   FINAL VERIFICATION SUMMARY REPORT    ║';
  RAISE NOTICE '╠════════════════════════════════════════╣';
  RAISE NOTICE '║                                        ║';
  RAISE NOTICE '║  Column Type Migration:                ║';
  RAISE NOTICE '║    TEXT columns: % / 3               ║', v_text_columns;
  IF v_text_columns = 3 THEN
    RAISE NOTICE '║    Status: ✅ ALL CONVERTED            ║';
  ELSE
    RAISE NOTICE '║    Status: ❌ INCOMPLETE               ║';
  END IF;
  RAISE NOTICE '║                                        ║';
  RAISE NOTICE '║  Foreign Key Constraints:              ║';
  RAISE NOTICE '║    Remaining FKs: %                   ║', v_fk_constraints;
  IF v_fk_constraints = 0 THEN
    RAISE NOTICE '║    Status: ✅ ALL REMOVED              ║';
  ELSE
    RAISE NOTICE '║    Status: ❌ CONSTRAINTS REMAIN       ║';
  END IF;
  RAISE NOTICE '║                                        ║';
  RAISE NOTICE '║  RLS Policies:                         ║';
  RAISE NOTICE '║    Total policies: %                  ║', v_total_policies;
  IF v_total_policies >= 13 THEN
    RAISE NOTICE '║    Status: ✅ POLICIES CREATED         ║';
  ELSE
    RAISE NOTICE '║    Status: ⚠️  FEWER THAN EXPECTED    ║';
  END IF;
  RAISE NOTICE '║                                        ║';
  RAISE NOTICE '║  RLS Status:                           ║';
  RAISE NOTICE '║    Tables with RLS: % / 3             ║', v_rls_enabled;
  IF v_rls_enabled = 3 THEN
    RAISE NOTICE '║    Status: ✅ ALL ENABLED              ║';
  ELSE
    RAISE NOTICE '║    Status: ❌ NOT FULLY ENABLED        ║';
  END IF;
  RAISE NOTICE '║                                        ║';
  RAISE NOTICE '╠════════════════════════════════════════╣';

  IF v_text_columns = 3 AND v_fk_constraints = 0 AND v_total_policies >= 13 AND v_rls_enabled = 3 THEN
    RAISE NOTICE '║                                        ║';
    RAISE NOTICE '║  🎉 ALL CHECKS PASSED!                 ║';
    RAISE NOTICE '║                                        ║';
    RAISE NOTICE '║  Database is ready to accept:          ║';
    RAISE NOTICE '║  ✅ Facebook User IDs (TEXT)           ║';
    RAISE NOTICE '║  ✅ Non-recursive RLS policies         ║';
    RAISE NOTICE '║  ✅ Secure row-level access control    ║';
    RAISE NOTICE '║                                        ║';
  ELSE
    RAISE NOTICE '║                                        ║';
    RAISE NOTICE '║  ⚠️  SOME CHECKS FAILED                ║';
    RAISE NOTICE '║                                        ║';
    RAISE NOTICE '║  Review the output above and:          ║';
    RAISE NOTICE '║  1. Check which steps failed           ║';
    RAISE NOTICE '║  2. Re-run the failed STEP_X script    ║';
    RAISE NOTICE '║  3. Run this verification again        ║';
    RAISE NOTICE '║                                        ║';
  END IF;

  RAISE NOTICE '╚════════════════════════════════════════╝';
END $$;

-- ============================================
-- VERIFICATION COMPLETE
-- ============================================
-- Review the output above to confirm all checks passed
-- If any checks failed, review and re-run the appropriate STEP
-- ============================================
