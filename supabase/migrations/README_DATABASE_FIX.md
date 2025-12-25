# 🔧 SURGICAL DATABASE FIX - Execution Guide

## Problem Summary
1. **UUID Type Mismatch**: Database expects UUID but receives Facebook User IDs (numeric strings)
2. **Infinite Recursion**: RLS policies create circular references causing database errors

## Solution Overview
This fix converts `user_id` columns from UUID → TEXT and replaces recursive RLS policies with simple, direct policies.

---

## 📋 **EXECUTION INSTRUCTIONS**

### Prerequisites
- ✅ Access to Supabase SQL Editor
- ✅ Database backup (recommended)
- ✅ Review the inspection results before proceeding

### Execution Order (CRITICAL - Do NOT skip steps!)

#### **STEP 1: Inspect Current Schema**
```
File: STEP_1_inspect_schema.sql
Purpose: Understand current state - NO CHANGES made
```

**How to Execute:**
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor** (left sidebar)
3. Create **New Query**
4. Copy/paste contents of `STEP_1_inspect_schema.sql`
5. Click **Run**
6. **Review output carefully**:
   - Confirm `user_id` columns are `uuid` type
   - Note the foreign key constraint names
   - Review existing RLS policies

**⚠️ CHECKPOINT:** Do NOT proceed until you've reviewed the output!

---

#### **STEP 2: Alter Schema (UUID → TEXT)**
```
File: STEP_2_alter_schema_UUID_to_TEXT.sql
Purpose: Convert user_id columns to TEXT type
⚠️ DESTRUCTIVE: Alters table schema
```

**How to Execute:**
1. In **SQL Editor**, create **New Query**
2. Copy/paste contents of `STEP_2_alter_schema_UUID_to_TEXT.sql`
3. **Review the SQL** - ensure you understand what it does
4. Click **Run**
5. **Watch the NOTICE messages** in the output
6. Confirm you see:
   ```
   ✓ Dropped FK constraint: user_consents_user_id_fkey
   ✓ Altered user_consents.user_id to TEXT
   ✓ Altered instagram_business_accounts.user_id to TEXT
   ✓ Altered user_profiles.user_id to TEXT
   ✅ SUCCESS: All user_id columns are now TEXT
   ```

**⚠️ CHECKPOINT:** If you see errors, STOP and report them!

---

#### **STEP 3: Fix RLS Policies**
```
File: STEP_3_fix_RLS_policies.sql
Purpose: Replace recursive policies with simple policies
⚠️ DESTRUCTIVE: Drops and recreates RLS policies
```

**How to Execute:**
1. In **SQL Editor**, create **New Query**
2. Copy/paste contents of `STEP_3_fix_RLS_policies.sql`
3. **Review the SQL** - especially the new policy definitions
4. Click **Run**
5. **Watch the NOTICE messages** in the output
6. Confirm you see:
   ```
   ✓ Dropped policy: [old policy name] on [table]
   ✓ Created 4 RLS policies on user_consents
   ✓ Created 5 RLS policies on instagram_business_accounts
   ✓ Created 4 RLS policies on user_profiles
   ✅ SUCCESS: All RLS policies recreated
   ✅ VERIFIED: No circular references
   ```

**⚠️ CHECKPOINT:** If policy count is wrong, review the errors!

---

#### **STEP 4: Final Verification**
```
File: STEP_4_verification.sql
Purpose: Comprehensive verification of all changes
✅ READ-ONLY: Safe to run multiple times
```

**How to Execute:**
1. In **SQL Editor**, create **New Query**
2. Copy/paste contents of `STEP_4_verification.sql`
3. Click **Run**
4. **Review the comprehensive report**
5. Look for the final summary box - you should see:
   ```
   ╔════════════════════════════════════════╗
   ║   FINAL VERIFICATION SUMMARY REPORT    ║
   ╠════════════════════════════════════════╣
   ║  🎉 ALL CHECKS PASSED!                 ║
   ║  Database is ready to accept:          ║
   ║  ✅ Facebook User IDs (TEXT)           ║
   ║  ✅ Non-recursive RLS policies         ║
   ║  ✅ Secure row-level access control    ║
   ╚════════════════════════════════════════╝
   ```

---

## 🎯 **Success Criteria**

After completing all steps, you should have:
- ✅ All `user_id` columns are TEXT type (not UUID)
- ✅ No foreign key constraints on `user_id` columns
- ✅ 13+ RLS policies across 3 tables
- ✅ All RLS policies use `auth.uid()::text` directly (no recursion)
- ✅ RLS enabled on all 3 tables

---

## 🚨 **Troubleshooting**

### Error: "relation does not exist"
**Cause:** Table name misspelled or not in public schema
**Fix:** Verify table names in STEP_1 output

### Error: "column is of type uuid but expression is of type text"
**Cause:** STEP_2 didn't run successfully
**Fix:** Re-run STEP_2 and check for errors

### Error: "policy already exists"
**Cause:** STEP_3 didn't drop old policies
**Fix:** Manually drop policies in STEP_3, then re-run

### Warning: "infinite recursion detected"
**Cause:** Old policies still active or new policies have errors
**Fix:** Review STEP_3 output, ensure all old policies were dropped

---

## 📊 **Post-Migration Testing**

After successful migration, test the OAuth flow:
1. Clear browser cache and localStorage
2. Attempt Facebook Login
3. Check browser console for errors
4. Verify user_consents record is created with Facebook ID
5. Verify no "invalid input syntax for type uuid" errors
6. Verify no "infinite recursion detected" errors

---

## 🔄 **Rollback (If Needed)**

If something goes wrong, you can rollback by:
1. Restoring from your database backup
2. OR manually reverting the changes:
   ```sql
   -- Revert to UUID (WARNING: Loses TEXT data)
   ALTER TABLE user_consents ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
   ALTER TABLE instagram_business_accounts ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
   ALTER TABLE user_profiles ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
   ```

**⚠️ WARNING:** Rollback will fail if TEXT data cannot be cast to UUID!

---

## 📝 **Migration Log**

Document your execution:
- [ ] STEP_1 executed at: ___________
- [ ] STEP_2 executed at: ___________
- [ ] STEP_3 executed at: ___________
- [ ] STEP_4 executed at: ___________
- [ ] All checks passed: ✅ / ❌
- [ ] OAuth tested successfully: ✅ / ❌

---

## 🆘 **Need Help?**

If you encounter issues:
1. Copy the error message
2. Note which STEP failed
3. Share the output from STEP_1 and STEP_4
4. Check Supabase logs for detailed error messages

---

**Migration Created:** 2025-12-22
**Created By:** Claude Code Assistant
**Issue Tracking:** UUID Mismatch + RLS Infinite Recursion
