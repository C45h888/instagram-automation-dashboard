# Comprehensive Fix Workflow
## Instagram Automation Dashboard - Error Resolution Plan

**Generated:** 2026-01-10
**Status:** Pending Implementation

---

## Executive Summary

This workflow addresses all errors discovered through console log analysis and database auditing. The fixes are organized in phases based on dependency order and criticality.

### Error Sources Analyzed
1. `.claude/resources/errors.txt` - Runtime console errors
2. Database Audit Report - Schema/code mismatches
3. Codebase Analysis - Type definitions and null safety

---

## Consolidated Issue Registry

| ID | Issue | File | Line | Severity | Phase |
|----|-------|------|------|----------|-------|
| ERR-001 | `audit_log` ip_address receives invalid inet value `'unknown'` | config/supabase.js | 424 | **CRITICAL** | 1 |
| ERR-002 | ProfileStats.tsx missing null safety on `toLocaleString()` | ProfileStats.tsx | 76 | **HIGH** | 2 |
| ERR-003 | `instagram_media` upsert uses non-existent `timestamp` column | instagram-sync.js | 159 | **MEDIUM** | 3 |
| ERR-004 | Type definition mismatch - `InstagramProfileData` says non-nullable but DB is nullable | permissions.ts | 37-39 | **LOW** | 4 |

---

## Error Chain Analysis

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ERROR CHAIN                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [1] POST /api/instagram/exchange-token                             │
│       │                                                              │
│       ▼                                                              │
│  [2] Token exchange logic executes (credentials upsert OK ✅)        │
│       │                                                              │
│       ▼                                                              │
│  [3] logAfterResponse middleware fires                              │
│       │                                                              │
│       ▼                                                              │
│  [4] audit_log INSERT with ip_address: 'unknown'  ←── ERR-001       │
│       │                                                              │
│       ▼                                                              │
│  [5] PostgreSQL: "invalid input syntax for type inet"               │
│       │                                                              │
│       ▼                                                              │
│  [6] 500 Internal Server Error returned to client                   │
│       │                                                              │
│       ▼                                                              │
│  [7] useTokenValidation receives 500 → marks as error               │
│       │                                                              │
│       ▼                                                              │
│  [8] Profile fetch proceeds with stale/partial data                 │
│       │                                                              │
│       ▼                                                              │
│  [9] InstagramProfileCard renders with undefined values             │
│       │                                                              │
│       ▼                                                              │
│  [10] ProfileStats: stat.value.toLocaleString() ←── ERR-002         │
│       │                                                              │
│       ▼                                                              │
│  [11] TypeError: Cannot read properties of undefined                │
│       │                                                              │
│       ▼                                                              │
│  [12] React error → White screen / App crash                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Critical Backend Fix (ERR-001)

### Objective
Fix the 500 Internal Server Error caused by invalid `inet` type in `audit_log` table.

### Issue Details
- **File:** `backend.api/config/supabase.js`
- **Line:** 424
- **Problem:** PostgreSQL `inet` type cannot accept string `'unknown'`
- **Impact:** ALL API routes fail when IP cannot be determined

### Current Code
```javascript
// config/supabase.js:424
ip_address: req?.ip || req?.connection?.remoteAddress || 'unknown',
```

### Fixed Code
```javascript
// config/supabase.js:424
ip_address: req?.ip || req?.connection?.remoteAddress || null,
```

### Verification Steps
1. Deploy fix to backend
2. Clear any cached connections
3. Test POST `/api/instagram/exchange-token`
4. Verify 200 response instead of 500
5. Check `audit_log` table for new entries with `NULL` ip_address

---

## Phase 2: Frontend Null Safety (ERR-002)

### Objective
Prevent TypeError crashes when profile data contains null/undefined numeric values.

### Issue Details
- **File:** `src/components/permissions/InstagramProfile/ProfileStats.tsx`
- **Line:** 76
- **Problem:** `stat.value.toLocaleString()` crashes when `stat.value` is undefined
- **Impact:** App crashes with white screen after login

### Current Code
```tsx
// ProfileStats.tsx:76
<p className="text-2xl font-bold text-white">
  {stat.value.toLocaleString()}
</p>
```

### Fixed Code
```tsx
// ProfileStats.tsx:76
<p className="text-2xl font-bold text-white">
  {(stat.value ?? 0).toLocaleString()}
</p>
```

### Additional Defensive Fix (Props Interface)
Update the component to handle nullable props explicitly:

```tsx
// ProfileStats.tsx - Update props handling
const stats: StatItem[] = [
  {
    icon: Users,
    label: 'Followers',
    value: followers ?? 0,  // Add null coalescing at source
    color: 'purple'
  },
  {
    icon: Users,
    label: 'Following',
    value: following ?? 0,
    color: 'pink'
  },
  {
    icon: Image,
    label: 'Posts',
    value: posts ?? 0,
    color: 'blue'
  }
];
```

### Verification Steps
1. Build frontend with fix
2. Test with valid profile data
3. Test with null/undefined profile data (mock)
4. Verify no TypeError in console
5. Verify stats display "0" instead of crashing

---

## Phase 3: Database Operation Fix (ERR-003)

### Objective
Remove non-existent column reference from instagram_media upsert operation.

### Issue Details
- **File:** `backend.api/services/instagram-sync.js`
- **Line:** 159
- **Problem:** Code references `timestamp` column which doesn't exist in `instagram_media` table
- **Impact:** Media sync operations fail with column not found error

