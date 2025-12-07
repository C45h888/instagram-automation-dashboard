# Session Handover - Phase 1 Implementation
**Date**: 2025-12-06
**Status**: Ready to implement
**Current Task**: Update all hooks to use real Meta Graph API v23.0

---

## ✅ Completed

1. **Facebook SDK OAuth Fix** - Updated to v21.0, fixed "init not called with valid version" error
2. **OAuth Flow** - Working in production with HTTPS
3. **Research Phase** - Complete analysis documented in `phase-1-integration-research.md`
4. **Environment Audit** - All variables confirmed working

---

## 🎯 Current Implementation Plan

### Step 1: Update Graph API to v23.0
**Files to modify**:
- `src/hooks/useFacebookSDK.ts:58` - Change v21.0 → v23.0
- `backend.api/routes/instagram-api.js:309, 542, 588, 752` - Change v18.0 → v23.0

### Step 2: Update Hooks (Standard Pattern for All)
**Pattern**:
```typescript
// Add at top
import { useInstagramAccount } from './useInstagramAccount';

// Inside hook
const { user } = useAuthStore();
const { businessAccountId, instagramBusinessId } = useInstagramAccount();
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// API call
const response = await fetch(
  `${apiBaseUrl}/api/instagram/ENDPOINT/${instagramBusinessId}?userId=${user?.id}&businessAccountId=${businessAccountId}`,
  {
    headers: { 'Content-Type': 'application/json' }
  }
);
```

**Hooks to update**:
1. `src/hooks/useContentAnalytics.ts` - Line 54
2. `src/hooks/useVisitorPosts.ts` - Line 53
3. `src/hooks/useComments.ts` - Line 53
4. `src/hooks/useInstagramProfile.ts` - Line 53
5. `src/hooks/useDMInbox.ts` - Line 53

### Step 3: Test
- Start backend: `cd backend.api && npm start`
- Start frontend: `npm run dev`
- Complete OAuth
- Test each page

---

## 📋 Key Information

**Environment Variables** (from .env.development):
- `VITE_API_BASE_URL=https://instagram-backend.888intelligenceautomation.in`
- `VITE_META_APP_ID=1449604936071207`

**Auth Store** (authStore.ts):
- Has: `user.id`, `token`, `isAuthenticated`
- Missing: `businessAccountId`, `instagramBusinessId`

**Instagram Account Hook** (useInstagramAccount.ts):
- Returns: `businessAccountId` (UUID), `instagramBusinessId` (Meta ID)
- Fetches from: `instagram_business_accounts` table

**Backend Requirements**:
- All endpoints need: `?userId=<uuid>&businessAccountId=<uuid>`
- Backend retrieves encrypted token from database
- No Authorization header needed

---

## 🔧 Implementation Order

1. Update Graph API version (frontend + backend)
2. Update useContentAnalytics (first hook)
3. Update useVisitorPosts
4. Update useComments
5. Update useInstagramProfile
6. Update useDMInbox
7. Test all pages

---

## 📝 Files Modified So Far

- ✅ `src/hooks/useFacebookSDK.ts` - Fixed OAuth, ready for v23.0 update
- ✅ `.claude/resources/phase-1-integration-research.md` - Complete research doc
- ✅ `.claude/resources/context-handover.md` - OAuth fix documentation

---

## 🚀 Ready to Proceed

All research complete. Starting implementation of Phase 1 hook updates.
Next: Update Graph API to v23.0, then update all 5 hooks.