### Current Code
```javascript
// instagram-sync.js:153-165 (approximate)
const { data, error } = await supabase
  .from('instagram_media')
  .upsert({
    business_account_id: businessAccountId,
    instagram_media_id: post.id,
    media_url: post.media_url,
    thumbnail_url: post.thumbnail_url,
    caption: post.caption,
    timestamp: post.timestamp,      // ❌ Column doesn't exist - REMOVE
    published_at: post.timestamp,   // ✅ This captures the same value
    media_type: post.media_type,
    permalink: post.permalink,
    like_count: post.like_count,
    comments_count: post.comments_count,
    // ...
  }, {
    onConflict: 'instagram_media_id'
  });
```

### Fixed Code
```javascript
// instagram-sync.js:153-165 (approximate)
const { data, error } = await supabase
  .from('instagram_media')
  .upsert({
    business_account_id: businessAccountId,
    instagram_media_id: post.id,
    media_url: post.media_url,
    thumbnail_url: post.thumbnail_url,
    caption: post.caption,
    // timestamp: post.timestamp,   // REMOVED - column doesn't exist
    published_at: post.timestamp,   // ✅ Correct column
    media_type: post.media_type,
    permalink: post.permalink,
    like_count: post.like_count,
    comments_count: post.comments_count,
    // ...
  }, {
    onConflict: 'instagram_media_id'
  });
```

### Verification Steps
1. Deploy fix to backend
2. Trigger media sync operation
3. Verify no "column does not exist" errors
4. Check `instagram_media` table for new entries
5. Verify `published_at` contains correct timestamp

---

## Phase 4: Type Definition Alignment (ERR-004)

### Objective
Align TypeScript type definitions with actual database schema to prevent future type-related bugs.

### Issue Details
- **File:** `src/types/permissions.ts`
- **Lines:** 37-39
- **Problem:** Type says `number` (required) but DB columns are nullable
- **Impact:** TypeScript doesn't warn about potential null values

### Current Code
```typescript
// permissions.ts:31-43
export interface InstagramProfileData {
  id: string;
  username: string;
  name: string;
  account_type: 'business' | 'creator' | 'personal';
  profile_picture_url?: string;
  followers_count: number;      // ❌ Should be nullable
  following_count: number;      // ❌ Should be nullable
  media_count: number;          // ❌ Should be nullable
  biography?: string;
  website?: string;
  is_verified?: boolean;
}
```

### Fixed Code
```typescript
// permissions.ts:31-43
export interface InstagramProfileData {
  id: string;
  username: string;
  name: string;
  account_type: 'business' | 'creator' | 'personal';
  profile_picture_url?: string;
  followers_count?: number | null;   // ✅ Matches DB schema
  following_count?: number | null;   // ✅ Matches DB schema
  media_count?: number | null;       // ✅ Matches DB schema
  biography?: string;
  website?: string;
  is_verified?: boolean;
}
```

### Verification Steps
1. Update type definition
2. Run `tsc --noEmit` to check for type errors
3. Fix any new TypeScript errors that surface (good - they reveal potential bugs)
4. Update components that use these types to handle null cases

---

## Implementation Checklist

### Pre-Implementation
- [ ] Create git branch: `fix/error-resolution-2026-01-10`
- [ ] Backup current database state (optional but recommended)
- [ ] Notify team of incoming fixes (if applicable)

### Phase 1 Execution
- [ ] Edit `backend.api/config/supabase.js:424`
- [ ] Change `'unknown'` to `null`
- [ ] Test locally with curl/Postman
- [ ] Deploy to staging/production
- [ ] Verify 500 errors resolved

### Phase 2 Execution
- [ ] Edit `src/components/permissions/InstagramProfile/ProfileStats.tsx:76`
- [ ] Add null coalescing: `(stat.value ?? 0).toLocaleString()`
- [ ] Optionally add defensive defaults in stats array
- [ ] Build and test frontend
- [ ] Verify no TypeError crashes

### Phase 3 Execution
- [ ] Edit `backend.api/services/instagram-sync.js:159`
- [ ] Remove `timestamp: post.timestamp` line
- [ ] Test media sync operation
- [ ] Verify data saves correctly

### Phase 4 Execution
- [ ] Edit `src/types/permissions.ts:37-39`
- [ ] Update types to nullable
- [ ] Run TypeScript compiler
- [ ] Fix any revealed type errors
- [ ] Update unit tests if applicable

### Post-Implementation
- [ ] Run full test suite
- [ ] Monitor error logs for 24 hours
- [ ] Update `.claude/resources/errors.txt` with resolution notes
- [ ] Commit with message: "fix: resolve 500 errors and null safety issues"
- [ ] Create PR for review

---

## Risk Assessment

| Phase | Risk Level | Rollback Complexity | Notes |
|-------|------------|---------------------|-------|
| 1 | Low | Simple | Changing `'unknown'` to `null` is safe |
| 2 | Low | Simple | Frontend-only change, no data impact |
| 3 | Low | Simple | Removing unused column reference |
| 4 | Medium | Moderate | May surface hidden type errors |

---

## Success Criteria

After all phases complete:

1. **No 500 errors** on `/api/instagram/exchange-token`
2. **No TypeError crashes** in ProfileStats component
3. **No column errors** during media sync
4. **TypeScript compiles** without errors
5. **Console log clean** - no errors from errors.txt reproduced

---

## Appendix: Files Modified

| File | Phase | Change Type |
|------|-------|-------------|
| `backend.api/config/supabase.js` | 1 | Bug fix |
| `src/components/permissions/InstagramProfile/ProfileStats.tsx` | 2 | Bug fix |
| `backend.api/services/instagram-sync.js` | 3 | Bug fix |
| `src/types/permissions.ts` | 4 | Type alignment |

---

**Document Version:** 1.0
**Author:** Claude Code Analysis
**Review Required:** Yes
